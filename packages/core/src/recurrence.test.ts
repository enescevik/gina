import { describe, expect, it } from "vitest";

import { isoWeekdayOf, templatesDueOn, weekDatesOf } from "./recurrence";

const base = { starts_on: "2026-11-02", ends_on: null, active: true };

describe("isoWeekdayOf", () => {
  it("Pazartesi 1, Pazar 7 döndürür", () => {
    expect(isoWeekdayOf("2026-11-02")).toBe(1); // Pazartesi
    expect(isoWeekdayOf("2026-11-08")).toBe(7); // Pazar
  });
});

describe("templatesDueOn", () => {
  const templates = [
    { id: "hafta-ici", days_of_week: [1, 2, 3, 4, 5], ...base },
    { id: "hafta-sonu", days_of_week: [6, 7], ...base },
    { id: "pasif", days_of_week: [1, 2, 3, 4, 5, 6, 7], ...base, active: false },
    { id: "bitmis", days_of_week: [1, 2, 3, 4, 5, 6, 7], ...base, ends_on: "2026-11-03" },
    { id: "baslamamis", days_of_week: [1, 2, 3, 4, 5, 6, 7], ...base, starts_on: "2026-12-01" },
  ];

  it("hafta içi yalnız hafta içi şablonunu getirir", () => {
    expect(templatesDueOn(templates, "2026-11-04").map((t) => t.id)).toEqual(["hafta-ici"]);
  });

  it("bitiş tarihi dahildir, pasif ve başlamamış şablonlar düşmez", () => {
    expect(templatesDueOn(templates, "2026-11-03").map((t) => t.id)).toEqual(["hafta-ici", "bitmis"]);
  });

  it("hafta sonu yalnız hafta sonu şablonunu getirir", () => {
    expect(templatesDueOn(templates, "2026-11-07").map((t) => t.id)).toEqual(["hafta-sonu"]);
  });
});

describe("weekDatesOf", () => {
  it("Pazartesi'den Pazar'a yedi gün döndürür", () => {
    expect(weekDatesOf("2026-11-05")).toEqual([
      "2026-11-02",
      "2026-11-03",
      "2026-11-04",
      "2026-11-05",
      "2026-11-06",
      "2026-11-07",
      "2026-11-08",
    ]);
  });
});
