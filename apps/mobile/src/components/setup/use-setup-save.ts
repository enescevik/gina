import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import type { SetupCommand, SetupItem } from "@gina/core";
import { useSession } from "@/lib/session";
import { setupJournal } from "@/lib/setup-command";

export function useSetupSave({ familyId, kind, childId = null, items, onSuccess, onSettled }: {
  familyId: string;
  kind: "task" | "reward";
  childId?: string | null;
  items: () => SetupItem[];
  onSuccess: () => Promise<void>;
  onSettled: () => void;
}) {
  const { session } = useSession();
  const journal = useMemo(() => setupJournal(session?.user.id ?? "", familyId, kind, childId), [session?.user.id, familyId, kind, childId]);
  const [initial] = useState(() => {
    try { return { pending: journal.read(), blocked: false }; }
    catch { return { pending: null, blocked: true }; }
  });
  const [pending, setPending] = useState<SetupCommand | null>(initial.pending);
  const [blocked, setBlocked] = useState(initial.blocked);
  const add = useMutation({
    mutationFn: async () => {
      if (blocked) throw Error("setup_local_unavailable");
      const command = journal.read() ?? journal.prepare(items());
      setPending(command);
      try { await journal.send(command); }
      finally {
        try { setPending(journal.read()); }
        catch { setBlocked(true); }
      }
    },
    onSuccess, onSettled,
  });
  return { add, pending, blocked };
}
