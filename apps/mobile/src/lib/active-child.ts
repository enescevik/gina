import { useChildMode } from "./child-mode";
import { useSession } from "./session";

export type ChildPage = "today" | "week" | "calendar" | "collection" | "goal" | "room-preview" | "prova";
export function childPath(page: ChildPage, actingAsParent = false) {
  return actingAsParent ? `/parent/child-mode/${page}` as const : `/child/${page}` as const;
}
export function useActiveChild() {
  const { claims } = useSession();
  const { actingChild } = useChildMode();
  const actingAsParent = claims?.role === "parent" && !!actingChild;
  return {
    childId: actingAsParent ? actingChild.id : claims?.child_id ?? "",
    familyId: claims?.family_id ?? "",
    actingAsParent,
    path: (page: ChildPage) => childPath(page, actingAsParent),
  };
}
