import { describe, expect, it } from "vitest";
import {
  emptyNotebook,
  moveElements,
  type NotebookDocument,
  notebookHasAnswer,
  notebookSchema,
  readNotebook,
  strokeNear,
} from "./notebook";
const id = "10000000-0000-4000-8000-000000000001";
const doc: NotebookDocument = {
  ...emptyNotebook(),
  elements: [{
    id,
    type: "stroke",
    color: "#201951",
    size: 4,
    points: [[10, 20], [100, 20]],
  }],
};
describe("editable notebook", () => {
  it("preserves raw coordinates through validation and JSON round trip", () =>
    expect(readNotebook(JSON.parse(JSON.stringify(doc)))).toEqual(doc));
  it("rejects duplicate IDs, unknown executable payloads, invalid coordinates and unknown versions", () => {
    expect(
      readNotebook({ ...doc, elements: [...doc.elements, ...doc.elements] }),
    ).toBeNull();
    expect(readNotebook({ ...doc, html: "<script/>" })).toBeNull();
    expect(readNotebook({ ...doc, version: 2 })).toBeNull();
    expect(
      readNotebook({
        ...doc,
        elements: [{ ...doc.elements[0], points: [[Infinity, 0]] }],
      }),
    ).toBeNull();
  });
  it("clamps a selected group together, without changing its proportions or the original", () => {
    const moved = moveElements(doc, [id], -50, 2000);
    expect(moved.elements[0]).toMatchObject({
      points: [[0, 1400], [90, 1400]],
    });
    expect(doc.elements[0]).toMatchObject({ points: [[10, 20], [100, 20]] });
  });
  it("erases near a segment even between sparsely sampled points", () => {
    expect(strokeNear(doc.elements[0]!, [50, 22], 3)).toBe(true);
    expect(strokeNear(doc.elements[0]!, [50, 40], 3)).toBe(false);
  });
  it("does not count a copied question as a solution", () => {
    expect(notebookHasAnswer(emptyNotebook())).toBe(false);
    expect(notebookHasAnswer(doc)).toBe(true);
    const source = {
      ...emptyNotebook(),
      elements: [{
        id,
        type: "source" as const,
        sourceId: id,
        questionId: id,
        x: 0,
        y: 0,
        width: 200,
        height: 200,
        alt: "Diagram",
        crop: { x: 0, y: 0, width: 1, height: 1 },
      }],
    };
    expect(notebookSchema.safeParse(source).success).toBe(true);
    expect(notebookHasAnswer(source)).toBe(false);
    expect(
      readNotebook({
        ...source,
        elements: [{
          ...source.elements[0],
          crop: { x: .8, y: 0, width: .3, height: 1 },
        }],
      }),
    ).toBeNull();
  });
  it("limits page size and disallows remote URLs masquerading as source IDs", () => {
    expect(
      readNotebook({
        ...doc,
        elements: Array.from({ length: 301 }, () => doc.elements[0]),
      }),
    ).toBeNull();
    expect(
      readNotebook({
        ...doc,
        elements: [{
          id,
          type: "source",
          sourceId: "https://attacker.test",
          questionId: id,
          x: 0,
          y: 0,
          width: 100,
          height: 100,
          crop: { x: 0, y: 0, width: 1, height: 1 },
          alt: "",
        }],
      }),
    ).toBeNull();
  });
});

it("keeps placed images proportional when resized and refuses to push them off page", async () => {
  const { resizeNotebookItem } = await import("./notebook");
  const source = {
    ...emptyNotebook(),
    elements: [{
      id,
      type: "source" as const,
      sourceId: id,
      questionId: id,
      x: 80,
      y: 80,
      width: 400,
      height: 200,
      alt: "Diagram",
      crop: { x: 0, y: 0, width: 1, height: 1 },
    }],
  };
  expect(resizeNotebookItem(source, id, .5)?.elements[0]).toMatchObject({
    width: 200,
    height: 100,
    crop: { x: 0, y: 0, width: 1, height: 1 },
  });
  expect(resizeNotebookItem(source, id, 4)).toBeNull();
  expect(resizeNotebookItem(source, id, NaN)).toBeNull();
});
