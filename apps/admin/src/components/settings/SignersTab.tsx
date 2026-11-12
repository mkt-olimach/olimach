import { personInputSchema } from "@olimach/schemas";
import { Badge, Button } from "@olimach/ui";
import { ImageUp, Move } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { FormEvent, PointerEvent as ReactPointerEvent } from "react";
import { supabase } from "../../lib/supabase";
import { useToast } from "../../lib/toast";
import { Field, Modal, dbErrorMessage, inputClass } from "../ui";

type Role = "engineer" | "director" | "safety_technician";

interface SignerRow {
  role: Role;
  name: string;
  qualification: string;
  registry: string;
  signature_path: string | null;
  sig_offset_x: number;
  sig_offset_y: number;
  sig_scale: number;
}

/** Ajuste da assinatura em pontos do PDF, relativo a posicao padrao (base sobre a linha). Mesmo calculo do gerador do PDF. */
interface Adjust {
  x: number;
  y: number;
  scale: number;
}
const DEFAULT_ADJUST: Adjust = { x: 0, y: 0, scale: 1 };
const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

const ROLES: Array<{ role: Role; label: string; qualificationHint: string; registryHint: string; registryRequired: boolean }> = [
  { role: "engineer", label: "Engenheiro técnico", qualificationHint: "Ex.: Engenheiro de Segurança do Trabalho.", registryHint: "Ex.: CREA-RJ 000000.", registryRequired: true },
  { role: "director", label: "Diretoria", qualificationHint: "Ex.: Diretor(a) Geral.", registryHint: "Opcional. Ex.: CPF ou cargo.", registryRequired: false },
  { role: "safety_technician", label: "Técnico em segurança", qualificationHint: "Ex.: Técnico de Segurança do Trabalho.", registryHint: "Ex.: MTE 000000.", registryRequired: true },
];

const MAX_SIGNATURE_BYTES = 1_000_000;
const SIGNATURE_TYPES: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg" };

const STAGE_W = 260;
const STAGE_H = 175;
const LINE_Y = 100; // distancia da linha ao topo do quadro, em pt
const LINE_W = 215;

/** Campo de assinatura como sai no PDF (1 pt = k px). A assinatura fica em primeiro plano e pode cobrir a linha e os textos. */
function SignatureStage({
  k,
  label,
  name,
  qualification,
  registry,
  imageUrl,
  adjust,
  onAdjust,
}: {
  k: number;
  label: string;
  name: string;
  qualification: string;
  registry: string;
  imageUrl: string | null;
  adjust: Adjust;
  onAdjust?: (next: Adjust) => void;
}) {
  const [nat, setNat] = useState<{ w: number; h: number } | null>(null);
  const drag = useRef<{ x: number; y: number; start: Adjust } | null>(null);

  useEffect(() => {
    setNat(null);
    if (!imageUrl) return;
    const img = new Image();
    img.onload = () => setNat({ w: img.naturalWidth, h: img.naturalHeight });
    img.src = imageUrl;
  }, [imageUrl]);

  const base = nat ? Math.min(190 / nat.w, 46 / nat.h) * adjust.scale : 0;
  const w = nat ? nat.w * base : 0;
  const h = nat ? nat.h * base : 0;

  function down(e: ReactPointerEvent<HTMLImageElement>) {
    if (!onAdjust) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, start: adjust };
  }
  function move(e: ReactPointerEvent<HTMLImageElement>) {
    if (!drag.current || !onAdjust) return;
    const d = drag.current;
    onAdjust({ ...d.start, x: clamp(d.start.x + (e.clientX - d.x) / k, -200, 200), y: clamp(d.start.y - (e.clientY - d.y) / k, -150, 150) });
  }
  function up() {
    drag.current = null;
  }

  const text = { position: "absolute" as const, left: 0, right: 0, textAlign: "center" as const, whiteSpace: "nowrap" as const };
  let ty = LINE_Y + 5;
  const lines: Array<{ key: string; value: string; size: number; step: number; className: string }> = [{ key: "n", value: name || "Nome completo", size: 9.5, step: 11, className: "font-bold text-ink" }];
  if (qualification) lines.push({ key: "q", value: qualification, size: 8, step: 10, className: "text-muted" });
  if (registry) lines.push({ key: "r", value: registry, size: 8, step: 10, className: "text-muted" });
  lines.push({ key: "f", value: label.toUpperCase(), size: 7, step: 10, className: "font-bold text-navy-900" });

  return (
    <div
      className="relative overflow-hidden rounded-btn-admin border border-dashed border-line bg-white"
      style={{ width: STAGE_W * k, height: STAGE_H * k, maxWidth: "100%" }}
      aria-label={`Pré-visualização do campo de assinatura: ${label}`}
    >
      <div className="absolute bg-[#6b7689]" style={{ left: ((STAGE_W - LINE_W) / 2) * k, width: LINE_W * k, top: LINE_Y * k, height: Math.max(1, 0.7 * k) }} />
      {lines.map((l) => {
        const top = ty;
        ty += l.step;
        return (
          <div key={l.key} className={l.className} style={{ ...text, top: top * k, fontSize: l.size * k, lineHeight: `${l.step * k}px` }}>
            {l.value}
          </div>
        );
      })}
      {!imageUrl && (
        <span className="absolute inset-x-0 text-center text-muted" style={{ top: (LINE_Y - 30) * k, fontSize: 9 * k }}>
          Sem assinatura
        </span>
      )}
      {imageUrl && nat && (
        <img
          src={imageUrl}
          alt={`Assinatura de ${name || label}`}
          draggable={false}
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={up}
          className={onAdjust ? "cursor-grab touch-none active:cursor-grabbing" : "pointer-events-none"}
          style={{ position: "absolute", zIndex: 10, left: (STAGE_W / 2 + adjust.x - w / 2) * k, top: (LINE_Y - 4 - adjust.y - h) * k, width: w * k, height: h * k }}
        />
      )}
    </div>
  );
}

function AdjustDialog({
  label,
  name,
  qualification,
  registry,
  imageUrl,
  initial,
  onApply,
  onClose,
}: {
  label: string;
  name: string;
  qualification: string;
  registry: string;
  imageUrl: string;
  initial: Adjust;
  onApply: (next: Adjust) => void;
  onClose: () => void;
}) {
  const [adjust, setAdjust] = useState<Adjust>(initial);
  const slider = (id: string, text: string, value: number, min: number, max: number, step: number, set: (n: number) => void, show: string) => (
    <div>
      <label htmlFor={id} className="flex justify-between text-xs font-semibold text-navy-900">
        {text} <span className="font-normal text-muted">{show}</span>
      </label>
      <input id={id} type="range" min={min} max={max} step={step} value={value} onChange={(e) => set(Number(e.target.value))} className="mt-1 w-full accent-navy-900" />
    </div>
  );
  return (
    <Modal wide title={`Ajustar assinatura: ${label}`} description="Arraste a assinatura ou use os controles. O resultado é exatamente como sai no certificado." onClose={onClose}>
      <div className="flex justify-center">
        <SignatureStage k={1.6} label={label} name={name} qualification={qualification} registry={registry} imageUrl={imageUrl} adjust={adjust} onAdjust={setAdjust} />
      </div>
      <p className="mt-2 flex items-center justify-center gap-1.5 text-[11px] text-muted">
        <Move size={13} aria-hidden /> A assinatura fica na frente da linha e dos textos.
      </p>
      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        {slider("adj-x", "Horizontal", adjust.x, -200, 200, 1, (n) => setAdjust((a) => ({ ...a, x: n })), `${adjust.x > 0 ? "+" : ""}${Math.round(adjust.x)} pt`)}
        {slider("adj-y", "Vertical", adjust.y, -150, 150, 1, (n) => setAdjust((a) => ({ ...a, y: n })), `${adjust.y > 0 ? "+" : ""}${Math.round(adjust.y)} pt`)}
        {slider("adj-s", "Tamanho", adjust.scale, 0.2, 4, 0.05, (n) => setAdjust((a) => ({ ...a, scale: n })), `${Math.round(adjust.scale * 100)}%`)}
      </div>
      <div className="mt-6 flex flex-wrap justify-between gap-2">
        <Button type="button" variant="secondary" onClick={() => setAdjust(DEFAULT_ADJUST)}>
          Restaurar padrão
        </Button>
        <div className="flex gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="button" onClick={() => onApply(adjust)}>
            Aplicar
          </Button>
        </div>
      </div>
    </Modal>
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
  const [adjust, setAdjust] = useState<Adjust>({ x: row?.sig_offset_x ?? 0, y: row?.sig_offset_y ?? 0, scale: row?.sig_scale ?? 1 });
  const [adjusting, setAdjusting] = useState(false);
  const signaturePath = row?.signature_path ?? null;

  useEffect(() => {
    setValues({ name: row?.name ?? "", qualification: row?.qualification ?? "", registry: row?.registry ?? "" });
    setFile(null);
    setRemoveSignature(false);
    setAdjust({ x: row?.sig_offset_x ?? 0, y: row?.sig_offset_y ?? 0, scale: row?.sig_scale ?? 1 });
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
      .upsert({ role: meta.role, name: parsed.data.name, qualification: parsed.data.qualification, registry, signature_path: nextPath, sig_offset_x: adjust.x, sig_offset_y: adjust.y, sig_scale: adjust.scale, updated_at: new Date().toISOString() });
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
        <SignatureStage k={1} label={meta.label} name={values.name} qualification={values.qualification} registry={values.registry} imageUrl={shown} adjust={adjust} />
        {adjusting && shown && (
          <AdjustDialog
            label={meta.label}
            name={values.name}
            qualification={values.qualification}
            registry={values.registry}
            imageUrl={shown}
            initial={adjust}
            onApply={(next) => {
              setAdjust(next);
              setAdjusting(false);
            }}
            onClose={() => setAdjusting(false)}
          />
        )}
        {shown && (
          <Button type="button" variant="secondary" className="mt-2 w-full" onClick={() => setAdjusting(true)}>
            Ajustar
          </Button>
        )}
        <p className="mt-1.5 text-[11px] text-muted">Depois de ajustar, clique em Salvar para gravar.</p>
      </div>
    </form>
  );
}

export function SignersTab() {
  const [rows, setRows] = useState<SignerRow[] | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    if (!supabase) return;
    const { data, error } = await supabase.from("certificate_signers").select("role, name, qualification, registry, signature_path, sig_offset_x, sig_offset_y, sig_scale");
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
