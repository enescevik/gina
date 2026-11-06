// H07: caller resolution for content-prereview, kept free of Deno.serve so it can be tested.
// System path: exact x-cron-secret match (constant time) against CONTENT_PREREVIEW_SECRET; an unset secret
// rejects every system call. User path: a real (non-anonymous) user JWT, and the role-gated
// request_content_prereview RPC called AS that user (C07: full admin or content operator) must succeed.
// drain / pilot are never reachable with a user token.
import type { Caller } from "./handler.ts";

export function secretMatches(expected: string | undefined, supplied: string): boolean {
  if (!expected || expected.length !== supplied.length) return false;
  let difference = 0;
  for (let i = 0; i < expected.length; i++) difference |= expected.charCodeAt(i) ^ supplied.charCodeAt(i);
  return difference === 0;
}

export interface CallerDeps {
  /** Value of CONTENT_PREREVIEW_SECRET (undefined when not set). */
  secret: string | undefined;
  /** auth.getUser(token): null when invalid. */
  user(token: string): Promise<{ id: string; is_anonymous?: boolean } | null>;
  /** request_content_prereview as the user; true only when the RPC succeeded and returned data. */
  request(token: string, kind: unknown, id: unknown): Promise<boolean>;
}

export async function resolveCaller(deps: CallerDeps, req: Request, body: Record<string, unknown>): Promise<Caller | null> {
  const cron = req.headers.get("x-cron-secret");
  if (cron !== null) return secretMatches(deps.secret, cron) ? { kind: "system" } : null;
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!token || body.drain === true || body.pilot === true) return null;
  const user = await deps.user(token);
  if (!user || user.is_anonymous) return null;
  if (!await deps.request(token, body.kind, body.id)) return null;
  return { kind: "admin", userId: user.id };
}
