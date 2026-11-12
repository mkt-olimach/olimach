import { DEFAULT_COMPANY, buildCompanyView, publicCompanySchema } from "@olimach/schemas";
import type { CompanyView } from "@olimach/schemas";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.replace(/\/$/, "") ?? null;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

const CompanyContext = createContext<CompanyView>(buildCompanyView(null, url));

/** Dados da empresa cadastrados no modulo White Label (RPC public.public_company). */
async function fetchCompany(signal: AbortSignal): Promise<CompanyView | null> {
  if (!url || !anonKey) return null;
  const response = await fetch(`${url}/rest/v1/rpc/public_company`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: anonKey, Authorization: `Bearer ${anonKey}` },
    body: "{}",
    signal,
  });
  if (!response.ok) throw new Error(`public_company ${response.status}`);
  const rows = publicCompanySchema.array().parse(await response.json());
  return rows[0] ? buildCompanyView(rows[0], url) : null;
}

const DEFAULT_NAME = DEFAULT_COMPANY.company_name;

/** Aplica favicon, titulo e dados estruturados da empresa no <head>. */
function applyHead(company: CompanyView) {
  if (company.faviconUrl) {
    let link = document.querySelector<HTMLLinkElement>('link[rel~="icon"]');
    if (!link) {
      link = document.createElement("link");
      link.rel = "icon";
      document.head.appendChild(link);
    }
    link.removeAttribute("type");
    link.href = company.faviconUrl;
  }
  if (company.name !== DEFAULT_NAME) {
    document.title = document.title.replace(DEFAULT_NAME, company.name);
    document.querySelector('meta[property="og:site_name"]')?.setAttribute("content", company.name);
    const ogTitle = document.querySelector('meta[property="og:title"]');
    ogTitle?.setAttribute("content", (ogTitle.getAttribute("content") ?? "").replace(DEFAULT_NAME, company.name));
  }
  const ld = document.querySelector('script[type="application/ld+json"]');
  if (ld?.textContent) {
    try {
      const data = JSON.parse(ld.textContent) as Record<string, unknown>;
      data.name = company.name;
      if (company.phone || company.whatsappDigits) data.telephone = company.phone ? `+55${company.phone.replace(/\D/g, "")}` : `+${company.whatsappDigits}`;
      if (company.email) data.email = company.email;
      if (company.website) data.url = company.website;
      data.address = {
        "@type": "PostalAddress",
        ...(company.addressLine ? { streetAddress: company.addressLine } : {}),
        addressLocality: company.cityState.split(", ")[0] ?? "",
        addressRegion: company.cityState.split(", ")[1] ?? "",
        ...(company.postalCode ? { postalCode: company.postalCode } : {}),
        addressCountry: "BR",
      };
      const sameAs = [company.facebook, company.instagram, company.linkedin, company.youtube].filter(Boolean);
      if (sameAs.length) data.sameAs = sameAs;
      ld.textContent = JSON.stringify(data);
    } catch {
      /* JSON-LD estatico invalido: mantem como esta */
    }
  }
}

export function CompanyProvider({ children }: { children: ReactNode }) {
  const [company, setCompany] = useState<CompanyView>(() => buildCompanyView(null, url));

  useEffect(() => {
    const controller = new AbortController();
    fetchCompany(controller.signal)
      .then((view) => {
        if (view) {
          setCompany(view);
          applyHead(view);
        }
      })
      .catch(() => {
        /* sem rede ou sem a migracao: segue com o padrao da instalacao */
      });
    return () => controller.abort();
  }, []);

  return <CompanyContext.Provider value={useMemo(() => company, [company])}>{children}</CompanyContext.Provider>;
}

export const useCompany = (): CompanyView => useContext(CompanyContext);

/** Links de WhatsApp com o numero cadastrado no White Label. */
export function useWhatsapp() {
  const company = useCompany();
  return useMemo(
    () => ({
      available: company.whatsappDigits !== "",
      link: (message: string) => `https://wa.me/${company.whatsappDigits}?text=${encodeURIComponent(message)}`,
      generalMessage: `Olá! Gostaria de mais informações sobre os treinamentos da ${company.name}.`,
      courseMessage: (courseName: string) => `Olá! Gostaria de saber mais sobre o curso ${courseName}.`,
    }),
    [company],
  );
}
