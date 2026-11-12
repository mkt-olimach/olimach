import { describe, expect, it } from "vitest";
import { courseInputSchema, slugify } from "./index";

const base = {
  slug: "nr-35",
  name: "NR-35 Trabalho em Altura",
  category: "nr" as const,
  nr_code: "NR-35",
  workload_hours: 8,
  theory_hours: 5,
  practice_hours: 3,
  syllabus: "",
  modality: "presencial" as const,
  validity_months: 24,
  active: true,
};

describe("courseInputSchema", () => {
  it("aceita NR com codigo", () => {
    expect(courseInputSchema.safeParse(base).success).toBe(true);
  });

  it("exige que a carga total seja a soma da teorica e da pratica", () => {
    expect(courseInputSchema.safeParse({ ...base, theory_hours: 6 }).success).toBe(false);
    expect(courseInputSchema.safeParse({ ...base, theory_hours: 8, practice_hours: 0 }).success).toBe(true);
    expect(courseInputSchema.safeParse({ ...base, theory_hours: -1, practice_hours: 9 }).success).toBe(false);
  });

  it("exige codigo so para NR", () => {
    expect(courseInputSchema.safeParse({ ...base, nr_code: null }).success).toBe(false);
    expect(courseInputSchema.safeParse({ ...base, category: "profissionalizante" }).success).toBe(false);
    expect(courseInputSchema.safeParse({ ...base, category: "profissionalizante", nr_code: null }).success).toBe(true);
  });

  it("rejeita carga horaria zero e slug invalido", () => {
    expect(courseInputSchema.safeParse({ ...base, workload_hours: 0, theory_hours: 0, practice_hours: 0 }).success).toBe(false);
    expect(courseInputSchema.safeParse({ ...base, slug: "NR 35" }).success).toBe(false);
  });
});

describe("descricao e capa", () => {
  it("assume descricao vazia e sem capa quando omitidas", () => {
    const parsed = courseInputSchema.parse(base);
    expect(parsed.description).toBe("");
    expect(parsed.cover_path).toBeNull();
  });

  it("limita a descricao a 1000 caracteres", () => {
    expect(courseInputSchema.safeParse({ ...base, description: "a".repeat(1000) }).success).toBe(true);
    expect(courseInputSchema.safeParse({ ...base, description: "a".repeat(1001) }).success).toBe(false);
  });
});

describe("slugify", () => {
  it("remove acentos e pontuacao", () => {
    expect(slugify("Movimentação de Cargas")).toBe("movimentacao-de-cargas");
    expect(slugify("  NR-10 / Elétrica ")).toBe("nr-10-eletrica");
  });
});
