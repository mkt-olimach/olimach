import { describe, expect, it } from "vitest";
import { emailSchema, newPasswordSchema } from "./index";

describe("newPasswordSchema", () => {
  it("aceita senha com 10+ caracteres, letra e numero", () => {
    expect(newPasswordSchema.safeParse("Senha12345").success).toBe(true);
  });

  it("rejeita curta, sem numero, sem letra e acima de 72", () => {
    expect(newPasswordSchema.safeParse("Curta1").success).toBe(false);
    expect(newPasswordSchema.safeParse("SomenteLetras").success).toBe(false);
    expect(newPasswordSchema.safeParse("1234567890").success).toBe(false);
    expect(newPasswordSchema.safeParse(`a1${"x".repeat(71)}`).success).toBe(false);
  });
});

describe("emailSchema", () => {
  it("valida e apara o e-mail", () => {
    expect(emailSchema.parse("  a@b.com ")).toBe("a@b.com");
    expect(emailSchema.safeParse("nao-e-email").success).toBe(false);
  });
});
