import { cn } from "@olimach/ui";
import { useState } from "react";
import { ActivityTab } from "../components/settings/ActivityTab";
import { AccountTab } from "../components/settings/AccountTab";
import { SignersTab } from "../components/settings/SignersTab";
import { TeamTab } from "../components/settings/TeamTab";
import { PageHeader } from "../components/ui";
import { useAuth } from "../lib/auth";

type Tab = "account" | "signers" | "team" | "activity";

export function Settings() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === "admin";
  const [tab, setTab] = useState<Tab>("account");
  const tabs: Array<{ id: Tab; label: string }> = [
    { id: "account", label: "Minha conta" },
    ...(isAdmin
      ? ([
          { id: "signers", label: "Assinaturas do certificado" },
          { id: "team", label: "Equipe" },
          { id: "activity", label: "Log de atividades" },
        ] as Array<{ id: Tab; label: string }>)
      : []),
  ];

  return (
    <div>
      <PageHeader title="Configurações" description="Sua conta, as assinaturas do certificado, a equipe com acesso ao painel e o registro de atividades." />
      <div role="tablist" aria-label="Configurações" className="mb-4 flex flex-wrap gap-1.5">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={cn("rounded-lg border px-3.5 py-2 text-xs", tab === t.id ? "border-navy-900 bg-navy-900 font-bold text-white" : "border-line bg-surface text-muted hover:bg-canvas")}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === "account" && <AccountTab />}
      {tab === "signers" && isAdmin && <SignersTab />}
      {tab === "team" && isAdmin && <TeamTab />}
      {tab === "activity" && isAdmin && <ActivityTab />}
    </div>
  );
}
