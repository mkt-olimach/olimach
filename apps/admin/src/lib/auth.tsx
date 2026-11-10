import type { Session } from "@supabase/supabase-js";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { supabase } from "./supabase";

export interface Profile {
  id: string;
  name: string;
  role: "admin" | "secretaria";
}

interface AuthState {
  loading: boolean;
  session: Session | null;
  profile: Profile | null;
  configured: boolean;
  /** true quando a sessao veio do link de recuperacao de senha enviado por e-mail. */
  recovery: boolean;
  signIn: (email: string, password: string) => Promise<string | null>;
  /** Envia o e-mail de recuperacao. Nao revela se o e-mail existe: retorna erro so para falha de rede/limite. */
  requestPasswordReset: (email: string) => Promise<string | null>;
  updatePassword: (password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(Boolean(supabase));
  const [recovery, setRecovery] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data } = supabase.auth.onAuthStateChange((event, next) => {
      setSession(next);
      if (event === "PASSWORD_RECOVERY") setRecovery(true);
      if (event === "SIGNED_OUT") setRecovery(false);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  // O perfil (e o papel) vem do banco, protegido por RLS. Usuario sem perfil ativo nao entra.
  useEffect(() => {
    if (!supabase || !session) {
      setProfile(null);
      return;
    }
    supabase
      .from("profiles")
      .select("id, name, role")
      .eq("id", session.user.id)
      .maybeSingle()
      .then(({ data }) => setProfile((data as Profile | null) ?? null));
  }, [session]);

  const value = useMemo<AuthState>(
    () => ({
      loading,
      session,
      profile,
      configured: Boolean(supabase),
      recovery,
      requestPasswordReset: async (email) => {
        if (!supabase) return "Ambiente sem conexão com o banco configurada.";
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/redefinir-senha`,
        });
        // 429 = limite de envios; qualquer outro resultado e tratado como enviado (sem enumerar contas).
        return error?.status === 429 ? "Muitas tentativas. Aguarde alguns minutos e tente de novo." : null;
      },
      updatePassword: async (password) => {
        if (!supabase) return "Ambiente sem conexão com o banco configurada.";
        const { error } = await supabase.auth.updateUser({ password });
        if (!error) setRecovery(false);
        return error ? "Não foi possível atualizar a senha. Peça um novo link e tente de novo." : null;
      },
      signIn: async (email, password) => {
        if (!supabase) return "Ambiente sem conexão com o banco configurada.";
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        return error ? "E-mail ou senha inválidos." : null;
      },
      signOut: async () => {
        await supabase?.auth.signOut();
      },
    }),
    [loading, session, profile, recovery],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth fora do AuthProvider");
  return ctx;
}
