import { personInputSchema } from "@olimach/schemas";
import { Badge, Button, cn } from "@olimach/ui";
import { ImageUp, Pencil, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { ConfirmDialog, Field, Modal, PageHeader, dbErrorMessage, inputClass } from "../components/ui";
import { isAdminRole, useAuth } from "../lib/auth";
import { supabase } from "../lib/supabase";
import { useToast } from "../lib/toast";

type Table = "instructors" | "technical_leads";

interface PersonRow {
  id: string;
  name: string;
  qualification: string;
  registry: string;
  signature_path: string | null;
}

const COPY: Record<Table, { tab: string; singular: string; newLabel: string; empty: string; inUse: string; hint: string }> = {
  instructors: {
    tab: "Instrutores",
    singular: "instrutor",
    newLabel: "Novo instrutor",
    empty: "Nenhum instrutor cadastrado ainda.",
    inUse: "Este instrutor está vinculado a turmas e não pode ser excluído.",
    hint: "Nome e qualificação do instrutor saem no certificado, com a assinatura.",
  },
  technical_leads: {
    tab: "Responsáveis técnicos",
    singular: "responsável técnico",
    newLabel: "Novo responsável técnico",
    empty: "Nenhum responsável técnico cadastrado ainda.",
    inUse: "Este responsável técnico assinou certificados e não pode ser excluído.",
    hint: "Nome e registro do responsável técnico saem no certificado, com a assinatura.",
  },
};

const MAX_SIGNATURE_BYTES = 1_000_000;
const SIGNATURE_TYPES: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg" };

function PersonForm({ table, person, onSaved, onClose }: { table: Table; person: PersonRow | null; onSaved: () => void; onClose: () => void }) {
  const toast = useToast();
  const copy = COPY[table];
  const [values, setValues] = useState({ name: person?.name ?? "", qualification: person?.qualification ?? "", registry: person?.registry ?? "" });
  const [file, setFile] = useState<File | null>(null);
  const [removeSignature, setRemoveSignature] = useState(false);
  const [currentUrl, setCurrentUrl] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  // Assinatura atual: URL assinada de curta duracao (bucket privado).
  useEffect(() => {
    if (!supabase || !person?.signature_path) return;
    let cancelled = false;
    void supabase.storage
      .from("signatures")
      .createSignedUrl(person.signature_path, 60)
      .then(({ data }) => {
        if (!cancelled) setCurrentUrl(data?.signedUrl ?? null);
      });
    return () => {
      cancelled = true;
    };
  }, [person?.signature_path]);

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function pickFile(next: File | null) {
    if (!next) {
      setFile(null);
      return;
    }
    if (!SIGNATURE_TYPES[next.type]) {
      setErrors((e) => ({ ...e, signature: "Use uma imagem PNG ou JPG." }));
      return;
    }
    if (next.size > MAX_SIGNATURE_BYTES) {
      setErrors((e) => ({ ...e, signature: "A imagem deve ter no máximo 1 MB." }));
      return;
    }
    setErrors((e) => {
      const { signature: _removed, ...rest } = e;
      void _removed;
      return rest;
    });
    setRemoveSignature(false);
    setFile(next);
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!supabase) return;
    const parsed = personInputSchema.safeParse(values);
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) next[String(issue.path[0])] ??= issue.message;
      setErrors(next);
      return;
    }
    setErrors({});
    setBusy(true);

    let id = person?.id ?? "";
    if (person) {
      const { error } = await supabase.from(table).update(parsed.data).eq("id", person.id);
      if (error) {
        setBusy(false);
        toast.error(dbErrorMessage(error, {}));
        return;
      }
    } else {
      const { data, error } = await supabase.from(table).insert(parsed.data).select("id").single();
      if (error || !data) {
        setBusy(false);
        toast.error(dbErrorMessage(error ?? {}, {}));
        return;
      }
      id = (data as { id: string }).id;
    }

    let signaturePath: string | null | undefined;
    if (file) {
      const path = `${table}/${id}.${SIGNATURE_TYPES[file.type]}`;
      const { error } = await supabase.storage.from("signatures").upload(path, file, { upsert: true, contentType: file.type });
      if (error) {
        setBusy(false);
        toast.error("Os dados foram salvos, mas o envio da assinatura falhou. Abra o cadastro e tente de novo.");
        onSaved();
        return;
      }
      signaturePath = path;
      // remove a assinatura antiga se mudou a extensao
      if (person?.signature_path && person.signature_path !== path) await supabase.storage.from("signatures").remove([person.signature_path]);
    } else if (removeSignature && person?.signature_path) {
      await supabase.storage.from("signatures").remove([person.signature_path]);
      signaturePath = null;
    }
    if (signaturePath !== undefined) {
      const { error } = await supabase.from(table).update({ signature_path: signaturePath }).eq("id", id);
      if (error) {
        setBusy(false);
        toast.error(dbErrorMessage(error, {}));
        onSaved();
        return;
      }
    }

    setBusy(false);
    toast.success(person ? "Cadastro atualizado." : `${copy.singular.charAt(0).toUpperCase()}${copy.singular.slice(1)} cadastrado.`);
    onSaved();
  }

  const shownSignature = previewUrl ?? (removeSignature ? null : currentUrl);

  return (
    <Modal title={person ? `Editar ${copy.singular}` : copy.newLabel} description={copy.hint} onClose={onClose}>
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <Field label="Nome completo" error={errors.name}>
          {(p) => <input {...p} className={inputClass} autoComplete="off" value={values.name} onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))} />}
        </Field>
        <Field label="Qualificação" error={errors.qualification} hint="Ex.: Engenheiro de Segurança do Trabalho.">
          {(p) => <input {...p} className={inputClass} autoComplete="off" value={values.qualification} onChange={(e) => setValues((v) => ({ ...v, qualification: e.target.value }))} />}
        </Field>
        <Field label="Registro profissional" error={errors.registry} hint="Ex.: CREA-RJ 000000.">
          {(p) => <input {...p} className={inputClass} autoComplete="off" value={values.registry} onChange={(e) => setValues((v) => ({ ...v, registry: e.target.value }))} />}
        </Field>

        <Field label="Assinatura (imagem)" error={errors.signature} hint="PNG ou JPG, até 1 MB. Preferir fundo transparente ou branco.">
          {(p) => (
            <>
              <div className="mt-1.5 flex items-center gap-3">
                <div className="grid h-20 w-40 shrink-0 place-items-center overflow-hidden rounded-btn-admin border border-dashed border-line bg-white">
                  {shownSignature ? (
                    <img src={shownSignature} alt={`Assinatura de ${values.name || "pessoa cadastrada"}`} className="max-h-full max-w-full object-contain" />
                  ) : (
                    <span className="text-[11px] text-muted">Sem assinatura</span>
                  )}
                </div>
                <div className="flex flex-col items-start gap-1.5">
                  <label htmlFor={p.id} className="inline-flex cursor-pointer items-center gap-2 rounded-btn-admin border border-line bg-surface px-3 py-2 text-xs font-semibold text-navy-900 hover:bg-canvas">
                    <ImageUp size={15} aria-hidden /> {shownSignature ? "Trocar imagem" : "Enviar imagem"}
                  </label>
                  {(person?.signature_path || file) && !removeSignature && (
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
                </div>
              </div>
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
            </>
          )}
        </Field>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function PeopleList({ table }: { table: Table }) {
  const { profile } = useAuth();
  const toast = useToast();
  const copy = COPY[table];
  const isAdmin = isAdminRole(profile?.role);
  const [rows, setRows] = useState<PersonRow[]>([]);
  const [loading, setLoading] = useState(Boolean(supabase));
  const [error, setError] = useState(false);
  const [editing, setEditing] = useState<PersonRow | "new" | null>(null);
  const [removing, setRemoving] = useState<PersonRow | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!supabase) return;
    const { data, error: err } = await supabase.from(table).select("id, name, qualification, registry, signature_path").order("name");
    if (err) setError(true);
    else {
      setError(false);
      setRows(data as PersonRow[]);
    }
    setLoading(false);
  }, [table]);

  useEffect(() => {
    setLoading(Boolean(supabase));
    void load();
  }, [load]);

  async function remove(person: PersonRow) {
    if (!supabase) return;
    setBusy(true);
    const { error: err } = await supabase.from(table).delete().eq("id", person.id);
    if (!err && person.signature_path) await supabase.storage.from("signatures").remove([person.signature_path]);
    setBusy(false);
    if (err) {
      toast.error(dbErrorMessage(err, { inUse: copy.inUse }));
      return;
    }
    toast.success("Cadastro excluído.");
    setRemoving(null);
    await load();
  }

  return (
    <div className="rounded-[15px] border border-line bg-surface p-4 shadow-sm md:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted">{copy.hint}</p>
        {isAdmin && (
          <Button onClick={() => setEditing("new")}>
            <Plus size={16} aria-hidden /> {copy.newLabel}
          </Button>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-left">
          <thead>
            <tr className="bg-canvas text-[10px] font-semibold text-[#253b57]">
              <th className="rounded-l-md border-y border-line px-2.5 py-3">Nome</th>
              <th className="border-y border-line px-2.5 py-3">Qualificação</th>
              <th className="border-y border-line px-2.5 py-3">Registro</th>
              <th className="border-y border-line px-2.5 py-3">Assinatura</th>
              <th className="rounded-r-md border-y border-line px-2.5 py-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id} className="border-b border-line text-[11px] text-[#4b5b70]">
                <td className="px-2.5 py-3 font-medium text-ink">{p.name}</td>
                <td className="px-2.5 py-3">{p.qualification}</td>
                <td className="whitespace-nowrap px-2.5 py-3">{p.registry}</td>
                <td className="px-2.5 py-3">
                  <Badge tone={p.signature_path ? "success" : "warning"}>{p.signature_path ? "Enviada" : "Pendente"}</Badge>
                </td>
                <td className="px-2.5 py-3">
                  <div className="flex justify-end gap-1">
                    {isAdmin ? (
                      <>
                        <button type="button" onClick={() => setEditing(p)} aria-label={`Editar ${p.name}`} title="Editar" className="rounded p-1.5 text-[#678099] hover:bg-canvas hover:text-navy-900">
                          <Pencil size={16} aria-hidden />
                        </button>
                        <button type="button" onClick={() => setRemoving(p)} aria-label={`Excluir ${p.name}`} title="Excluir" className="rounded p-1.5 text-[#678099] hover:bg-canvas hover:text-danger">
                          <Trash2 size={16} aria-hidden />
                        </button>
                      </>
                    ) : (
                      <span className="text-[10px] text-muted">Somente leitura</span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="p-8 text-center text-xs text-muted">
                  {loading ? "Carregando..." : error ? "Não foi possível carregar o cadastro." : copy.empty}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {!isAdmin && <p className="mt-4 text-[11px] text-muted">Somente administradores editam este cadastro.</p>}

      {editing && (
        <PersonForm
          table={table}
          person={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void load();
          }}
        />
      )}
      {removing && (
        <ConfirmDialog
          title="Excluir cadastro"
          message={
            <>
              Excluir <strong className="text-ink">{removing.name}</strong>? A assinatura enviada também será removida. Esta ação não pode ser desfeita.
            </>
          }
          confirmLabel="Excluir"
          busy={busy}
          onConfirm={() => void remove(removing)}
          onClose={() => setRemoving(null)}
        />
      )}
    </div>
  );
}

export function People() {
  const [table, setTable] = useState<Table>("instructors");
  return (
    <div>
      <PageHeader
        title="Instrutores"
        description="Instrutores e responsáveis técnicos que assinam os certificados. As imagens de assinatura ficam em armazenamento privado."
      />
      <div role="tablist" aria-label="Tipo de cadastro" className="mb-4 flex gap-1.5">
        {(Object.keys(COPY) as Table[]).map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={table === t}
            onClick={() => setTable(t)}
            className={cn("rounded-lg px-3.5 py-2 text-xs", table === t ? "bg-navy-900 font-bold text-white" : "bg-surface text-muted hover:bg-canvas border border-line")}
          >
            {COPY[t].tab}
          </button>
        ))}
      </div>
      <PeopleList key={table} table={table} />
    </div>
  );
}
