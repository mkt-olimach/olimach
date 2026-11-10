import { describe, expect, it } from "vitest";
import { personInputSchema } from "./index";

describe("personInputSchema", () => {
  it("aceita dados completos e apara espacos", () => {
    const r = personInputSchema.parse({ name: "  Maria Souza ", qualification: "Engenheira", registry: " CREA-RJ 123 " });
    expect(r.name).toBe("Maria Souza");
    expect(r.registry).toBe("CREA-RJ 123");
  });

  it("rejeita campos vazios", () => {
    expect(personInputSchema.safeParse({ name: "Ana", qualification: "", registry: "x" }).success).toBe(false);
    expect(personInputSchema.safeParse({ name: "Ana", qualification: "Eng", registry: " " }).success).toBe(false);
  });
});
