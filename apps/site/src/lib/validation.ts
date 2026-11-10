import { certificateCodeSchema, publicValidationRowSchema } from "@olimach/schemas";
import type { PublicValidationRow } from "@olimach/schemas";

export type ValidationOutcome =
  | { kind: "found"; row: PublicValidationRow }
  | { kind: "not_found" }
  | { kind: "rate_limited" }
  | { kind: "invalid_code" }
  | { kind: "not_configured" }
  | { kind: "error" };

/**
 * Chama o RPC public.validate_certificate com a anon key. O anon so tem EXECUTE nesse RPC;
 * nao ha SELECT anonimo em nenhuma tabela.
 */
export async function validateCertificate(rawCode: string): Promise<ValidationOutcome> {
  const parsed = certificateCodeSchema.safeParse(rawCode);
  if (!parsed.success) return { kind: "invalid_code" };

  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  if (!url || !anonKey) return { kind: "not_configured" };

  try {
    const response = await fetch(`${url}/rest/v1/rpc/validate_certificate`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: anonKey, Authorization: `Bearer ${anonKey}` },
      body: JSON.stringify({ p_code: parsed.data }),
    });
    if (!response.ok) return { kind: "error" };

    const rows = publicValidationRowSchema.array().parse(await response.json());
    const row = rows[0];
    if (!row) return { kind: "not_found" };
    if (row.status === "rate_limited") return { kind: "rate_limited" };
    return { kind: "found", row };
  } catch {
    return { kind: "error" };
  }
}
