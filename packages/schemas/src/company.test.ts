import { describe, expect, it } from "vitest";
import { DEFAULT_COMPANY, buildCompanyView, publicCompanySchema, whatsappDigits } from "./company";

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
