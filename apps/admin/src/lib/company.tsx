import { buildCompanyView, publicCompanySchema } from "@olimach/schemas";
import type { CompanyView } from "@olimach/schemas";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { supabase } from "./supabase";

const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.replace(/\/$/, "") ?? null;
const DEFAULT_TITLE = "Olimach Admin";

interface CompanyState {
  company: CompanyView;
  /** Recarrega os dados (use depois de salvar no modulo White Label). */
  reload: () => Promise<void>;
}

const CompanyContext = createContext<CompanyState>({ company: buildCompanyView(null, url), reload: async () => {} });

function applyHead(company: CompanyView) {
  document.title = company.name === "Olimach" ? DEFAULT_TITLE : `${company.name} Admin`;
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
}

/** Dados da empresa do modulo White Label (RPC publica: serve tambem para a tela de login). */
export function CompanyProvider({ children }: { children: ReactNode }) {
  const [company, setCompany] = useState<CompanyView>(() => buildCompanyView(null, url));

  const reload = useCallback(async () => {
    if (!supabase) return;
    const { data, error } = await supabase.rpc("public_company");
    if (error) return; // sem a migracao ou sem rede: segue com o padrao
    const parsed = publicCompanySchema.array().safeParse(data);
    const row = parsed.success ? parsed.data[0] : undefined;
    if (row) {
      const view = buildCompanyView(row, url);
      setCompany(view);
      applyHead(view);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const value = useMemo(() => ({ company, reload }), [company, reload]);
  return <CompanyContext.Provider value={value}>{children}</CompanyContext.Provider>;
}

export const useCompany = (): CompanyState => useContext(CompanyContext);
