import { Redirect, useLocalSearchParams } from "expo-router";
/** Preserve links from existing scenario/group tools; all preparation uses one workspace. */
export default function ExamCreateScreen() {
  const { groupId } = useLocalSearchParams<{ groupId?: string }>();
  return (
    <Redirect
      href={{
        pathname: "/parent/prova/builder",
        params: groupId ? { groupId } : {},
      }}
    />
  );
}
