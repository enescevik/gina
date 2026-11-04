import { randomUUID } from "expo-crypto";
import {
  BLUEPRINT_PREFIX,
  CATALOG_BLUEPRINT_PREFIX,
  CONTRIBUTION_PREFIX,
  createBlueprintJournal,
  createCatalogBlueprintJournal,
  createContributionJournal,
  createProvaGenerationJournal,
  createSetupAiJournal,
  createSetupJournal,
  PROVA_GENERATION_PREFIX,
  SETUP_AI_PREFIX,
  SETUP_COMMAND_PREFIX,
} from "@gina/core";
import { deviceRecordStorage as store } from "./device-record-storage";
import { supabase } from "./supabase";

let generation = 0;
export function clearSetupCommands() {
  generation++;
  for (
    const key of store.keys().filter((k) =>
      k.startsWith(SETUP_COMMAND_PREFIX) || k.startsWith(SETUP_AI_PREFIX) ||
      k.startsWith(PROVA_GENERATION_PREFIX) || k.startsWith(BLUEPRINT_PREFIX) ||
      k.startsWith(CATALOG_BLUEPRINT_PREFIX) ||
      k.startsWith(CONTRIBUTION_PREFIX)
    )
  ) store.remove(key);
}
export function setupJournal(
  user: string,
  family: string,
  kind: "task" | "reward",
  child: string | null,
) {
  const active = generation;
  return createSetupJournal({
    store,
    user,
    family,
    kind,
    child,
    id: randomUUID,
    guard() {
      if (generation !== active) throw Error("setup_session_changed");
    },
    async send(command) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 20000);
      try {
        return await supabase.rpc("save_setup_batch", {
          ...command,
          p_child_id: command.p_child_id ?? undefined,
        }).abortSignal(controller.signal);
      } finally {
        clearTimeout(timer);
      }
    },
  });
}

export function setupAiJournal(
  user: string,
  family: string,
  kind: "task" | "reward",
  context: string,
) {
  const active = generation;
  return createSetupAiJournal({
    store,
    user,
    family,
    kind,
    context,
    id: randomUUID,
    guard() {
      if (generation !== active) throw Error("setup_session_changed");
    },
  });
}

export function blueprintJournal(user: string, family: string) {
  const active = generation;
  return createBlueprintJournal({
    store,
    user,
    family,
    id: randomUUID,
    guard() {
      if (active !== generation) throw Error("setup_session_changed");
    },
    async send(command) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 20000);
      try {
        return await supabase.rpc("save_family_blueprint", command).abortSignal(
          controller.signal,
        );
      } finally {
        clearTimeout(timer);
      }
    },
  });
}

export function contributionJournal(user: string, family: string) {
  const active = generation;
  return createContributionJournal({
    store,
    user,
    family,
    id: randomUUID,
    guard() {
      if (active !== generation) throw Error("setup_session_changed");
    },
    async send(command) {
      const { data, error } = await supabase.functions.invoke(
        "contribution-submit",
        { body: command, timeout: 30000 },
      );
      if (error) {
        let code = "contribution_failed";
        try {
          code = (await error.context?.json())?.error ?? code;
        } catch {}
        throw Error(code);
      }
      if (data?.error) throw Error(data.error);
      return data;
    },
  });
}

export function catalogBlueprintJournal(user: string, family: string) {
  const active = generation;
  return createCatalogBlueprintJournal({
    store,
    user,
    family,
    id: randomUUID,
    guard() {
      if (active !== generation) throw Error("setup_session_changed");
    },
    async send(command) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 20000);
      try {
        return await supabase.rpc("save_catalog_blueprint", command)
          .abortSignal(
            controller.signal,
          );
      } finally {
        clearTimeout(timer);
      }
    },
  });
}

export function provaGenerationJournal(
  user: string,
  family: string,
  draft: string,
) {
  const active = generation;
  return createProvaGenerationJournal({
    store,
    user,
    family,
    draft,
    id: randomUUID,
    guard() {
      if (active !== generation) throw Error("setup_session_changed");
    },
  });
}
