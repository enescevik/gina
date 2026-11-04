import { z } from "zod";
import type { AnswerJournalStorage } from "./answer-journal";
import { libraryTeacherSchema } from "./library-review";
export const contributionStatus = z.enum([
  "preparing",
  "pending",
  "approved",
  "rejected",
  "withdrawn",
]);
export const contributionSnapshot = z.object({
  title: z.string(),
  body: z.string(),
  grade: z.number().int(),
  subject: z.string(),
  grouped: z.boolean(),
  questions: z.array(z.object({
    key: z.string(),
    grade: z.number(),
    subject: z.string(),
    topic: z.string(),
    kind: z.enum(["multiple_choice", "open_ended"]),
    difficulty: z.string(),
    stem: z.string(),
    choices: z.array(z.object({ key: z.string(), text: z.string() }))
      .nullable(),
    correct_key: z.string().nullable(),
    expected_answer: z.string().nullable(),
    solution: z.string(),
    explanation: z.string().nullable(),
  })),
  images: z.array(
    z.object({
      id: z.uuid(),
      alt: z.string(),
      width: z.number(),
      height: z.number(),
    }),
  ).optional(),
  image_alts: z.array(z.string()).optional(),
});
export type ContributionSnapshot = z.infer<typeof contributionSnapshot>;
export const contributionRow = z.object({
  id: z.uuid(),
  status: contributionStatus,
  title: z.string(),
  subject: z.string(),
  grade: z.number(),
  question_count: z.number(),
  question_id: z.uuid().nullable().optional(),
  created_at: z.string(),
  review_note: z.string().nullable(),
  package_id: z.uuid().nullable().optional(),
});
export const contributionDetail = z.object({
  id: z.uuid(),
  status: contributionStatus,
  package_id: z.uuid().nullable(),
  review_note: z.string().nullable(),
  snapshot: contributionSnapshot,
  media: z.object({
    base64: z.string(),
    sha256: z.string(),
    width: z.number(),
    height: z.number(),
  }).nullable(),
});
export const contributionCommand = z.object({
  id: z.uuid(),
  question_id: z.uuid(),
  rights: z.literal(true),
  no_personal_data: z.literal(true),
}).strict();
export const contributionDecision = z.object({
  request: z.uuid(),
  id: z.uuid(),
  approve: z.boolean(),
  note: z.string().trim().min(3).max(2000),
  teachers: z.record(z.string(), libraryTeacherSchema),
  confirmed: z.literal(true),
}).strict();
export type ContributionDecision = z.infer<typeof contributionDecision>;
export const CONTRIBUTION_PREFIX = "gina:contribution:v2:";
export function createContributionJournal({
  store,
  user,
  family,
  id,
  guard,
  send,
}: {
  store: AnswerJournalStorage;
  user: string;
  family: string;
  id: () => string;
  guard: () => void;
  send: (command: z.infer<typeof contributionCommand>) => Promise<unknown>;
}) {
  const key = CONTRIBUTION_PREFIX + encodeURIComponent(user) + ":" +
    encodeURIComponent(family);
  const read = () => {
    guard();
    z.uuid().parse(user);
    z.uuid().parse(family);
    const raw = store.get(key);
    return raw ? contributionCommand.parse(JSON.parse(raw)) : null;
  };
  return {
    read,
    prepare(question: string) {
      const pending = read();
      if (pending) {
        if (pending.question_id !== question) {
          throw Error("contribution_pending");
        }
        return pending;
      }
      const command = contributionCommand.parse({
        id: id(),
        question_id: question,
        rights: true,
        no_personal_data: true,
      });
      store.set(key, JSON.stringify(command));
      return command;
    },
    async send(command: z.infer<typeof contributionCommand>) {
      if (JSON.stringify(read()) !== JSON.stringify(command)) {
        throw Error("contribution_changed");
      }
      const result = z.object({ id: z.uuid(), status: contributionStatus })
        .parse(await send(command));
      guard();
      if (result.status !== "preparing" && read()?.id === command.id) {
        store.remove(key);
      }
      return result;
    },
  };
}
