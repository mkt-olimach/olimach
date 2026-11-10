import { describe, expect, it } from "vitest";
import { courseInputSchema, slugify } from "./index";

const base = {
  slug: "nr-35",
  name: "NR-35 Trabalho em Altura",
  category: "nr" as const,
  nr_code: "NR-35",
  workload_hours: 8,
  syllabus: "",
  modality: "presencial" as const,
  validity_months: 24,
  active: true,
};

describe("courseInputSchema", () => {
  it("aceita NR com codigo", () => {
    expect(courseInputSchema.safeParse(base).success).toBe(true);
  });

  it("exige codigo so para NR", () => {
    expect(courseInputSchema.safeParse({ ...base, nr_code: null }).success).toBe(false);
    expect(courseInputSchema.safeParse({ ...base, category: "profissionalizante" }).success).toBe(false);
    expect(courseInputSchema.safeParse({ ...base, category: "profissionalizante", nr_code: null }).success).toBe(true);
  });

  it("rejeita carga horaria zero e slug invalido", () => {
    expect(courseInputSchema.safeParse({ ...base, workload_hours: 0 }).success).toBe(false);
    expect(courseInputSchema.safeParse({ ...base, slug: "NR 35" }).success).toBe(false);
  });
});

describe("slugify", () => {
  it("remove acentos e pontuacao", () => {
    expect(slugify("Movimentação de Cargas")).toBe("movimentacao-de-cargas");
    expect(slugify("  NR-10 / Elétrica ")).toBe("nr-10-eletrica");
  });
});
