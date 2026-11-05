#!/usr/bin/env python3
"""Acquire and version official MEB/ÖDSGM distribution files; never publish or pick a school's scenario.

Rules (docs/learning/MEB-SCENARIO-PROTOCOL.md §"Kaynağı gerçekten edin ve sürümle"):
- HTTPS only; allow-listed official hosts; `meb.ai` only as a redirect hop for links read from the official index page.
- Every hop re-validates host and resolved IPs (no loopback/private/link-local/multicast/reserved).
- 15 s per request, 5 MB per file, bounded ZIP central-directory inspection; nothing inside the workbook is executed.
- Same SHA-256 → only `last_checked_at` moves. New SHA-256 → new revision marked `diff_review_required`;
  the previously approved file, hash and extracted candidates are never overwritten or deleted.
- Unknown year/term → `unpublished`; no URL is guessed. Downloaded documents are data, never instructions.
"""
import argparse
import hashlib
import html
import ipaddress
import json
import re
import socket
import struct
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

INDEX_PAGES = {
    ("oyss", "2026-2027", 1): "https://odsgm.meb.gov.tr/www/1donem-konu-soru-dagilim-tablolari-2026-2027/icerik/1724",
}
FINAL_HOSTS = ("odsgm.meb.gov.tr", "meb.gov.tr", "cdn.eba.gov.tr")
REDIRECT_ONLY_HOSTS = ("meb.ai",)
MAX_HOPS = 5
TIMEOUT_SECONDS = 15
MAX_FILE_BYTES = 5 * 1024 * 1024
MAX_PAGE_BYTES = 2 * 1024 * 1024
MAX_ZIP_ENTRIES = 500
MAX_ZIP_EXPANSION = 40_000_000
XLSX_MIMES = {"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/octet-stream", "application/zip"}
USER_AGENT = "GINA-curriculum-source-check/1 (+https://gina.app; official distribution tables only)"


class PolicyError(ValueError):
    pass


def host_allowed(host, *, final):
    host = (host or "").lower().rstrip(".")
    if not host:
        return False
    if any(host == h or host.endswith("." + h) for h in FINAL_HOSTS):
        return True
    if not final and any(host == h for h in REDIRECT_ONLY_HOSTS):
        return True
    return False


def ip_is_public(value):
    ip = ipaddress.ip_address(value)
    if isinstance(ip, ipaddress.IPv6Address) and ip.ipv4_mapped:
        ip = ip.ipv4_mapped
    return not (ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_multicast or ip.is_reserved or ip.is_unspecified or getattr(ip, "is_site_local", False))


def check_url(url, *, final, resolver=None):
    parts = urllib.parse.urlsplit(url)
    if parts.scheme != "https":
        raise PolicyError("https_required")
    if parts.username or parts.password or parts.port not in (None, 443):
        raise PolicyError("url_authority_rejected")
    if not host_allowed(parts.hostname, final=final):
        raise PolicyError("host_not_allowed:" + (parts.hostname or ""))
    resolver = resolver or (lambda host: sorted({info[4][0] for info in socket.getaddrinfo(host, 443, proto=socket.IPPROTO_TCP)}))
    try:
        addresses = resolver(parts.hostname)
    except OSError:
        raise PolicyError("dns_failed:" + parts.hostname)
    if not addresses or not all(ip_is_public(a) for a in addresses):
        raise PolicyError("non_public_address:" + parts.hostname)
    return parts


class _NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def _default_transport(url, timeout, max_bytes):
    opener = urllib.request.build_opener(_NoRedirect)
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept": "*/*"})
    try:
        with opener.open(request, timeout=timeout) as response:
            body = response.read(max_bytes + 1)
            return response.status, {k.lower(): v for k, v in response.headers.items()}, body
    except urllib.error.HTTPError as e:
        if e.code in (301, 302, 303, 307, 308):
            return e.code, {k.lower(): v for k, v in e.headers.items()}, b""
        raise


def fetch(url, *, final_kind, transport=None, resolver=None, max_bytes=MAX_FILE_BYTES, timeout=TIMEOUT_SECONDS):
    """Follow at most MAX_HOPS redirects, validating each hop; returns (final_url, chain, headers, body)."""
    transport = transport or _default_transport
    chain = []
    current = url
    for hop in range(MAX_HOPS + 1):
        check_url(current, final=False, resolver=resolver)
        status, headers, body = transport(current, timeout, max_bytes)
        chain.append({"url": current, "status": status})
        if status in (301, 302, 303, 307, 308):
            location = headers.get("location")
            if not location:
                raise PolicyError("redirect_without_location")
            current = urllib.parse.urljoin(current, location)
            continue
        if status != 200:
            raise PolicyError(f"http_status:{status}")
        check_url(current, final=True, resolver=resolver)
        if len(body) > max_bytes:
            raise PolicyError("size_limit")
        return current, chain, headers, body
    raise PolicyError("too_many_redirects")


def inspect_xlsx(body, headers):
    """Bounded ZIP central-directory walk: sizes and names only; no decompression, no formulas, no macros."""
    mime = (headers.get("content-type") or "").split(";")[0].strip().lower()
    if mime and mime not in XLSX_MIMES:
        raise PolicyError("mime_rejected:" + mime)
    if len(body) < 22 or body[:2] != b"PK":
        raise PolicyError("not_a_zip")
    tail = body[-(65536 + 22):]
    at = tail.rfind(b"PK\x05\x06")
    if at < 0:
        raise PolicyError("zip_eocd_missing")
    _, _, _, count, cd_size, cd_offset, _ = struct.unpack("<HHHHIIH", tail[at + 4:at + 22])
    if count > MAX_ZIP_ENTRIES or cd_offset + cd_size > len(body):
        raise PolicyError("zip_entries_limit" if count > MAX_ZIP_ENTRIES else "zip_directory_invalid")
    names, expansion, pos = [], 0, cd_offset
    for _ in range(count):
        if body[pos:pos + 4] != b"PK\x01\x02":
            raise PolicyError("zip_directory_invalid")
        compressed, uncompressed, name_len, extra_len, comment_len = struct.unpack("<IIHHH", body[pos + 20:pos + 34])
        name = body[pos + 46:pos + 46 + name_len].decode("utf-8", "replace")
        if name.startswith("/") or ".." in name.split("/"):
            raise PolicyError("zip_path_rejected")
        expansion += uncompressed
        if expansion > MAX_ZIP_EXPANSION:
            raise PolicyError("workbook_expansion_limit")
        names.append(name)
        pos += 46 + name_len + extra_len + comment_len
    flags = []
    if "xl/workbook.xml" not in names:
        raise PolicyError("workbook_missing")
    if any(n.lower().endswith("vbaproject.bin") for n in names):
        flags.append("macro_present")
    if any(n.startswith("xl/externalLinks/") for n in names):
        flags.append("external_links_present")
    return {"mime": mime or "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "entries": len(names), "expansion": expansion, "flags": flags}


def parse_index(page):
    """Links and dates from the official index page. Text is data: no instruction in it changes policy."""
    links = []
    for m in re.finditer(r"<a\b[^>]*?href\s*=\s*[\"']([^\"']+)[\"'][^>]*>(.*?)</a>", page, re.I | re.S):
        text = html.unescape(re.sub(r"<[^>]+>", " ", m[2]))
        links.append({"href": html.unescape(m[1]).strip(), "text": " ".join(text.split())})
    dates = {}
    for label, key in (("yay[ıi]n", "published"), ("g[üu]ncelle", "updated")):
        m = re.search(label + r"[^0-9]{0,40}(\d{1,2})[./](\d{1,2})[./](\d{4})", page, re.I)
        if m:
            dates[key] = f"{m[3]}-{int(m[2]):02d}-{int(m[1]):02d}"
    return links, dates


def sha256(body):
    return hashlib.sha256(body).hexdigest()


def check_source(entry, index_links, *, now, transport=None, resolver=None):
    """Compare the live file for one manifest entry; returns an outcome dict and (optionally) new bytes."""
    link = next((l for l in index_links if l["href"].rstrip("/") == entry["url"].rstrip("/")), None)
    outcome = {"file": entry["file"], "label": entry["label"], "index_link_present": link is not None, "checked_at": now}
    try:
        final_url, chain, headers, body = fetch(entry["url"], final_kind="file", transport=transport, resolver=resolver)
        inspection = inspect_xlsx(body, headers)
    except (PolicyError, urllib.error.URLError, OSError, TimeoutError) as e:
        outcome.update({"outcome": "unverified", "reason": str(e)})
        return outcome, None
    digest = sha256(body)
    outcome.update({"resolved_url": final_url, "redirect_chain": chain, "sha256": digest, "bytes": len(body), "inspection": inspection})
    if digest == entry["sha256"]:
        outcome["outcome"] = "unchanged"
    elif any(r.get("sha256") == digest for r in entry.get("revisions", [])):
        outcome["outcome"] = "known_revision"
    else:
        outcome["outcome"] = "new_revision"
    if final_url != entry["resolved_url"]:
        outcome["resolved_url_changed"] = True
    return outcome, body


def apply(entry, outcome, body, directory):
    """Mutate a manifest entry in place: same hash moves last_checked_at only; new hash appends a revision."""
    entry["last_checked_at"] = outcome["checked_at"]
    if outcome["outcome"] == "unverified":
        entry["freshness"] = {"status": "unverified", "reason": outcome["reason"], "last_approved_sha256": entry["sha256"]}
        return
    entry["freshness"] = {"status": "verified", "last_approved_sha256": entry["sha256"]}
    if outcome["outcome"] != "new_revision":
        return
    stem, suffix = Path(entry["file"]).stem, Path(entry["file"]).suffix
    name = f"{stem}.{outcome['sha256'][:12]}{suffix}"
    target = directory / name
    if not target.exists():
        target.write_bytes(body)
    entry.setdefault("revisions", []).append({
        "file": name, "sha256": outcome["sha256"], "bytes": outcome["bytes"], "resolved_url": outcome["resolved_url"],
        "redirect_chain": outcome["redirect_chain"], "retrieved_at": outcome["checked_at"], "status": "diff_review_required",
        "inspection": outcome["inspection"],
    })
    entry["freshness"] = {"status": "diff_review_required", "last_approved_sha256": entry["sha256"], "candidate_sha256": outcome["sha256"]}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("catalog", type=Path, help="e.g. docs/learning/catalog/2026-2027-term1")
    parser.add_argument("--family", default="oyss")
    parser.add_argument("--year", default="2026-2027")
    parser.add_argument("--term", type=int, default=1)
    parser.add_argument("--dry-run", action="store_true", help="do not write manifest/verification")
    args = parser.parse_args()
    index_url = INDEX_PAGES.get((args.family, args.year, args.term))
    now = datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    if not index_url:
        print(json.dumps({"outcome": "unpublished", "family": args.family, "year": args.year, "term": args.term, "alternative": "free_study", "note": "No official index known for this term; no URL guessed."}, ensure_ascii=False))
        return 2
    sources_dir = args.catalog / "sources"
    manifest_path = sources_dir / "manifest.json"
    manifest = json.loads(manifest_path.read_text())
    try:
        final_index, index_chain, _, page = fetch(index_url, final_kind="page", max_bytes=MAX_PAGE_BYTES)
        links, dates = parse_index(page.decode("utf-8", "replace"))
        index_result = {"url": index_url, "final_url": final_index, "chain": index_chain, "links": len(links), **{k: v for k, v in dates.items()}}
    except (PolicyError, urllib.error.URLError, OSError, TimeoutError) as e:
        links, index_result = [], {"url": index_url, "error": str(e)}
    results = []
    for entry in manifest:
        outcome, body = check_source(entry, links, now=now)
        apply(entry, outcome, body, sources_dir)
        results.append(outcome)
    summary = {
        "checked_at": now, "index": index_result,
        "unchanged": sum(r["outcome"] == "unchanged" for r in results),
        "new_revision": sum(r["outcome"] == "new_revision" for r in results),
        "known_revision": sum(r["outcome"] == "known_revision" for r in results),
        "unverified": sum(r["outcome"] == "unverified" for r in results),
        "results": results,
    }
    if not args.dry_run:
        manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")
        verification_path = args.catalog / "verification.json"
        verification = json.loads(verification_path.read_text())
        verification.setdefault("live_checks", []).append({k: v for k, v in summary.items() if k != "results"} | {"results": [{k: r[k] for k in ("file", "outcome", "sha256", "bytes", "reason") if k in r} for r in results]})
        verification_path.write_text(json.dumps(verification, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    return 0 if summary["unverified"] == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
