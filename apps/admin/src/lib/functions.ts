/** Mensagem de erro de uma Edge Function: corpo JSON { error }, funcao nao implantada ou o texto padrao. */
export async function functionErrorMessage(error: unknown, fallback: string): Promise<string> {
  const err = error as { name?: string; context?: Response } | null;
  const context = err?.context;
  if (context && typeof context.json === "function") {
    try {
      const body = (await context.clone().json()) as { error?: string };
      if (body.error) return body.error;
    } catch {
      /* corpo nao era JSON */
    }
    if (context.status === 404) {
      return "A função não foi encontrada no Supabase. Implante com `supabase functions deploy` e tente de novo.";
    }
    if (context.status === 401 || context.status === 403) return "Sessão sem permissão para esta ação. Entre novamente.";
  }
  if (err?.name === "FunctionsFetchError" || err?.name === "FunctionsRelayError") {
    return "Não foi possível alcançar a função no Supabase. Confirme que ela foi implantada e tente de novo.";
  }
  return fallback;
}
