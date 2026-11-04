import { useId, useRef } from "react";
import { readNotebook, strokePath } from "@gina/core";
export interface CohortImage {
  source_id: string;
  alt: string;
  png: string;
  width: number;
  height: number;
}
/** Validated document elements only; never execute stored SVG or HTML. */
export function CohortNotebook(
  { value, images }: { value: unknown; images: CohortImage[] },
) {
  const patternId = useId();
  const doc = readNotebook(value);
  if (value != null && !doc) {
    return (
      <p role="alert">
        Defter görüntülenemedi. Bu cevabı boş veya yanlış kabul etmeyin.
      </p>
    );
  }
  if (!doc?.elements.length) {
    return <p className="p-5 text-slate-600">Bu cevapta çizim bulunmuyor.</p>;
  }
  return (
    <svg
      role="img"
      aria-label="Çocuğun gönderdiği çözüm defteri"
      viewBox="0 0 1000 1400"
      className="w-full rounded-2xl border border-purple-100 bg-white"
    >
      <defs>
        <pattern
          id={patternId}
          width="40"
          height="40"
          patternUnits="userSpaceOnUse"
        >
          <path d="M40 0H0V40" fill="none" stroke="#ECE7E0" strokeWidth="1" />
        </pattern>
      </defs>
      <rect width="1000" height="1400" fill={`url(#${patternId})`} />
      {doc.elements.map((e) =>
        e.type === "stroke"
          ? (
            <path
              key={e.id}
              d={strokePath(e.points)}
              stroke={e.color}
              strokeWidth={e.size}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          )
          : e.type === "text"
          ? (
            <foreignObject
              key={e.id}
              x={e.x}
              y={e.y}
              width={e.width}
              height={e.height}
            >
              <div
                style={{
                  fontSize: e.size,
                  color: e.color,
                  whiteSpace: "pre-wrap",
                  overflowWrap: "anywhere",
                  lineHeight: 1.35,
                }}
              >
                {e.text}
              </div>
            </foreignObject>
          )
          : (() => {
            const im = images.find((i) => i.source_id === e.sourceId);
            return im
              ? (
                <svg
                  key={e.id}
                  x={e.x}
                  y={e.y}
                  width={e.width}
                  height={e.height}
                  viewBox={`${e.crop.x * im.width} ${e.crop.y * im.height} ${
                    e.crop.width * im.width
                  } ${e.crop.height * im.height}`}
                  preserveAspectRatio="xMidYMid meet"
                >
                  <image
                    href={"data:image/png;base64," + im.png}
                    width={im.width}
                    height={im.height}
                  />
                </svg>
              )
              : (
                <g key={e.id}>
                  <rect
                    x={e.x}
                    y={e.y}
                    width={e.width}
                    height={e.height}
                    fill="#FFF1DD"
                  />
                  <text x={e.x + 10} y={e.y + 30} fontSize="24">
                    Kaynak görsel açılamadı
                  </text>
                </g>
              );
          })()
      )}
    </svg>
  );
}

/** Keep the original page geometry, with an accessible native zoom dialog. */
export function CohortNotebookViewer(
  { value, images }: { value: unknown; images: CohortImage[] },
) {
  const dialog = useRef<HTMLDialogElement>(null);
  return (
    <>
      {readNotebook(value)?.elements.length
        ? (
          <button
            className="btn-secondary mb-3"
            onClick={() => dialog.current?.showModal()}
          >
            Defteri büyüt
          </button>
        )
        : null}
      <CohortNotebook value={value} images={images} />
      <dialog
        ref={dialog}
        aria-label="Çözüm defteri · büyük görünüm"
        className="fixed inset-0 m-auto max-h-[95dvh] w-[min(96vw,1000px)] max-w-none overflow-auto rounded-3xl bg-[#FFFCF6] p-4 shadow-2xl backdrop:bg-[#201951]/50"
      >
        <div className="sticky top-0 z-10 mb-3 flex items-center justify-between gap-3 rounded-2xl bg-[#FFFCF6] p-3">
          <strong>Çocuğun özgün çözüm defteri</strong>
          <button
            autoFocus
            className="btn-secondary"
            onClick={() => dialog.current?.close()}
          >
            Kapat
          </button>
        </div>
        <CohortNotebook value={value} images={images} />
      </dialog>
    </>
  );
}
