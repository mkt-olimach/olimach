/** Mensagem de erro de uma Edge Function (corpo JSON { error }) ou o texto padrao. */
export async function functionErrorMessage(error: unknown, fallback: string): Promise<string> {
  const context = (error as { context?: Response } | null)?.context;
  if (context && typeof context.json === "function") {
    try {
      const body = (await context.json()) as { error?: string };
      if (body.error) return body.error;
    } catch {
      /* corpo nao era JSON */
    }
  }
  return fallback;
}
