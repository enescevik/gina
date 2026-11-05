import { useState } from "react";
import {
  parseArticle,
  sectionTitle,
} from "@/lib/help-article-structure";

type Locale = "tr" | "en";
type Platform = "all" | "ios" | "android" | "web";
export type Device = "phone" | "tablet" | "desktop";
const deviceNames: Record<Device, string> = {
  phone: "Telefon",
  tablet: "Tablet",
  desktop: "Masaüstü / web",
};
const osNames: Record<Exclude<Platform, "all">, string> = {
  ios: "iOS",
  android: "Android",
  web: "Web",
};
const widths: Record<Device, string> = {
  phone: "max-w-[360px]",
  tablet: "max-w-[600px]",
  desktop: "max-w-full",
};
const empty = {
  tr: { title: "Soru başlığı", body: "Yanıtın önizlemesi burada görünecek." },
  en: { title: "Question title", body: "The answer preview appears here." },
};

// Reader-side rendering of a help article body. Structured bodies render as
// short answer + numbered steps + links; older free text renders unchanged.
export function ArticleBody(
  { title, body, locale }: { title: string; body: string; locale: Locale },
) {
  const s = parseArticle(body);
  return (
    <article lang={locale} className="break-words">
      <h3 className="text-xl font-bold">{title || empty[locale].title}</h3>
      {!body.trim()
        ? <p className="mt-3 text-slate-500">{empty[locale].body}</p>
        : !s
        ? <p className="mt-3 whitespace-pre-wrap leading-7">{body}</p>
        : (
          <>
            <section className="mt-3 rounded-2xl bg-emerald-50 p-3">
              <p className="text-xs font-bold uppercase text-emerald-800">
                {sectionTitle(locale, "short")}
              </p>
              <p className="mt-1 whitespace-pre-wrap leading-7">{s.short}</p>
            </section>
            {s.steps.length
              ? (
                <section className="mt-3">
                  <p className="font-bold">{sectionTitle(locale, "steps")}</p>
                  <ol className="mt-1 list-decimal space-y-1 pl-6 leading-7">
                    {s.steps.map((step, i) => <li key={i}>{step}</li>)}
                  </ol>
                </section>
              )
              : null}
            {s.links.length
              ? (
                <section className="mt-3">
                  <p className="font-bold">{sectionTitle(locale, "links")}</p>
                  <ul className="mt-1 space-y-1">
                    {s.links.map((l, i) => (
                      <li key={i}>
                        <span className="text-violet-700 underline">
                          {l.label || "—"}
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              )
              : null}
          </>
        )}
    </article>
  );
}

export function DeviceFrame(
  { device, platform, children, label }: {
    device: Device;
    platform: Exclude<Platform, "all">;
    children: React.ReactNode;
    label: string;
  },
) {
  return (
    <div
      data-device={device}
      data-platform={platform}
      className={"mx-auto w-full rounded-[28px] border-4 border-slate-700 bg-white " +
        widths[device]}
    >
      <div className="flex items-center justify-between rounded-t-[22px] bg-slate-100 px-4 py-2 text-xs text-slate-600">
        <span>{osNames[platform]} · {deviceNames[device]}</span>
        <span>{label}</span>
      </div>
      <div className="max-h-[460px] overflow-auto p-4">{children}</div>
    </div>
  );
}

// Device + platform picker shared by draft/live previews.
export function useDevicePreview(articlePlatform: Platform) {
  const [device, setDevice] = useState<Device>("phone");
  const [os, setOs] = useState<Exclude<Platform, "all">>(
    articlePlatform === "all" ? "ios" : articlePlatform,
  );
  const visible = articlePlatform === "all" || articlePlatform === os;
  const picker = (
    <div className="flex flex-wrap items-end gap-3">
      <label className="text-sm font-bold">
        Cihaz
        <select
          className="input mt-1"
          value={device}
          onChange={(e) => setDevice(e.target.value as Device)}
        >
          {Object.entries(deviceNames).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </label>
      <label className="text-sm font-bold">
        Platform
        <select
          className="input mt-1"
          value={os}
          onChange={(e) => {
            const v = e.target.value as Exclude<Platform, "all">;
            setOs(v);
            if (v === "web") setDevice("desktop");
          }}
        >
          {Object.entries(osNames).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </label>
    </div>
  );
  return { device, os, visible, picker };
}
