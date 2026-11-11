/**
 * Endereco publico do site (usado no link de validacao). VITE_SITE_URL tem prioridade.
 * Sem ela, deduz pelo endereco do painel: admin.<dominio> -> <dominio> e <projeto>-admin.vercel.app -> <projeto>-site.vercel.app.
 */
export function resolveSiteUrl(envValue: string | undefined, location: { protocol: string; host: string }): string {
  const fromEnv = (envValue ?? "").trim().replace(/\/$/, "");
  if (fromEnv) return fromEnv;
  const { protocol, host } = location;
  if (/^admin\./.test(host)) return `${protocol}//${host.replace(/^admin\./, "")}`;
  if (/-admin\./.test(host)) return `${protocol}//${host.replace(/-admin\./, "-site.")}`;
  return "";
}

export const SITE_URL = resolveSiteUrl(
  import.meta.env.VITE_SITE_URL as string | undefined,
  typeof window === "undefined" ? { protocol: "https:", host: "" } : window.location,
);
