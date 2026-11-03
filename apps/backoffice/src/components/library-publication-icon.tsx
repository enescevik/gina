import type { ReactNode } from "react";

export type PublicationIconName =
  | "document"
  | "layers"
  | "school"
  | "check"
  | "lock"
  | "eye"
  | "info"
  | "family"
  | "chat"
  | "idea"
  | "grid"
  | "back";
const paths: Record<PublicationIconName, ReactNode> = {
  chat: <path d="M21 11a8 8 0 0 1-8 8H6l-4 3V7a5 5 0 0 1 5-5h6a8 8 0 0 1 8 9ZM7 8h9M7 12h6" />,
  idea: <><path d="M9 18v-2a6 6 0 1 1 6 0v2M9 18h6M10 22h4M12 1V0M3 4 1 2M21 4l2-2" /></>,
  grid: <><rect x="3" y="3" width="7" height="7" rx="2" /><rect x="14" y="3" width="7" height="7" rx="2" /><rect x="3" y="14" width="7" height="7" rx="2" /><rect x="14" y="14" width="7" height="7" rx="2" /></>,
  document: (
    <>
      <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9Z" />
      <path d="M14 3v6h6M8 13h8M8 17h6M8 8h2" />
    </>
  ),
  layers: (
    <>
      <path d="m12 3 10 6-10 6L2 9Z" />
      <path d="m2 13 10 6 10-6M2 17l10 6 10-6" />
    </>
  ),
  school: (
    <>
      <path d="m2 8 10-5 10 5-10 5Z" />
      <path d="M6 10v7c3 3 9 3 12 0v-7M22 8v9" />
    </>
  ),
  check: <path d="m5 12 4 4L19 6" />,
  lock: (
    <>
      <rect x="5" y="10" width="14" height="11" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3" />
    </>
  ),
  eye: (
    <>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v6M12 7v.1" />
    </>
  ),
  family: (
    <>
      <circle cx="12" cy="7" r="3" />
      <path d="M6 21v-3a6 6 0 0 1 12 0v3M4 5a3 3 0 0 0 0 6M20 5a3 3 0 0 1 0 6M2 20v-3a4 4 0 0 1 3-4M22 20v-3a4 4 0 0 0-3-4" />
    </>
  ),
  back: <path d="m10 5-7 7 7 7M3 12h18" />,
};
export function PublicationIcon({ name }: { name: PublicationIconName }) {
  return (
    <svg
      className="publication-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {paths[name]}
    </svg>
  );
}
