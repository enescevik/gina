// D3 — Yayın operatörünün bölge/okul kapsamı (gina.operations_member_scopes). Yalnız tam yönetici.
// Sunucu: admin_operator_scopes() / admin_set_operator_scope(...). Aynı değişiklik ağ hatasından sonra aynı
// istek kimliğiyle yeniden gönderilir (çift tıklama veya yeniden deneme ikinci kayıt/denetim yazmaz).
import { type EducationPlace, educationPlaceLabel } from "@gina/core";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { Card, Layout, Notice } from "@/components/Layout";
import { useConfirm } from "@/components/confirm-dialog";
import { adminRpc, isDefinitiveRejection, rpcMessage } from "@/lib/admin-rpc";
import { useAuth } from "@/lib/auth";
import { fmtDate, fmtDateTime } from "@/lib/format";

type Scope = { place_id: string; name: string; kind: string; parent_id: string | null; granted_at: string; granted_by: string | null };
type Operator = {
  user_id: string;
  email: string | null;
  role_active: boolean;
  expires_at: string | null;
  revoked_at: string | null;
  scopes: Scope[];
};
type Place = { id: string; kind: "country" | "region" | "school"; parent_id: string | null; name: string };
type Data = { operators: Operator[]; places: Place[] };

const errors: Record<string, string> = {
  forbidden: "Bu işlem tam yönetici yetkisi gerektirir.",
  operator_role_required: "Kişinin etkin yayın operasyonu rolü yok; önce rolü verin.",
  operator_is_admin: "Tam yöneticiler kapsamla sınırlanmaz.",
  place_not_found: "Seçilen yer bulunamadı ya da artık etkin değil.",
  scope_last_would_widen: "Bu son kapsam; kaldırmak için ayrıca onay gerekir.",
  request_conflict: "Bu istek başka bir değişiklikle çakıştı. Sayfayı yenileyin.",
  invalid_input: "Gerekçe en az 3 karakter olmalı.",
};
const resultText: Record<string, string> = {
  granted: "Kapsam eklendi.",
  removed: "Kapsam kaldırıldı.",
  unchanged: "Değişiklik gerekmedi; kayıt zaten bu durumda.",
};

export default function OperatorScopes() {
  const { session } = useAuth();
  return (
    <Layout title="Operatör kapsamları">
      {session ? <Workspace key={session.user.id} /> : null}
    </Layout>
  );
}

function Workspace() {
  const [data, setData] = useState<Data | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [tick, setTick] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; tone: "ok" | "error" } | null>(null);
  const pending = useRef(new Map<string, string>());
  const confirm = useConfirm();
  useEffect(() => {
    let live = true;
    adminRpc("admin_operator_scopes", {}, 15000).then((v) => {
      if (!live) return;
      const d = v as Data;
      setData({ operators: Array.isArray(d?.operators) ? d.operators : [], places: Array.isArray(d?.places) ? d.places : [] });
      setLoadError(false);
    }).catch(() => {
      if (live) setLoadError(true);
    });
    return () => {
      live = false;
    };
  }, [tick]);
  const places = useMemo(
    () => (data?.places ?? []).map((p) => ({ ...p, revision: 1, active: true }) as EducationPlace),
    [data],
  );
  const label = (id: string) => {
    const p = places.find((x) => x.id === id);
    return p ? educationPlaceLabel(p, places) : "Bilinmeyen yer";
  };

  async function change(op: Operator, placeId: string, grant: boolean, reason: string, allowGlobal = false) {
    if (busy) return false;
    const payload = JSON.stringify([op.user_id, placeId, grant, reason.trim(), allowGlobal]);
    let id = pending.current.get(payload);
    if (!id) {
      id = crypto.randomUUID();
      pending.current.set(payload, id);
    }
    setBusy(true);
    setMessage(null);
    try {
      const result = await adminRpc("admin_set_operator_scope", {
        p_request_id: id,
        p_user_id: op.user_id,
        p_place_id: placeId,
        p_grant: grant,
        p_reason: reason.trim(),
        p_allow_global: allowGlobal,
      }) as { status?: string; effective?: string } | null;
      pending.current.delete(payload);
      const extra = result?.effective === "all_places"
        ? " Operatörün kapsamı kalmadı: artık bütün bölgelere duyuru gönderebilir."
        : "";
      setMessage({ text: (resultText[result?.status ?? ""] ?? "İşlem tamamlandı.") + extra, tone: "ok" });
      setTick((n) => n + 1);
      return true;
    } catch (e) {
      // Kesin SQL reddinde aynı isteği tekrar göndermek anlamsız; ağ hatasında aynı kimlik korunur.
      if (isDefinitiveRejection(e)) pending.current.delete(payload);
      setMessage({
        text: errors[rpcMessage(e)] ?? "İşlem doğrulanamadı. Aynı değişikliği yeniden göndermek ikinci kayıt oluşturmaz.",
        tone: "error",
      });
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function remove(op: Operator, scope: Scope, reason: string) {
    const last = op.scopes.length === 1;
    const ok = await confirm.ask({
      title: `${scope.name} kapsamı kaldırılsın mı?`,
      body: last
        ? (
          <>
            <p><strong>Bu, operatörün son kapsamı.</strong></p>
            <p className="mt-2">
              Kaldırırsanız {op.email ?? "operatör"} bütün bölgelere ve okullara duyuru hazırlayıp yayımlayabilir.
              Yalnız yetkiyi daraltmak istiyorsanız önce yeni kapsamı ekleyin.
            </p>
          </>
        )
        : <p>{op.email ?? "Operatör"} bundan sonra {label(scope.place_id)} için duyuru hedefleyemez.</p>,
      confirmLabel: last ? "Kaldır ve bütün bölgelere aç" : "Kapsamı kaldır",
      tone: "danger",
    });
    if (!ok) return;
    await change(op, scope.place_id, false, reason, last);
  }

  return (
    <div className="space-y-5" data-testid="operator-scopes">
      {confirm.element}
      <Card title="Kapsam nasıl çalışır?">
        <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
          <li>Kapsam yalnız yayın operasyonu rolüne uygulanır (duyuru hedefi).</li>
          <li>Kapsamı olmayan yayın operatörü <strong>bütün bölgelere</strong> duyuru gönderebilir.</li>
          <li>Kapsam eklenince yalnız seçilen bölge ya da okul ve onun altındaki okullar hedeflenebilir; “herkes” seçilemez.</li>
          <li>Her değişiklik gerekçesiyle denetim kaydına yazılır. Rol vermek veya kaldırmak <Link className="underline" href="/operators">Operatör rolleri</Link> ekranındadır.</li>
        </ul>
      </Card>
      {message ? <Notice tone={message.tone}>{message.text}</Notice> : null}
      {loadError
        ? (
          <Notice tone="error">
            Kapsamlar okunamadı.{" "}
            <button className="btn-secondary" onClick={() => setTick((n) => n + 1)}>Yeniden dene</button>
          </Notice>
        )
        : !data
        ? <p role="status">Okunuyor…</p>
        : data.operators.length === 0
        ? <Card title="Yayın operatörü yok"><p>Yayın operasyonu rolü olan kimse bulunmadı.</p></Card>
        : data.operators.map((op) => (
          <OperatorCard
            key={op.user_id}
            op={op}
            places={places}
            label={label}
            busy={busy}
            onGrant={(placeId, reason) => change(op, placeId, true, reason)}
            onRemove={(scope, reason) => void remove(op, scope, reason)}
          />
        ))}
    </div>
  );
}

function OperatorCard(
  { op, places, label, busy, onGrant, onRemove }: {
    op: Operator;
    places: EducationPlace[];
    label: (id: string) => string;
    busy: boolean;
    onGrant: (placeId: string, reason: string) => Promise<boolean>;
    onRemove: (scope: Scope, reason: string) => void;
  },
) {
  const [place, setPlace] = useState("");
  const [reason, setReason] = useState("");
  const options = places.filter((p) => p.kind !== "country" && !op.scopes.some((s) => s.place_id === p.id))
    .map((p) => ({ id: p.id, text: educationPlaceLabel(p, places) }))
    .sort((a, b) => a.text.localeCompare(b.text, "tr"));
  const status = op.revoked_at
    ? `Rol kaldırıldı (${fmtDate(op.revoked_at)})`
    : !op.role_active
    ? `Rol süresi doldu (${fmtDate(op.expires_at)})`
    : `Rol etkin · bitiş ${fmtDate(op.expires_at)}`;
  const reasonOk = reason.trim().length >= 3;
  const idBase = "scope-" + op.user_id.slice(0, 8);
  return (
    <section className="admin-card" data-testid="operator-card" aria-labelledby={idBase + "-title"}>
      <h2 id={idBase + "-title"} className="text-lg font-bold text-slate-800">{op.email ?? "E-postası olmayan hesap"}</h2>
      <p className="text-sm text-slate-600">Yayın operasyonu · {status}</p>
      <p className="mt-3 font-bold" data-testid="scope-effective">
        {op.scopes.length === 0 ? "Kapsam: bütün bölgeler (sınırsız)" : `Kapsam: ${op.scopes.length} yer`}
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        {op.scopes.map((s) => (
          <span key={s.place_id} className="d3-chip" title={`Ekleyen: ${s.granted_by ?? "—"} · ${fmtDateTime(s.granted_at)}`}>
            {label(s.place_id)}
            <button
              type="button"
              aria-label={`${s.name} kapsamını kaldır`}
              disabled={busy || !reasonOk}
              onClick={() => onRemove(s, reason)}
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <div className="d3-filters mt-4">
        <label className="label" htmlFor={idBase + "-place"}>
          Eklenecek bölge veya okul
          <select
            id={idBase + "-place"}
            className="input"
            value={place}
            disabled={busy || !op.role_active}
            onChange={(e) => setPlace(e.target.value)}
          >
            <option value="">Seçin</option>
            {options.map((o) => <option key={o.id} value={o.id}>{o.text}</option>)}
          </select>
        </label>
        <label className="label grow" htmlFor={idBase + "-reason"}>
          Gerekçe (denetim kaydına yazılır)
          <input
            id={idBase + "-reason"}
            className="input"
            maxLength={500}
            value={reason}
            disabled={busy}
            onChange={(e) => setReason(e.target.value)}
          />
        </label>
        <button
          type="button"
          className="btn"
          disabled={busy || !op.role_active || !place || !reasonOk}
          onClick={() => void onGrant(place, reason).then((ok) => { if (ok) setPlace(""); })}
        >
          Kapsam ekle
        </button>
      </div>
      {!op.role_active ? <p className="text-sm text-slate-600">Rol etkin olmadığı için yeni kapsam eklenemez.</p> : null}
      {op.scopes.length > 0 && !reasonOk ? <p className="text-sm text-slate-600">Kaldırmak için önce gerekçe yazın.</p> : null}
    </section>
  );
}
