import { describe, expect, it } from "vitest";
import { COUNTRIES, composePhone, isNationalValid, parsePhone, phoneToWhatsapp } from "./phone";

const BR = COUNTRIES[0]!;
const PT = COUNTRIES[1]!;

describe("telefone internacional", () => {
  it("compoe e le o numero brasileiro", () => {
    expect(composePhone(BR, "22999998888")).toBe("+55 (22) 99999-8888");
    expect(parsePhone("+55 (22) 99999-8888")).toMatchObject({ country: { iso: "BR" }, national: "(22) 99999-8888" });
  });
  it("cadastro antigo sem pais assume Brasil", () => {
    expect(parsePhone("(22) 99999-8888").country.iso).toBe("BR");
    expect(phoneToWhatsapp("22999998888")).toBe("5522999998888");
  });
  it("outros paises", () => {
    expect(composePhone(PT, "912345678")).toBe("+351 912 345 678");
    expect(parsePhone("+351 912 345 678").country.iso).toBe("PT");
    expect(phoneToWhatsapp("+351 912 345 678")).toBe("351912345678");
  });
  it("valida e recusa incompletos", () => {
    expect(isNationalValid(BR, "(22) 9999")).toBe(false);
    expect(isNationalValid(BR, "(22) 99999-8888")).toBe(true);
    expect(phoneToWhatsapp("+55 (22) 9999")).toBe("");
  });
});
