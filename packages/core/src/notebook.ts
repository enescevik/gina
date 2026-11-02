import { z } from "zod";

// Fixed logical coordinates preserve handwriting and crop alignment across devices.
export const NOTEBOOK_WIDTH = 1000;
export const NOTEBOOK_HEIGHT = 1400;
export const NOTEBOOK_COLORS = [
  "#201951",
  "#6042DE",
  "#227D73",
  "#BA5348",
] as const;
const point = z.tuple([
  z.number().min(0).max(1000),
  z.number().min(0).max(1400),
]);
const frame = {
  x: z.number().min(0).max(950),
  y: z.number().min(0).max(1350),
  width: z.number().min(40).max(1000),
  height: z.number().min(40).max(1400),
};
const color = z.enum(NOTEBOOK_COLORS);
const id = z.string().uuid();
const element = z.discriminatedUnion("type", [
  z.object({
    id,
    type: z.literal("stroke"),
    color,
    size: z.number().min(1).max(20),
    points: z.array(point).min(1).max(2000),
  }).strict(),
  z.object({
    id,
    type: z.literal("text"),
    ...frame,
    text: z.string().max(2000),
    color,
    size: z.number().min(16).max(64),
  }).strict(),
  z.object({
    id,
    type: z.literal("source"),
    ...frame,
    sourceId: id,
    questionId: id,
    alt: z.string().max(500),
    crop: z.object({
      x: z.number().min(0).max(1),
      y: z.number().min(0).max(1),
      width: z.number().positive().max(1),
      height: z.number().positive().max(1),
    }).strict(),
  }).strict(),
]).superRefine((e, ctx) => {
  if (e.type !== "stroke" && (e.x + e.width > 1000 || e.y + e.height > 1400)) {
    ctx.addIssue({ code: "custom", message: "outside_page" });
  }
  if (
    e.type === "source" &&
    (e.crop.x + e.crop.width > 1.000001 || e.crop.y + e.crop.height > 1.000001)
  ) ctx.addIssue({ code: "custom", message: "outside_source" });
});
export const notebookSchema = z.object({
  version: z.literal(1),
  width: z.literal(1000),
  height: z.literal(1400),
  elements: z.array(element).max(300),
}).strict().superRefine((doc, ctx) => {
  if (new Set(doc.elements.map((e) => e.id)).size !== doc.elements.length) {
    ctx.addIssue({ code: "custom", message: "duplicate_element" });
  }
  if (JSON.stringify(doc).length > 500_000) {
    ctx.addIssue({ code: "custom", message: "notebook_too_large" });
  }
});
export type NotebookDocument = z.infer<typeof notebookSchema>;
export type NotebookElement = NotebookDocument["elements"][number];
export type NotebookPoint = [number, number];
export const emptyNotebook = (): NotebookDocument => ({
  version: 1,
  width: 1000,
  height: 1400,
  elements: [],
});
export function readNotebook(value: unknown): NotebookDocument | null {
  const parsed = notebookSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}
export function notebookHasAnswer(doc?: NotebookDocument | null) {
  // Copying the question alone is not the student's answer.
  return !!doc?.elements.some((e) =>
    e.type === "stroke" || e.type === "text" && e.text.trim()
  );
}
export function elementBounds(e: NotebookElement) {
  if (e.type !== "stroke") {
    return { x: e.x, y: e.y, width: e.width, height: e.height };
  }
  const xs = e.points.map((p) => p[0]), ys = e.points.map((p) => p[1]);
  const x = Math.min(...xs), y = Math.min(...ys);
  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
}
export function moveElements(
  doc: NotebookDocument,
  ids: string[],
  dx: number,
  dy: number,
): NotebookDocument {
  const bounds = doc.elements.filter((e) => ids.includes(e.id)).map(
    elementBounds,
  );
  if (!bounds.length) return doc;
  dx = Math.max(
    -Math.min(...bounds.map((b) => b.x)),
    Math.min(dx, 1000 - Math.max(...bounds.map((b) => b.x + b.width))),
  );
  dy = Math.max(
    -Math.min(...bounds.map((b) => b.y)),
    Math.min(dy, 1400 - Math.max(...bounds.map((b) => b.y + b.height))),
  );
  return {
    ...doc,
    elements: doc.elements.map((e) =>
      !ids.includes(e.id) ? e : e.type === "stroke"
        ? {
          ...e,
          points: e.points.map(([x, y]) => [x + dx, y + dy] as NotebookPoint),
        }
        : { ...e, x: e.x + dx, y: e.y + dy }
    ),
  };
}
export function strokePath(points: NotebookPoint[]): string {
  if (!points.length) return "";
  if (points.length === 1) return `M${points[0]![0]} ${points[0]![1]}l.01 .01`;
  let path = `M${points[0]![0]} ${points[0]![1]}`;
  for (let i = 1; i < points.length - 1; i++) {
    const p = points[i]!, next = points[i + 1]!;
    path += `Q${p[0]} ${p[1]} ${(p[0] + next[0]) / 2} ${(p[1] + next[1]) / 2}`;
  }
  const last = points.at(-1)!;
  return `${path}L${last[0]} ${last[1]}`;
}
export function strokeNear(
  e: NotebookElement,
  p: NotebookPoint,
  radius: number,
): boolean {
  if (e.type !== "stroke") return false;
  return e.points.some((a, i) => {
    const b = e.points[i + 1] ?? a, dx = b[0] - a[0], dy = b[1] - a[1];
    const t = Math.max(
      0,
      Math.min(
        1,
        ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy || 1),
      ),
    );
    return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy) <=
      radius + e.size / 2;
  });
}

/** Place newly copied material in free space rather than hiding an existing solution. */
export function insertNotebookElement(
  doc: NotebookDocument,
  element: NotebookElement,
): NotebookDocument | null {
  if (element.type === "stroke") return null;
  const bounds = doc.elements.map(elementBounds);
  for (let y = 80; y + element.height <= 1400; y += 40) {
    const box = { ...element, y };
    if (
      bounds.some((b) =>
        box.x < b.x + b.width + 20 && box.x + box.width + 20 > b.x &&
        box.y < b.y + b.height + 20 && box.y + box.height + 20 > b.y
      )
    ) continue;
    const next = { ...doc, elements: [...doc.elements, box] };
    return notebookSchema.safeParse(next).success ? next : null;
  }
  return null;
}

/** Resizes a single placed item without stretching its source crop or changing its identity. */
export function resizeNotebookItem(
  doc: NotebookDocument,
  id: string,
  factor: number,
): NotebookDocument | null {
  if (!Number.isFinite(factor) || factor <= 0) return null;
  const e = doc.elements.find((item) => item.id === id);
  if (!e || e.type === "stroke") return null;
  const resized = {
    ...e,
    width: e.width * factor,
    height: e.height * factor,
    ...(e.type === "text" ? { size: e.size * factor } : {}),
  };
  const next = {
    ...doc,
    elements: doc.elements.map((item) => item.id === id ? resized : item),
  };
  return notebookSchema.safeParse(next).success ? next : null;
}
