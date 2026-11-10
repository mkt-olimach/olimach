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
  signIn: (email: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(Boolean(supabase));

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
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
      signIn: async (email, password) => {
        if (!supabase) return "Ambiente sem conexão com o banco configurada.";
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        return error ? "E-mail ou senha inválidos." : null;
      },
      signOut: async () => {
        await supabase?.auth.signOut();
      },
    }),
    [loading, session, profile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth fora do AuthProvider");
  return ctx;
}
