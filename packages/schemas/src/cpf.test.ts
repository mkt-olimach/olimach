import { describe, expect, it } from "vitest";
import { isValidCpf, maskCpf, onlyDigits } from "./cpf";

describe("cpf", () => {
  it("valida CPF correto com ou sem pontuacao", () => {
    expect(isValidCpf("529.982.247-25")).toBe(true);
    expect(isValidCpf("52998224725")).toBe(true);
  });

  it("rejeita digito verificador errado, tamanho errado e sequencias", () => {
    expect(isValidCpf("529.982.247-26")).toBe(false);
    expect(isValidCpf("123")).toBe(false);
    expect(isValidCpf("111.111.111-11")).toBe(false);
  });

  it("mascara no formato ***.456.789-**", () => {
    expect(maskCpf("12345678901")).toBe("***.456.789-**");
    expect(maskCpf("123.456.789-01")).toBe("***.456.789-**");
  });

  it("onlyDigits remove pontuacao", () => {
    expect(onlyDigits("123.456.789-01")).toBe("12345678901");
  });
});
