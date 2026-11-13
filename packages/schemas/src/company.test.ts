import { describe, expect, it } from "vitest";
import { DEFAULT_ACCENT, DEFAULT_COMPANY, buildCompanyView, contrastWithWhite, deriveAccent, publicCompanySchema, safeHttpUrl, whatsappDigits } from "./company";

describe("whatsappDigits", () => {
  it("acrescenta 55 e aceita numero com mascara", () => {
    expect(whatsappDigits("(22) 99615-0138")).toBe("5522996150138");
    expect(whatsappDigits("22 2762-1234")).toBe("552227621234");
    expect(whatsappDigits("+55 22 99615-0138")).toBe("5522996150138");
    expect(whatsappDigits("")).toBe("");
    expect(whatsappDigits("123")).toBe("");
  });
});

describe("buildCompanyView", () => {
  it("sem configuracao usa o padrao da instalacao", () => {
    const v = buildCompanyView(null, "https://x.supabase.co");
    expect(v.configured).toBe(false);
    expect(v.name).toBe("Olimach");
    expect(v.whatsappDigits).toBe("5522996150138");
    expect(v.logoUrl).toBeNull();
    expect(v.fullAddress).toBe("Macaé, RJ");
  });

  it("monta endereco, cidade e arquivos publicos", () => {
    const row = publicCompanySchema.parse({
      company_name: "Acme Treinamentos",
      address: "Rua das Flores",
      number: "100",
      complement: "Sala 2",
      neighborhood: "Centro",
      city: "Macaé",
      state: "RJ",
      postal_code: "27910-170",
      logo_path: "logo-1.png",
      favicon_path: "favicon 1.png",
    });
    const v = buildCompanyView(row, "https://x.supabase.co/");
    expect(v.configured).toBe(true);
    expect(v.addressLine).toBe("Rua das Flores, 100 - Sala 2 - Centro");
    expect(v.fullAddress).toBe("Rua das Flores, 100 - Sala 2 - Centro - Macaé, RJ - CEP 27910-170");
    expect(v.logoUrl).toBe("https://x.supabase.co/storage/v1/object/public/branding/logo-1.png");
    expect(v.faviconUrl).toBe("https://x.supabase.co/storage/v1/object/public/branding/favicon%201.png");
  });

  it("endereco parcial nao deixa separadores soltos", () => {
    const v = buildCompanyView({ ...DEFAULT_COMPANY, address: "Av. Brasil", number: "", neighborhood: "", city: "", state: "" }, null);
    expect(v.addressLine).toBe("Av. Brasil");
    expect(v.fullAddress).toBe("Av. Brasil");
  });
});

describe("cor de destaque", () => {
  it("deriva o tom escuro e os canais RGB", () => {
    const a = deriveAccent("#F28A1E");
    expect(a.base).toBe("#f28a1e");
    expect(a.baseRgb).toBe("242 138 30");
    expect(a.darkRgb).toBe("206 117 26");
    expect(a.dark).toBe("#ce751a");
  });

  it("cor invalida cai no laranja padrao", () => {
    expect(deriveAccent("laranja").base).toBe(DEFAULT_ACCENT);
  });

  it("mede o contraste com texto branco", () => {
    expect(contrastWithWhite("#000000")).toBeGreaterThan(20);
    expect(contrastWithWhite("#ffffff")).toBeCloseTo(1, 1);
    expect(contrastWithWhite("#fde047")).toBeLessThan(3);
    expect(contrastWithWhite("#1e63c7")).toBeGreaterThan(3);
  });

  it("view traz a cor escolhida; valor invalido vira null", () => {
    expect(buildCompanyView(publicCompanySchema.parse({ company_name: "X", accent_color: "#112233" }), null).accentColor).toBe("#112233");
    expect(buildCompanyView(publicCompanySchema.parse({ company_name: "X", accent_color: "azul" }), null).accentColor).toBeNull();
    expect(buildCompanyView(null, null).accentColor).toBeNull();
  });
});

describe("links seguros", () => {
  it("aceita so http(s)", () => {
    expect(safeHttpUrl("https://facebook.com/x")).toBe("https://facebook.com/x");
    expect(safeHttpUrl(" http://x.com ")).toBe("http://x.com");
    for (const bad of ["javascript:alert(1)", "JaVaScRiPt:alert(1)", "data:text/html,x", "//evil.com", "ftp://x", "facebook.com/x", ""]) expect(safeHttpUrl(bad)).toBe("");
  });

  it("a visao da empresa descarta link perigoso vindo da configuracao", () => {
    const v = buildCompanyView(publicCompanySchema.parse({ company_name: "X", facebook: "javascript:alert(1)", website: "https://x.com.br" }), null);
    expect(v.facebook).toBe("");
    expect(v.website).toBe("https://x.com.br");
  });
});
