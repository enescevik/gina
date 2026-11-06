import { type ReactNode, useCallback, useEffect, useId, useRef, useState } from "react";

/** D3 (Q00-C12-T2): tarayıcının `window.confirm` penceresi yerine uygulama içi, onaylı dilde onay.
 *  `ask()` bir Promise döndürür: "Vazgeç", Esc veya dışarıdan kapatma her zaman `false` demektir. */
export type ConfirmOptions = {
  title: string;
  body: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: "danger" | "default";
};

export function useConfirm() {
  const [open, setOpen] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((v: boolean) => void) | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const finish = useCallback((value: boolean) => {
    resolver.current?.(value);
    resolver.current = null;
    setOpen(null);
  }, []);
  const ask = useCallback((options: ConfirmOptions) => {
    // Açık bir soru varken ikinci soru ilkini "vazgeç" sayar; iki karar üst üste binmez.
    resolver.current?.(false);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
      setOpen(options);
    });
  }, []);
  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (open && !d.open) {
      if (typeof d.showModal === "function") d.showModal();
      else d.setAttribute("open", "");
    } else if (!open && d.open) d.close();
  }, [open]);
  useEffect(() => () => resolver.current?.(false), []);
  const element = (
    <dialog
      ref={dialog}
      aria-labelledby={titleId}
      data-testid="confirm-dialog"
      onCancel={(e) => {
        e.preventDefault();
        finish(false);
      }}
      className="max-w-md rounded-3xl bg-[#fffdf9] p-7 backdrop:bg-black/30"
    >
      {open
        ? (
          <>
            <h3 id={titleId} className="text-lg font-bold text-slate-800">{open.title}</h3>
            <div className="my-4 text-sm text-slate-700">{open.body}</div>
            <div className="flex flex-wrap gap-3">
              <button type="button" className="btn-secondary" autoFocus onClick={() => finish(false)}>
                {open.cancelLabel ?? "Vazgeç"}
              </button>
              <button
                type="button"
                className={open.tone === "danger" ? "btn-danger" : "btn"}
                onClick={() => finish(true)}
              >
                {open.confirmLabel}
              </button>
            </div>
          </>
        )
        : null}
    </dialog>
  );
  return { ask, element };
}
