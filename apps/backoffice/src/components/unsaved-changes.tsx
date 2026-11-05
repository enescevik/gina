import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";

/** The same leave decision protects local actions, navigation, back and sign-out. */
export function useUnsavedChanges(dirty: boolean, busy = false) {
  const router = useRouter();
  const state = useRef({ dirty, busy });
  useEffect(() => {
    state.current = { dirty, busy };
  }, [dirty, busy]);
  const [leave, setLeave] = useState<(() => void) | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const request = (action: () => void) => {
    if (state.current.busy) return;
    if (state.current.dirty) setLeave(() => action);
    else action();
  };
  useEffect(() => {
    const unload = (e: BeforeUnloadEvent) => {
      if (state.current.dirty || state.current.busy) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    const click = (e: MouseEvent) => {
      const a = (e.target as Element)?.closest?.("a[href]") as
        | HTMLAnchorElement
        | null;
      if (
        !a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey ||
        e.shiftKey || e.altKey || a.target === "_blank" ||
        (!state.current.dirty && !state.current.busy)
      ) return;
      e.preventDefault();
      e.stopPropagation();
      if (!state.current.busy) {
        setLeave(() => () => {
          void router.push(a.href);
        });
      }
    };
    const signOut = (e: Event) => {
      if (!state.current.dirty && !state.current.busy) return;
      e.preventDefault();
      if (!state.current.busy) {
        setLeave(() => (e as CustomEvent<() => void>).detail);
      }
    };
    router.beforePopState(({ as }) => {
      if (!state.current.dirty && !state.current.busy) return true;
      window.history.pushState(window.history.state, "", router.asPath);
      if (!state.current.busy) {
        setLeave(() => () => {
          void router.push(as);
        });
      }
      return false;
    });
    window.addEventListener("beforeunload", unload);
    window.addEventListener("gina:signout", signOut);
    document.addEventListener("click", click, true);
    return () => {
      router.beforePopState(() => true);
      window.removeEventListener("beforeunload", unload);
      window.removeEventListener("gina:signout", signOut);
      document.removeEventListener("click", click, true);
    };
  }, [router]);
  useEffect(() => {
    if (leave && !dialog.current?.open) dialog.current?.showModal();
    else if (!leave && dialog.current?.open) dialog.current.close();
  }, [leave]);
  return {
    request,
    dialog: (
      <dialog
        ref={dialog}
        aria-labelledby="unsaved-title"
        onCancel={(e) => {
          e.preventDefault();
          if (!busy) setLeave(null);
        }}
        className="m-auto w-[calc(100%_-_2rem)] max-w-lg rounded-3xl bg-[#FCFAF5] p-6 text-[#201951] shadow-xl backdrop:bg-[#201951]/30"
      >
        <h2 id="unsaved-title" className="text-xl font-bold">
          Değişiklikler henüz kaydedilmedi
        </h2>
        <p className="my-4">
          Ayrılırsanız bu ekrandaki değişiklikler silinir. Kaydetmek için
          düzenlemeye dönebilirsiniz.
        </p>
        <div className="flex flex-wrap gap-3">
          <button
            autoFocus
            type="button"
            className="btn"
            disabled={busy}
            onClick={() => setLeave(null)}
          >
            Düzenlemeye dön
          </button>
          <button
            type="button"
            className="btn-secondary"
            disabled={busy}
            onClick={() => {
              const action = leave;
              state.current.dirty = false;
              setLeave(null);
              action?.();
            }}
          >
            Değişiklikleri bırak ve devam et
          </button>
        </div>
      </dialog>
    ),
  };
}
