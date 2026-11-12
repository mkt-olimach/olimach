import { Button } from "@olimach/ui";
import { CheckSquare, ImagePlus, Pencil, Square, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DragEvent, FormEvent } from "react";
import { ConfirmDialog, Field, Modal, PageHeader, dbErrorMessage, inputClass } from "../components/ui";
import { isAdminRole, useAuth } from "../lib/auth";
import { supabase } from "../lib/supabase";
import { useToast } from "../lib/toast";

const BUCKET = "gallery";
const TYPES: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };
const MAX_BYTES = 5 * 1024 * 1024;
const CHUNK = 100;

interface GalleryRow {
  id: string;
  path: string;
  title: string;
  description: string;
  width: number;
  height: number;
  created_at: string;
}

const COLUMNS = "id, path, title, description, width, height, created_at";

function publicUrl(path: string): string {
  return supabase?.storage.from(BUCKET).getPublicUrl(path).data.publicUrl ?? "";
}

function readSize(file: File): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      resolve(null);
      URL.revokeObjectURL(url);
    };
    img.src = url;
  });
}

function EditDialog({ row, onSaved, onClose }: { row: GalleryRow; onSaved: () => void; onClose: () => void }) {
  const toast = useToast();
  const [title, setTitle] = useState(row.title);
  const [description, setDescription] = useState(row.description);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!supabase) return;
    setBusy(true);
    const { error } = await supabase.from("gallery_images").update({ title: title.trim(), description: description.trim() }).eq("id", row.id);
    setBusy(false);
    if (error) return void toast.error(dbErrorMessage(error, {}));
    toast.success("Imagem atualizada.");
    onSaved();
  }

  return (
    <Modal title="Editar imagem" description="Título e descrição aparecem sobre a imagem na galeria do site." onClose={onClose}>
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <img src={publicUrl(row.path)} alt={row.title || "Imagem da galeria"} className="mx-auto max-h-48 rounded-btn-admin border border-line object-contain" />
        <Field label="Título" hint="Opcional. Até 120 caracteres.">
          {(p) => <input {...p} maxLength={120} className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} />}
        </Field>
        <Field label="Descrição" hint={`Opcional. ${description.length}/300 caracteres.`}>
          {(p) => <textarea {...p} rows={3} maxLength={300} className={`${inputClass} resize-y`} value={description} onChange={(e) => setDescription(e.target.value)} />}
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

/** Galeria do site: envio de imagens e gerenciamento (editar, excluir uma ou varias). */
export function Gallery() {
  const { profile } = useAuth();
  const toast = useToast();
  const canManage = isAdminRole(profile?.role);
  const [rows, setRows] = useState<GalleryRow[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<GalleryRow | null>(null);
  const [deleting, setDeleting] = useState<GalleryRow[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    if (!supabase) return;
    const { data, error } = await supabase.from("gallery_images").select(COLUMNS).order("created_at", { ascending: false });
    if (error) {
      toast.error("Não foi possível carregar a galeria. Verifique se a migração da galeria foi aplicada.");
      setRows([]);
      return;
    }
    const list = (data ?? []) as GalleryRow[];
    setRows(list);
    setSelected((current) => new Set([...current].filter((id) => list.some((r) => r.id === id))));
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  async function upload(files: File[]) {
    if (!supabase || files.length === 0) return;
    const valid: File[] = [];
    for (const file of files) {
      if (!TYPES[file.type]) toast.error(`${file.name}: use PNG, JPG ou WebP.`);
      else if (file.size > MAX_BYTES) toast.error(`${file.name}: a imagem deve ter no máximo 5 MB.`);
      else valid.push(file);
    }
    if (valid.length === 0) return;
    setBusy(true);
    setProgress({ done: 0, total: valid.length });
    let ok = 0;
    for (const file of valid) {
      const size = await readSize(file);
      const path = `${crypto.randomUUID()}.${TYPES[file.type]}`;
      if (!size) {
        toast.error(`${file.name}: não foi possível ler a imagem.`);
      } else {
        const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type, cacheControl: "31536000" });
        if (uploadError) {
          toast.error(`${file.name}: falha no envio.`);
        } else {
          const { error } = await supabase.from("gallery_images").insert({ path, width: size.width, height: size.height, title: file.name.replace(/\.[^.]+$/, "").slice(0, 120) });
          if (error) {
            await supabase.storage.from(BUCKET).remove([path]);
            toast.error(`${file.name}: ${dbErrorMessage(error, {})}`);
          } else ok++;
        }
      }
      setProgress((p) => (p ? { ...p, done: p.done + 1 } : p));
    }
    setBusy(false);
    setProgress(null);
    if (ok > 0) toast.success(ok === 1 ? "1 imagem enviada." : `${ok} imagens enviadas.`);
    await load();
  }

  async function confirmDelete() {
    if (!supabase || !deleting) return;
    setBusy(true);
    let removed = 0;
    for (let i = 0; i < deleting.length; i += CHUNK) {
      const chunk = deleting.slice(i, i + CHUNK);
      const { error } = await supabase.from("gallery_images").delete().in("id", chunk.map((r) => r.id));
      if (error) {
        toast.error(dbErrorMessage(error, {}));
        break;
      }
      removed += chunk.length;
      await supabase.storage.from(BUCKET).remove(chunk.map((r) => r.path));
    }
    setBusy(false);
    setDeleting(null);
    if (removed > 0) toast.success(removed === 1 ? "Imagem excluída." : `${removed} imagens excluídas.`);
    await load();
  }

  const allIds = useMemo(() => (rows ?? []).map((r) => r.id), [rows]);
  const allSelected = allIds.length > 0 && selected.size === allIds.length;
  const toggle = (id: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  function onDrop(event: DragEvent) {
    event.preventDefault();
    setDragOver(false);
    if (canManage) void upload([...event.dataTransfer.files]);
  }

  const chosen = (rows ?? []).filter((r) => selected.has(r.id));

  return (
    <div>
      <PageHeader
        title="Galeria"
        description="Imagens exibidas na página Galeria do site. Envie várias de uma vez e exclua uma ou várias."
        action={
          canManage ? (
            <Button onClick={() => fileInput.current?.click()} disabled={busy}>
              <ImagePlus size={16} aria-hidden /> Enviar imagens
            </Button>
          ) : undefined
        }
      />
      <input
        ref={fileInput}
        type="file"
        multiple
        accept={Object.keys(TYPES).join(",")}
        className="sr-only"
        aria-label="Selecionar imagens para enviar"
        onChange={(e) => {
          const files = [...(e.target.files ?? [])];
          e.target.value = "";
          void upload(files);
        }}
      />

      {!canManage && <p className="mb-4 rounded-btn-admin bg-canvas p-3 text-xs text-muted">Somente administradores enviam ou excluem imagens da galeria.</p>}

      {canManage && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          className={`mb-5 rounded-[15px] border-2 border-dashed p-6 text-center text-sm transition-colors ${dragOver ? "border-navy-900 bg-canvas" : "border-line bg-surface"}`}
        >
          {progress ? (
            <p className="font-semibold text-navy-900" role="status">
              Enviando {progress.done} de {progress.total}...
            </p>
          ) : (
            <p className="text-muted">
              Arraste imagens para cá ou{" "}
              <button type="button" className="font-semibold text-navy-900 underline" onClick={() => fileInput.current?.click()}>
                escolha no computador
              </button>
              . PNG, JPG ou WebP, até 5 MB cada.
            </p>
          )}
        </div>
      )}

      {rows === null ? (
        <p className="text-sm text-muted">Carregando...</p>
      ) : rows.length === 0 ? (
        <p className="rounded-[15px] border border-line bg-surface p-8 text-center text-sm text-muted">Nenhuma imagem na galeria ainda.</p>
      ) : (
        <>
          {canManage && (
            <div className="mb-4 flex flex-wrap items-center gap-3 rounded-[15px] border border-line bg-surface px-4 py-3 shadow-sm">
              <button type="button" onClick={() => setSelected(allSelected ? new Set() : new Set(allIds))} className="inline-flex items-center gap-2 text-xs font-semibold text-navy-900">
                {allSelected ? <CheckSquare size={16} aria-hidden /> : <Square size={16} aria-hidden />} {allSelected ? "Desmarcar todas" : "Selecionar todas"}
              </button>
              <span className="text-xs text-muted" aria-live="polite">
                {selected.size > 0 ? `${selected.size} selecionada${selected.size > 1 ? "s" : ""}` : `${rows.length} imagem${rows.length > 1 ? "ns" : ""}`}
              </span>
              {selected.size > 0 && (
                <>
                  <button type="button" onClick={() => setSelected(new Set())} className="inline-flex items-center gap-1 text-xs text-muted hover:text-navy-900">
                    <X size={14} aria-hidden /> Limpar seleção
                  </button>
                  <Button className="ml-auto bg-danger hover:bg-danger/90" onClick={() => setDeleting(chosen)} disabled={busy}>
                    <Trash2 size={15} aria-hidden /> Excluir selecionadas ({selected.size})
                  </Button>
                </>
              )}
            </div>
          )}
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
            {rows.map((r) => {
              const isSelected = selected.has(r.id);
              return (
                <li key={r.id} className={`group relative overflow-hidden rounded-[12px] border bg-surface shadow-sm ${isSelected ? "border-navy-900 ring-2 ring-navy-900/30" : "border-line"}`}>
                  <img src={publicUrl(r.path)} alt={r.title || "Imagem da galeria"} loading="lazy" className="aspect-square w-full object-cover" />
                  {canManage && (
                    <label className="absolute left-2 top-2 grid h-7 w-7 cursor-pointer place-items-center rounded-md bg-white/90 shadow">
                      <input type="checkbox" checked={isSelected} onChange={() => toggle(r.id)} className="h-4 w-4 accent-navy-900" aria-label={`Selecionar ${r.title || "imagem"}`} />
                    </label>
                  )}
                  <div className="flex items-center justify-between gap-1 px-2.5 py-2">
                    <p className="min-w-0 truncate text-[11px] text-ink" title={r.title}>
                      {r.title || <span className="text-muted">Sem título</span>}
                    </p>
                    {canManage && (
                      <span className="flex shrink-0 gap-0.5">
                        <button type="button" onClick={() => setEditing(r)} className="rounded p-1 text-muted hover:bg-canvas hover:text-navy-900" aria-label={`Editar ${r.title || "imagem"}`}>
                          <Pencil size={14} aria-hidden />
                        </button>
                        <button type="button" onClick={() => setDeleting([r])} className="rounded p-1 text-muted hover:bg-canvas hover:text-danger" aria-label={`Excluir ${r.title || "imagem"}`}>
                          <Trash2 size={14} aria-hidden />
                        </button>
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}

      {editing && (
        <EditDialog
          row={editing}
          onSaved={() => {
            setEditing(null);
            void load();
          }}
          onClose={() => setEditing(null)}
        />
      )}
      {deleting && (
        <ConfirmDialog
          title={deleting.length === 1 ? "Excluir imagem?" : `Excluir ${deleting.length} imagens?`}
          message={deleting.length === 1 ? "A imagem sai da galeria do site e o arquivo é apagado. Não dá para desfazer." : `As ${deleting.length} imagens saem da galeria do site e os arquivos são apagados. Não dá para desfazer.`}
          confirmLabel={deleting.length === 1 ? "Excluir" : `Excluir ${deleting.length}`}
          busy={busy}
          onConfirm={() => void confirmDelete()}
          onClose={() => !busy && setDeleting(null)}
        />
      )}
    </div>
  );
}
