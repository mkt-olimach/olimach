import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** Somente a anon key no frontend. null enquanto o ambiente nao estiver configurado. */
export const supabase = url && anonKey ? createClient(url, anonKey) : null;
