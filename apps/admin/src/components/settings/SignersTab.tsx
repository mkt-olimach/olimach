import { personInputSchema } from "@olimach/schemas";
import { Badge, Button } from "@olimach/ui";
import { ImageUp } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { supabase } from "../../lib/supabase";
import { useToast } from "../../lib/toast";
import { Field, dbErrorMessage, inputClass } from "../ui";

type Role = "engineer" | "director" | "safety_technician";

interface SignerRow {
  role: Role;
  name: string;
  qualification: string;
  registry: string;
  signature_path: string | null;
}

const ROLES: Array<{ role: Role; label: string; qualificationHint: string; registryHint: string; registryRequired: boolean }> = [
  { role: "engineer", label: "Engenheiro técnico", qualificationHint: "Ex.: Engenheiro de Segurança do Trabalho.", registryHint: "Ex.: CREA-RJ 000000.", registryRequired: true },
  { role: "director", label: "Diretoria", qualificationHint: "Ex.: Diretor(a) Geral.", registryHint: "Opcional. Ex.: CPF ou cargo.", registryRequired: false },
  { role: "safety_technician", label: "Técnico em segurança", qualificationHint: "Ex.: Técnico de Segurança do Trabalho.", registryHint: "Ex.: MTE 000000.", registryRequired: true },
];

const MAX_SIGNATURE_BYTES = 1_000_000;
const SIGNATURE_TYPES: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg" };

/** Previa do campo de assinatura como sai no PDF: imagem sobre a linha, nome, qualificacao, registro e funcao. */
function SignaturePreview({ label, name, qualification, registry, imageUrl }: { label: string; name: string; qualification: string; registry: string; imageUrl: string | null }) {
  return (
    <div className="rounded-btn-admin border border-dashed border-line bg-white px-4 pb-4 pt-3" aria-label={`Pré-visualização do campo de assinatura: ${label}`}>
      <div className="flex h-16 items-center justify-center overflow-hidden">
        {imageUrl ? <img src={imageUrl} alt={`Assinatura de ${name || label}`} className="h-16 max-w-full object-contain" /> : <span className="text-[11px] text-muted">Sem assinatura</span>}
      </div>
      <div className="border-t border-[#6b7689]" />
      <p className="mt-1.5 text-center text-[11px] font-bold text-ink">{name || "Nome completo"}</p>
      {qualification && <p className="text-center text-[10px] text-muted">{qualification}</p>}
      {registry && <p className="text-center text-[10px] text-muted">{registry}</p>}
      <p className="mt-0.5 text-center text-[9px] font-bold uppercase tracking-wide text-navy-900">{label}</p>
    </div>
  );
}

function SignerCard({ meta, row, onSaved }: { meta: (typeof ROLES)[number]; row: SignerRow | null; onSaved: () => void }) {
  const toast = useToast();
  const [values, setValues] = useState({ name: row?.name ?? "", qualification: row?.qualification ?? "", registry: row?.registry ?? "" });
  const [file, setFile] = useState<File | null>(null);
  const [removeSignature, setRemoveSignature] = useState(false);
  const [currentUrl, setCurrentUrl] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const signaturePath = row?.signature_path ?? null;

  useEffect(() => {
    setValues({ name: row?.name ?? "", qualification: row?.qualification ?? "", registry: row?.registry ?? "" });
    setFile(null);
    setRemoveSignature(false);
  }, [row]);

  useEffect(() => {
    if (!supabase || !signaturePath) return setCurrentUrl(null);
    let cancelled = false;
    void supabase.storage
      .from("signatures")
      .createSignedUrl(signaturePath, 300)
      .then(({ data }) => {
        if (!cancelled) setCurrentUrl(data?.signedUrl ?? null);
      });
    return () => {
      cancelled = true;
    };
  }, [signaturePath]);

  useEffect(() => {
    if (!file) return setPreviewUrl(null);
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function pickFile(next: File | null) {
    if (!next) return;
    if (!SIGNATURE_TYPES[next.type]) return setErrors((e) => ({ ...e, signature: "Use uma imagem PNG ou JPG." }));
    if (next.size > MAX_SIGNATURE_BYTES) return setErrors((e) => ({ ...e, signature: "A imagem deve ter no máximo 1 MB." }));
    setErrors((e) => ({ ...e, signature: "" }));
    setRemoveSignature(false);
    setFile(next);
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!supabase) return;
    const parsed = personInputSchema.safeParse({ ...values, registry: values.registry.trim() || (meta.registryRequired ? "" : "-") });
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) next[String(issue.path[0])] ??= issue.message;
      return setErrors(next);
    }
    setErrors({});
    setBusy(true);

    let nextPath: string | null = removeSignature ? null : signaturePath;
    if (file) {
      const path = `signers/${meta.role}-${Date.now()}.${SIGNATURE_TYPES[file.type]}`;
      const { error } = await supabase.storage.from("signatures").upload(path, file, { contentType: file.type });
      if (error) {
        setBusy(false);
        return void toast.error("Não foi possível enviar a assinatura. Tente novamente.");
      }
      nextPath = path;
    }

    const registry = parsed.data.registry === "-" ? "" : parsed.data.registry;
    const { error } = await supabase
      .from("certificate_signers")
      .upsert({ role: meta.role, name: parsed.data.name, qualification: parsed.data.qualification, registry, signature_path: nextPath, updated_at: new Date().toISOString() });
    setBusy(false);
    if (error) {
      if (file && nextPath) await supabase.storage.from("signatures").remove([nextPath]);
      return void toast.error(dbErrorMessage(error, {}));
    }
    if (signaturePath && signaturePath !== nextPath) await supabase.storage.from("signatures").remove([signaturePath]);
    toast.success(`${meta.label} salvo.`);
    onSaved();
  }

  const shown = previewUrl ?? (removeSignature ? null : currentUrl);
  const hasSignature = Boolean(file) || (Boolean(signaturePath) && !removeSignature);

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-5 rounded-2xl border border-line bg-surface p-5 md:grid-cols-[1fr_260px]">
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-base text-navy-900">{meta.label}</h3>
          <Badge tone={row ? "success" : "warning"}>{row ? "Configurado" : "Pendente"}</Badge>
        </div>
        <Field label="Nome completo" error={errors.name}>
          {(p) => <input {...p} className={inputClass} autoComplete="off" value={values.name} onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))} />}
        </Field>
        <Field label="Qualificação" error={errors.qualification} hint={meta.qualificationHint}>
          {(p) => <input {...p} className={inputClass} autoComplete="off" value={values.qualification} onChange={(e) => setValues((v) => ({ ...v, qualification: e.target.value }))} />}
        </Field>
        <Field label="Registro profissional" error={errors.registry} hint={meta.registryHint}>
          {(p) => <input {...p} className={inputClass} autoComplete="off" value={values.registry} onChange={(e) => setValues((v) => ({ ...v, registry: e.target.value }))} />}
        </Field>
        <Field label="Assinatura (imagem)" error={errors.signature} hint="PNG ou JPG, até 1 MB. Preferir fundo transparente ou branco.">
          {(p) => (
            <div className="mt-1.5 flex flex-wrap items-center gap-3">
              <label htmlFor={p.id} className="inline-flex cursor-pointer items-center gap-2 rounded-btn-admin border border-line bg-surface px-3 py-2 text-xs font-semibold text-navy-900 hover:bg-canvas">
                <ImageUp size={15} aria-hidden /> {hasSignature ? "Trocar imagem" : "Enviar imagem"}
              </label>
              {hasSignature && (
                <button
                  type="button"
                  className="text-[11px] font-semibold text-danger hover:underline"
                  onClick={() => {
                    setFile(null);
                    setRemoveSignature(true);
                  }}
                >
                  Remover assinatura
                </button>
              )}
              <input
                id={p.id}
                type="file"
                accept="image/png,image/jpeg"
                className="sr-only"
                aria-describedby={p["aria-describedby"]}
                onChange={(e) => {
                  pickFile(e.target.files?.[0] ?? null);
                  e.target.value = "";
                }}
              />
            </div>
          )}
        </Field>
        <Button type="submit" disabled={busy}>
          {busy ? "Salvando..." : "Salvar"}
        </Button>
      </div>
      <div className="self-start">
        <p className="mb-1.5 text-xs font-semibold text-navy-900">Pré-visualização</p>
        <SignaturePreview label={meta.label} name={values.name} qualification={values.qualification} registry={values.registry} imageUrl={shown} />
      </div>
    </form>
  );
}

export function SignersTab() {
  const [rows, setRows] = useState<SignerRow[] | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    if (!supabase) return;
    const { data, error } = await supabase.from("certificate_signers").select("role, name, qualification, registry, signature_path");
    if (error) return setFailed(true);
    setFailed(false);
    setRows((data ?? []) as SignerRow[]);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (failed) return <p role="alert" className="rounded-btn-admin bg-danger/10 p-3 text-sm text-danger">Não foi possível carregar as assinaturas. Verifique se a migração das assinaturas foi aplicada.</p>;
  if (!rows) return <p className="text-sm text-muted">Carregando...</p>;

  return (
    <div className="space-y-4">
      <p className="max-w-2xl text-sm text-muted">
        Todo certificado sai com quatro campos de assinatura: o do aluno (em branco, com o nome abaixo) e estes três, que valem para todos os certificados emitidos a partir de agora. Certificados já emitidos não mudam.
      </p>
      {ROLES.map((meta) => (
        <SignerCard key={meta.role} meta={meta} row={rows.find((r) => r.role === meta.role) ?? null} onSaved={() => void load()} />
      ))}
    </div>
  );
}
