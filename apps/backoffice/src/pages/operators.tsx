// D7 — Operatör rolleri (public.operations_members). Yalnız tam yönetici.
// Sunucu: admin_operation_members() / admin_find_operator_account(email) / admin_set_operation_member(...).
// Yazma public.set_operation_member ile yapılır; her gerçek değişiklik gerekçesiyle 'operations.member' denetimine
// yazılır. Aynı değişiklik ağ hatasından sonra aynı istek kimliğiyle gönderilir (çift tıklama ikinci kayıt yazmaz).
import {
  OPERATION_ROLE_DAY_CHOICES,
  OPERATION_ROLE_LABELS,
  OPERATION_ROLES,
  type OperationMember,
  type OperationMemberRole,
  type OperationMembers,
  operationMembersSchema,
  type OperationRole,
  operationRoleExpiry,
  type OperatorAccount,
  operatorAccountSchema,
  setOperationMemberResultSchema,
} from "@gina/core";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { Card, Layout, Notice } from "@/components/Layout";
import { useConfirm } from "@/components/confirm-dialog";
import { adminRpc, isDefinitiveRejection, rpcMessage } from "@/lib/admin-rpc";
import { useAuth } from "@/lib/auth";
import { fmtDate, fmtDateTime } from "@/lib/format";

const errors: Record<string, string> = {
  forbidden: "Bu işlem tam yönetici yetkisi gerektirir.",
  operator_is_admin: "Tam yöneticiler zaten her role sahiptir; ayrıca operatör rolü verilmez.",
  operator_self_change: "Kendi operatör rolünüzü buradan değiştiremezsiniz.",
  operator_account_required: "Bu hesap operatör olamaz (anonim hesap ya da çocuk tableti).",
  request_conflict: "Bu istek başka bir değişiklikle çakıştı. Sayfayı yenileyin.",
  invalid_input: "Gerekçe 3–500 karakter olmalı; süre en çok 1 yıl olabilir.",
};
const resultText: Record<string, string> = {
  granted: "Rol verildi.",
  updated: "Rolün süresi güncellendi.",
  revoked: "Rol kaldırıldı.",
  unchanged: "Değişiklik gerekmedi; kayıt zaten bu durumda.",
};
const stateText: Record<OperationMemberRole["state"], string> = {
  active: "Etkin",
  expired: "Süresi doldu",
  revoked: "Kaldırıldı",
};
const reasonOk = (v: string) => v.trim().length >= 3 && v.trim().length <= 500;

export default function Operators() {
  const { session } = useAuth();
  return (
    <Layout title="Operatör rolleri">
      {session ? <Workspace key={session.user.id} /> : null}
    </Layout>
  );
}

type Change = { user: string; email: string | null; role: OperationRole; revoke: boolean; days: number | null; reason: string };

function Workspace() {
  const [data, setData] = useState<OperationMembers | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [tick, setTick] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; tone: "ok" | "error" } | null>(null);
  // Aynı değişiklik (kişi, rol, işlem, süre, gerekçe) → aynı istek kimliği ve aynı bitiş anı.
  const pending = useRef(new Map<string, { id: string; expires: string | null }>());
  const confirm = useConfirm();
  useEffect(() => {
    let live = true;
    adminRpc("admin_operation_members", {}, 15000).then((v) => {
      if (!live) return;
      setData(operationMembersSchema.parse(v));
      setLoadError(false);
    }).catch(() => {
      if (live) setLoadError(true);
    });
    return () => {
      live = false;
    };
  }, [tick]);

  async function change(c: Change) {
    if (busy) return false;
    const key = JSON.stringify([c.user, c.role, c.revoke, c.days, c.reason.trim()]);
    let entry = pending.current.get(key);
    if (!entry) {
      entry = { id: crypto.randomUUID(), expires: c.revoke || c.days === null ? null : operationRoleExpiry(c.days) };
      pending.current.set(key, entry);
    }
    setBusy(true);
    setMessage(null);
    try {
      const result = setOperationMemberResultSchema.parse(
        await adminRpc("admin_set_operation_member", {
          p_request_id: entry.id,
          p_user_id: c.user,
          p_role: c.role,
          p_expires_at: entry.expires,
          p_revoke: c.revoke,
          p_reason: c.reason.trim(),
        }),
      );
      pending.current.delete(key);
      const who = c.email ?? "Operatör";
      const extra = result.status === "revoked"
        ? result.open_sessions > 0
          ? ` ${who} için ${result.open_sessions} açık oturum var: bir sonraki istekleri hemen reddedilir; ekranları en geç 30 saniyede (ya da sekmeye dönünce) “Yetkiniz kaldırıldı” gösterir.`
          : ` ${who} için açık oturum yok; giriş yapsa bile bu bölümler açılmaz.`
        : "";
      const scopes = result.status === "revoked" && result.role === "release" && (result.scope_count ?? 0) > 0
        ? ` ${result.scope_count} kapsam kaydı korunur; rol yeniden verilirse aynı kapsam geçerli olur.`
        : "";
      setMessage({ text: (resultText[result.status] ?? "İşlem tamamlandı.") + extra + scopes, tone: "ok" });
      setTick((n) => n + 1);
      return true;
    } catch (e) {
      // Kesin SQL reddinde aynı isteği tekrar göndermek anlamsız; ağ hatasında aynı kimlik korunur.
      if (isDefinitiveRejection(e)) pending.current.delete(key);
      setMessage({
        text: errors[rpcMessage(e)] ?? "İşlem doğrulanamadı. Aynı değişikliği yeniden göndermek ikinci kayıt oluşturmaz.",
        tone: "error",
      });
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function revoke(m: OperationMember, r: OperationMemberRole, reason: string) {
    const ok = await confirm.ask({
      title: `${OPERATION_ROLE_LABELS[r.role]} rolü kaldırılsın mı?`,
      body: (
        <>
          <p>{m.email ?? "Bu hesap"} bundan sonra {OPERATION_ROLE_LABELS[r.role].toLocaleLowerCase("tr")} bölümlerini açamaz ve işlem yapamaz.</p>
          <p className="mt-2">
            {m.open_sessions > 0
              ? <><strong>{m.open_sessions} açık oturum var.</strong> Kaldırma hemen geçerli olur: açık sekmedeki bir sonraki istek reddedilir, ekran en geç 30 saniyede “Yetkiniz kaldırıldı” der. Yazılmamış taslaklar kaydedilmez.</>
              : "Açık oturum yok."}
          </p>
          {r.role === "release" && (r.scope_count ?? 0) > 0
            ? <p className="mt-2">{r.scope_count} kapsam kaydı silinmez; rol yeniden verilirse aynı kapsam geçerli olur.</p>
            : null}
        </>
      ),
      confirmLabel: "Rolü kaldır",
      tone: "danger",
    });
    if (!ok) return false;
    return await change({ user: m.user_id, email: m.email, role: r.role, revoke: true, days: null, reason });
  }

  return (
    <div className="space-y-5" data-testid="operators">
      {confirm.element}
      <Card title="Roller nasıl çalışır?">
        <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
          <li><strong>Destek</strong> talepleri, <strong>İçerik</strong> kütüphane ve katkı incelemesi (kabul yalnız taslak oluşturur), <strong>Yayın</strong> yayın kararı ve duyurular, <strong>Finans</strong> ödeme kayıtları içindir.</li>
          <li>Her rol süreyle verilir (en çok 1 yıl). Süre dolunca rol kendiliğinden kapanır.</li>
          <li>Yetki her istekte canlı denetlenir: kaldırılan rol, kişi oturumu açık tutsa bile bir sonraki istekte reddedilir.</li>
          <li>Her değişiklik gerekçesiyle denetim kaydına yazılır. Tam yöneticiler burada listelenmez; zaten her role sahiptir.</li>
          <li>Yayın operatörlerinin bölge/okul sınırı <Link className="underline" href="/operator-scopes">Operatör kapsamları</Link> ekranındadır.</li>
        </ul>
      </Card>
      {message ? <div data-testid="operators-message"><Notice tone={message.tone}>{message.text}</Notice></div> : null}
      <GrantCard busy={busy} onGrant={change} />
      {loadError
        ? (
          <Notice tone="error">
            Roller okunamadı.{" "}
            <button className="btn-secondary" onClick={() => setTick((n) => n + 1)}>Yeniden dene</button>
          </Notice>
        )
        : !data
        ? <p role="status">Okunuyor…</p>
        : data.members.length === 0
        ? <Card title="Operatör yok"><p>Henüz rol verilmiş kimse yok.</p></Card>
        : data.members.map((m) => (
          <MemberCard
            key={m.user_id}
            member={m}
            busy={busy}
            onChange={change}
            onRevoke={(r, reason) => revoke(m, r, reason)}
          />
        ))}
    </div>
  );
}

function GrantCard({ busy, onGrant }: { busy: boolean; onGrant: (c: Change) => Promise<boolean> }) {
  const [email, setEmail] = useState("");
  const [account, setAccount] = useState<OperatorAccount | null>(null);
  const [lookupError, setLookupError] = useState(false);
  const [role, setRole] = useState<OperationRole | "">("");
  const [days, setDays] = useState(90);
  const [reason, setReason] = useState("");
  const [looking, setLooking] = useState(false);
  async function lookup() {
    setLooking(true);
    setLookupError(false);
    setAccount(null);
    try {
      setAccount(operatorAccountSchema.parse(await adminRpc("admin_find_operator_account", { p_email: email.trim() })));
    } catch {
      setLookupError(true);
    } finally {
      setLooking(false);
    }
  }
  const found = account?.found ? account : null;
  return (
    <section className="admin-card" data-testid="grant-card" aria-labelledby="grant-title">
      <h2 id="grant-title" className="text-lg font-bold text-slate-800">Rol ver</h2>
      <p className="text-sm text-slate-600">Hesap e-postasını tam yazın. Arama yapılmaz; yalnız tam eşleşme bulunur.</p>
      <form
        className="d3-filters mt-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (email.trim().length >= 3) void lookup();
        }}
      >
        <label className="label grow" htmlFor="grant-email">
          E-posta
          <input
            id="grant-email"
            className="input"
            type="email"
            autoComplete="off"
            value={email}
            maxLength={320}
            onChange={(e) => {
              setEmail(e.target.value);
              setAccount(null);
            }}
          />
        </label>
        <button type="submit" className="btn-secondary" disabled={looking || email.trim().length < 3}>Hesabı bul</button>
      </form>
      {lookupError ? <Notice tone="error">Hesap kontrol edilemedi. Yeniden deneyin.</Notice> : null}
      {account && !account.found ? <p className="text-sm text-slate-700" data-testid="grant-not-found">Bu e-postayla bir hesap yok. Kişi önce yönetim girişi için hesap açmalı.</p> : null}
      {found && !found.eligible
        ? <p className="text-sm text-red-800" data-testid="grant-ineligible">{errors[found.reason ?? ""] ?? "Bu hesaba rol verilemez."}</p>
        : null}
      {found?.eligible
        ? (
          <div className="d3-filters mt-2" data-testid="grant-form">
            <p className="w-full font-bold">{found.email}</p>
            <label className="label" htmlFor="grant-role">
              Rol
              <select id="grant-role" className="input" value={role} disabled={busy} onChange={(e) => setRole(e.target.value as OperationRole | "")}>
                <option value="">Seçin</option>
                {OPERATION_ROLES.map((r) => <option key={r} value={r}>{OPERATION_ROLE_LABELS[r]}</option>)}
              </select>
            </label>
            <label className="label" htmlFor="grant-days">
              Süre
              <select id="grant-days" className="input" value={days} disabled={busy} onChange={(e) => setDays(Number(e.target.value))}>
                {OPERATION_ROLE_DAY_CHOICES.map((d) => <option key={d} value={d}>{d === 365 ? "1 yıl" : `${d} gün`}</option>)}
              </select>
            </label>
            <label className="label grow" htmlFor="grant-reason">
              Gerekçe (denetim kaydına yazılır)
              <input id="grant-reason" className="input" maxLength={500} value={reason} disabled={busy} onChange={(e) => setReason(e.target.value)} />
            </label>
            <button
              type="button"
              className="btn"
              disabled={busy || !role || !reasonOk(reason)}
              onClick={() => {
                if (!role) return;
                void onGrant({ user: found.user_id, email: found.email, role, revoke: false, days, reason }).then((ok) => {
                  if (ok) {
                    setRole("");
                    setReason("");
                  }
                });
              }}
            >
              Rolü ver
            </button>
            <p className="w-full text-sm text-slate-600">Bitiş: {fmtDate(operationRoleExpiry(days))}. Kişinin açık oturumu varsa rol en geç 30 saniyede ya da sekmeye dönünce görünür.</p>
          </div>
        )
        : null}
    </section>
  );
}

function MemberCard(
  { member, busy, onChange, onRevoke }: {
    member: OperationMember;
    busy: boolean;
    onChange: (c: Change) => Promise<boolean>;
    onRevoke: (r: OperationMemberRole, reason: string) => Promise<boolean>;
  },
) {
  const [reason, setReason] = useState("");
  const [days, setDays] = useState(90);
  const idBase = "member-" + member.user_id.slice(0, 8);
  const ok = reasonOk(reason);
  return (
    <section className="admin-card" data-testid="member-card" aria-labelledby={idBase + "-title"}>
      <h2 id={idBase + "-title"} className="text-lg font-bold text-slate-800">{member.email ?? "E-postası olmayan hesap"}</h2>
      <p className="text-sm text-slate-600" data-testid="member-sessions">
        {member.open_sessions > 0 ? `${member.open_sessions} açık oturum` : "Açık oturum yok"}
      </p>
      <div className="d3-filters mt-3">
        <label className="label grow" htmlFor={idBase + "-reason"}>
          Gerekçe (denetim kaydına yazılır)
          <input id={idBase + "-reason"} className="input" maxLength={500} value={reason} disabled={busy} onChange={(e) => setReason(e.target.value)} />
        </label>
        <label className="label" htmlFor={idBase + "-days"}>
          Yeni süre
          <select id={idBase + "-days"} className="input" value={days} disabled={busy} onChange={(e) => setDays(Number(e.target.value))}>
            {OPERATION_ROLE_DAY_CHOICES.map((d) => <option key={d} value={d}>{d === 365 ? "1 yıl" : `${d} gün`}</option>)}
          </select>
        </label>
      </div>
      {!ok ? <p className="text-sm text-slate-600">Değişiklik için önce gerekçe yazın.</p> : null}
      <ul className="mt-3 space-y-2">
        {member.roles.map((r) => (
          <li key={r.role} className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 p-3" data-testid="member-role" data-role={r.role} data-state={r.state}>
            <span className="d3-chip">{OPERATION_ROLE_LABELS[r.role]} · {stateText[r.state]}</span>
            <span className="text-sm text-slate-700">
              {r.state === "revoked"
                ? `Kaldırıldı ${fmtDateTime(r.revoked_at)}`
                : r.state === "expired"
                ? `Süresi doldu ${fmtDate(r.expires_at)}`
                : `Bitiş ${fmtDate(r.expires_at)}`}
              {r.granted_by ? ` · veren ${r.granted_by}` : ""}
              {r.role === "release" && r.scope_count != null
                ? ` · ${r.scope_count === 0 ? "kapsam: bütün bölgeler" : `${r.scope_count} kapsam`}`
                : ""}
            </span>
            <span className="ml-auto flex flex-wrap gap-2">
              <button
                type="button"
                className="btn-secondary"
                disabled={busy || !ok}
                onClick={() => void onChange({ user: member.user_id, email: member.email, role: r.role, revoke: false, days, reason }).then((done) => { if (done) setReason(""); })}
              >
                {r.state === "active" ? "Süreyi güncelle" : "Yeniden ver"}
              </button>
              {r.state === "active"
                ? (
                  <button type="button" className="btn-secondary text-red-800" disabled={busy || !ok} onClick={() => void onRevoke(r, reason).then((done) => { if (done) setReason(""); })}>
                    Rolü kaldır
                  </button>
                )
                : null}
            </span>
          </li>
        ))}
      </ul>
      <details className="mt-4" data-testid="member-history">
        <summary className="cursor-pointer font-semibold">Denetim izi ({member.history.length})</summary>
        {member.history.length === 0
          ? <p className="mt-2 text-sm text-slate-600">Henüz kayıt yok.</p>
          : (
            <ol className="mt-2 space-y-1 text-sm text-slate-700">
              {member.history.map((h, i) => (
                <li key={i}>
                  {fmtDateTime(h.at)} · {h.actor ?? "silinmiş hesap"} ·{" "}
                  {h.role ? OPERATION_ROLE_LABELS[h.role] : "?"} {h.revoked ? "kaldırdı" : `verdi (bitiş ${fmtDate(h.expires_at)})`}
                  {h.reason ? ` · “${h.reason}”` : ""}
                </li>
              ))}
            </ol>
          )}
      </details>
    </section>
  );
}
