import { describe, expect, it } from "vitest";
import { resolveSiteUrl } from "./site-url";

const https = (host: string) => ({ protocol: "https:", host });

describe("resolveSiteUrl", () => {
  it("usa VITE_SITE_URL quando definida, sem barra final", () => {
    expect(resolveSiteUrl("https://www.olimach.com.br/", https("admin.olimach.com.br"))).toBe("https://www.olimach.com.br");
  });
  it("deduz o dominio raiz a partir de admin.<dominio>", () => {
    expect(resolveSiteUrl(undefined, https("admin.olimach.com.br"))).toBe("https://olimach.com.br");
  });
  it("deduz o site a partir de <projeto>-admin.vercel.app", () => {
    expect(resolveSiteUrl("", https("olimach-admin.vercel.app"))).toBe("https://olimach-site.vercel.app");
  });
  it("devolve vazio quando nao consegue deduzir (ex.: localhost)", () => {
    expect(resolveSiteUrl(undefined, { protocol: "http:", host: "localhost:5174" })).toBe("");
  });
});
