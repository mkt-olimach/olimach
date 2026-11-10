import { describe, expect, it } from "vitest";
import { classInputSchema } from "./index";

const base = {
  course_id: "7b2f9c1e-3a4d-4e5f-8a6b-1c2d3e4f5a6b",
  start_date: "2026-11-10",
  end_date: "2026-11-12",
  location: "Macaé, RJ",
  status: "planned" as const,
};

describe("classInputSchema", () => {
  it("aceita turma valida", () => {
    expect(classInputSchema.safeParse(base).success).toBe(true);
  });

  it("rejeita data final anterior a inicial", () => {
    const r = classInputSchema.safeParse({ ...base, end_date: "2026-11-09" });
    expect(r.success).toBe(false);
  });

  it("exige curso e local", () => {
    expect(classInputSchema.safeParse({ ...base, course_id: "" }).success).toBe(false);
    expect(classInputSchema.safeParse({ ...base, location: " " }).success).toBe(false);
  });
});
