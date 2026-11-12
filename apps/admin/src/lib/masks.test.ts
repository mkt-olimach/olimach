import { describe, expect, it } from "vitest";
import { isCepComplete, isPhoneComplete, maskCep, maskPhone } from "./masks";

describe("maskPhone", () => {
  it("formata fixo e celular enquanto digita", () => {
    expect(maskPhone("")).toBe("");
    expect(maskPhone("2")).toBe("(2");
    expect(maskPhone("229")).toBe("(22) 9");
    expect(maskPhone("2299615")).toBe("(22) 9961-5");
    expect(maskPhone("2227621234")).toBe("(22) 2762-1234");
    expect(maskPhone("22996150138")).toBe("(22) 99615-0138");
  });

  it("ignora letras e limita a 11 digitos", () => {
    expect(maskPhone("(22) 99615-0138 ramal 9")).toBe("(22) 99615-0138");
    expect(maskPhone("abc")).toBe("");
  });

  it("reconhece telefone completo", () => {
    expect(isPhoneComplete("(22) 2762-1234")).toBe(true);
    expect(isPhoneComplete("(22) 99615-0138")).toBe(true);
    expect(isPhoneComplete("(22) 9961")).toBe(false);
  });
});

describe("maskCep", () => {
  it("formata 00000-000", () => {
    expect(maskCep("27910")).toBe("27910");
    expect(maskCep("27910170")).toBe("27910-170");
    expect(maskCep("27910-17099")).toBe("27910-170");
    expect(isCepComplete("27910-170")).toBe(true);
    expect(isCepComplete("27910")).toBe(false);
  });
});
