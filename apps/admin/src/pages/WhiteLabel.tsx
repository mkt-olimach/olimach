import { Badge, Button } from "@olimach/ui";
import { ImageUp, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Navigate } from "react-router-dom";
import { Field, PageHeader, dbErrorMessage, inputClass } from "../components/ui";
import { isSuperAdminRole, useAuth } from "../lib/auth";
import { supabase } from "../lib/supabase";
import { useToast } from "../lib/toast";

const BUCKET = "branding";
const LOGO_TYPES: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };
const FAVICON_TYPES: Record<string, string> = { "image/png": "png", "image/webp": "webp", "image/x-icon": "ico", "image/vnd.microsoft.icon": "ico" };
const LOGO_MAX = 2 * 1024 * 1024;
const FAVICON_MAX = 512 * 1024;

interface CompanyRow {
  company_name: string;
  legal_name: string;
  cnpj: string;
  phone: string;
  whatsapp: string;
  email: string;
  website: string;
  address: string;
  city: string;
  state: string;
  postal_code: string;
  facebook: string;
  instagram: string;
  linkedin: string;
  youtube: string;
  logo_path: string | null;
  favicon_path: string | null;
}

const TEXT_FIELDS = ["company_name", "legal_name", "cnpj", "phone", "whatsapp", "email", "website", "address", "city", "state", "postal_code", "facebook", "instagram", "linkedin", "youtube"] as const;
type TextField = (typeof TEXT_FIELDS)[number];
type Values = Record<TextField, string>;

const COLUMNS = [...TEXT_FIELDS, "logo_path", "favicon_path"].join(", ");
const blank: Values = Object.fromEntries(TEXT_FIELDS.map((f) => [f, ""])) as Values;

const LIMITS: Record<TextField, number> = {
  company_name: 120,
  legal_name: 160,
  cnpj: 24,
  phone: 40,
  whatsapp: 40,
  email: 160,
  website: 200,
  address: 200,
  city: 80,
  state: 40,
  postal_code: 20,
  facebook: 200,
  instagram: 200,
  linkedin: 200,
  youtube: 200,
};

function publicUrl(path: string | null): string | null {
  if (!path || !supabase) return null;
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

/** Campo de imagem com previa, troca e remocao. O arquivo so sobe ao salvar. */
function ImagePicker({
  label,
  hint,
  types,
  maxBytes,
  currentUrl,
  file,
  removed,
  onPick,
  onRemove,
  error,
  previewClass,
}: {
  label: string;
  hint: string;
  types: Record<string, string>;
  maxBytes: number;
  currentUrl: string | null;
  file: File | null;
  removed: boolean;
  onPick: (file: File | null, error?: string) => void;
  onRemove: () => void;
  error?: string;
  previewClass: string;
}) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!file) return setObjectUrl(null);
    const url = URL.createObjectURL(file);
    setObjectUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  const shown = objectUrl ?? (removed ? null : currentUrl);
  return (
    <Field label={label} error={error} hint={hint}>
      {(p) => (
        <div className="mt-1.5 flex flex-wrap items-center gap-3">
          <div className={`grid shrink-0 place-items-center overflow-hidden rounded-btn-admin border border-dashed border-line bg-white ${previewClass}`}>
            {shown ? <img src={shown} alt={label} className="max-h-full max-w-full object-contain" /> : <span className="text-[11px] text-muted">Sem imagem</span>}
          </div>
          <div className="flex flex-col items-start gap-1.5">
            <label htmlFor={p.id} className="inline-flex cursor-pointer items-center gap-2 rounded-btn-admin border border-line bg-surface px-3 py-2 text-xs font-semibold text-navy-900 hover:bg-canvas">
              <ImageUp size={15} aria-hidden /> {shown ? "Trocar imagem" : "Enviar imagem"}
            </label>
            {shown && (
              <button type="button" onClick={onRemove} className="inline-flex items-center gap-1 text-[11px] font-semibold text-danger hover:underline">
                <Trash2 size={12} aria-hidden /> Remover
              </button>
            )}
          </div>
          <input
            id={p.id}
            type="file"
            accept={Object.keys(types).join(",")}
            className="sr-only"
            aria-describedby={p["aria-describedby"]}
            onChange={(e) => {
              const next = e.target.files?.[0] ?? null;
              e.target.value = "";
              if (!next) return;
              if (!types[next.type]) return onPick(null, `Formato não aceito. Use ${[...new Set(Object.values(types))].join(", ").toUpperCase()}.`);
              if (next.size > maxBytes) return onPick(null, `A imagem deve ter no máximo ${Math.round(maxBytes / 1024)} KB.`);
              onPick(next);
            }}
          />
        </div>
      )}
    </Field>
  );
}

/** Modulo White Label (so super_admin): marca e dados da empresa desta instalacao. */
export function WhiteLabel() {
  const { profile, loading } = useAuth();
  const toast = useToast();
  const [values, setValues] = useState<Values>(blank);
  const [row, setRow] = useState<CompanyRow | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [faviconFile, setFaviconFile] = useState<File | null>(null);
  const [removeLogo, setRemoveLogo] = useState(false);
  const [removeFavicon, setRemoveFavicon] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const isSuper = isSuperAdminRole(profile?.role);

  const load = useCallback(async () => {
    if (!supabase) return;
    const { data, error } = await supabase.from("company_settings").select(COLUMNS).maybeSingle();
    if (error) {
      toast.error("Não foi possível carregar os dados da empresa. Verifique se a migração do White Label foi aplicada.");
      setLoaded(true);
      return;
    }
    const next = data as unknown as CompanyRow | null;
    setRow(next);
    setValues(next ? (Object.fromEntries(TEXT_FIELDS.map((f) => [f, next[f] ?? ""])) as Values) : blank);
    setLogoFile(null);
    setFaviconFile(null);
    setRemoveLogo(false);
    setRemoveFavicon(false);
    setLoaded(true);
  }, [toast]);

  useEffect(() => {
    if (isSuper) void load();
  }, [isSuper, load]);

  if (loading) return null;
  if (!isSuper) return <Navigate to="/" replace />;

  const set = (key: TextField, value: string) => setValues((v) => ({ ...v, [key]: value }));
  const text = (key: TextField, label: string, opts?: { hint?: string; type?: string; className?: string; placeholder?: string }) => (
    <Field label={label} error={errors[key]} hint={opts?.hint} className={opts?.className}>
      {(p) => (
        <input
          {...p}
          type={opts?.type ?? "text"}
          maxLength={LIMITS[key]}
          placeholder={opts?.placeholder}
          autoComplete="off"
          className={inputClass}
          value={values[key]}
          onChange={(e) => set(key, e.target.value)}
        />
      )}
    </Field>
  );

  async function upload(file: File, kind: "logo" | "favicon", types: Record<string, string>): Promise<string | null> {
    if (!supabase) return null;
    const path = `${kind}-${Date.now()}.${types[file.type]}`;
    const { error } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type, cacheControl: "31536000" });
    return error ? null : path;
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!supabase) return;
    const next: Record<string, string> = {};
    if (values.company_name.trim().length < 2) next.company_name = "Informe o nome da empresa.";
    if (values.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) next.email = "Informe um e-mail válido.";
    for (const key of ["website", "facebook", "instagram", "linkedin", "youtube"] as const) {
      const v = values[key].trim();
      if (v && !/^https?:\/\//i.test(v)) next[key] = "Use o endereço completo, começando com https://";
    }
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    setBusy(true);

    let logoPath = removeLogo ? null : (row?.logo_path ?? null);
    let faviconPath = removeFavicon ? null : (row?.favicon_path ?? null);
    const uploaded: string[] = [];
    if (logoFile) {
      const path = await upload(logoFile, "logo", LOGO_TYPES);
      if (!path) {
        setBusy(false);
        return void toast.error("Não foi possível enviar a logo. Tente novamente.");
      }
      uploaded.push(path);
      logoPath = path;
    }
    if (faviconFile) {
      const path = await upload(faviconFile, "favicon", FAVICON_TYPES);
      if (!path) {
        if (uploaded.length) await supabase.storage.from(BUCKET).remove(uploaded);
        setBusy(false);
        return void toast.error("Não foi possível enviar o favicon. Tente novamente.");
      }
      uploaded.push(path);
      faviconPath = path;
    }

    const payload = { singleton: true, ...Object.fromEntries(TEXT_FIELDS.map((f) => [f, values[f].trim()])), logo_path: logoPath, favicon_path: faviconPath, updated_at: new Date().toISOString() };
    const { error } = await supabase.from("company_settings").upsert(payload);
    if (error) {
      if (uploaded.length) await supabase.storage.from(BUCKET).remove(uploaded);
      setBusy(false);
      return void toast.error(dbErrorMessage(error, {}));
    }
    // remove os arquivos substituidos
    const stale = [row?.logo_path !== logoPath ? row?.logo_path : null, row?.favicon_path !== faviconPath ? row?.favicon_path : null].filter((p): p is string => Boolean(p));
    if (stale.length) await supabase.storage.from(BUCKET).remove(stale);
    setBusy(false);
    toast.success("Dados da empresa salvos.");
    await load();
  }

  return (
    <div>
      <PageHeader title="White Label" description="Marca e dados da empresa desta instalação. Só o super administrador altera." action={<Badge tone={row ? "success" : "warning"}>{row ? "Configurado" : "Pendente"}</Badge>} />
      {!loaded ? (
        <p className="text-sm text-muted">Carregando...</p>
      ) : (
        <form onSubmit={onSubmit} noValidate className="space-y-5">
          <section className="rounded-[15px] border border-line bg-surface p-5 shadow-sm">
            <h2 className="mb-4 text-base text-navy-900">Marca</h2>
            <div className="grid gap-6 md:grid-cols-2">
              <ImagePicker
                label="Logo"
                hint="PNG, JPG ou WebP, até 2 MB. Fundo transparente funciona melhor."
                types={LOGO_TYPES}
                maxBytes={LOGO_MAX}
                currentUrl={publicUrl(row?.logo_path ?? null)}
                file={logoFile}
                removed={removeLogo}
                error={errors.logo}
                previewClass="h-24 w-44"
                onPick={(f, err) => {
                  setErrors((e) => ({ ...e, logo: err ?? "" }));
                  if (f) {
                    setLogoFile(f);
                    setRemoveLogo(false);
                  }
                }}
                onRemove={() => {
                  setLogoFile(null);
                  setRemoveLogo(true);
                }}
              />
              <ImagePicker
                label="Favicon"
                hint="PNG, WebP ou ICO, até 512 KB. Quadrado (ex.: 256 × 256)."
                types={FAVICON_TYPES}
                maxBytes={FAVICON_MAX}
                currentUrl={publicUrl(row?.favicon_path ?? null)}
                file={faviconFile}
                removed={removeFavicon}
                error={errors.favicon}
                previewClass="h-16 w-16"
                onPick={(f, err) => {
                  setErrors((e) => ({ ...e, favicon: err ?? "" }));
                  if (f) {
                    setFaviconFile(f);
                    setRemoveFavicon(false);
                  }
                }}
                onRemove={() => {
                  setFaviconFile(null);
                  setRemoveFavicon(true);
                }}
              />
            </div>
          </section>

          <section className="rounded-[15px] border border-line bg-surface p-5 shadow-sm">
            <h2 className="mb-4 text-base text-navy-900">Empresa</h2>
            <div className="grid gap-4 md:grid-cols-2">
              {text("company_name", "Nome da empresa", { hint: "Nome de exibição (site, painel, certificado)." })}
              {text("legal_name", "Razão social")}
              {text("cnpj", "CNPJ", { placeholder: "00.000.000/0001-00" })}
              {text("email", "E-mail", { type: "email" })}
              {text("phone", "Telefone", { placeholder: "(22) 0000-0000" })}
              {text("whatsapp", "WhatsApp", { hint: "Com DDD, só números ou formatado." })}
            </div>
          </section>

          <section className="rounded-[15px] border border-line bg-surface p-5 shadow-sm">
            <h2 className="mb-4 text-base text-navy-900">Localização</h2>
            <div className="grid gap-4 md:grid-cols-2">
              {text("address", "Endereço", { className: "md:col-span-2", hint: "Rua, número, complemento e bairro." })}
              {text("city", "Cidade")}
              {text("state", "Estado")}
              {text("postal_code", "CEP")}
            </div>
          </section>

          <section className="rounded-[15px] border border-line bg-surface p-5 shadow-sm">
            <h2 className="mb-4 text-base text-navy-900">Site e redes sociais</h2>
            <div className="grid gap-4 md:grid-cols-2">
              {text("website", "Site", { placeholder: "https://" })}
              {text("facebook", "Facebook", { placeholder: "https://facebook.com/..." })}
              {text("instagram", "Instagram", { placeholder: "https://instagram.com/..." })}
              {text("linkedin", "LinkedIn", { placeholder: "https://linkedin.com/company/..." })}
              {text("youtube", "YouTube", { placeholder: "https://youtube.com/..." })}
            </div>
          </section>

          <div className="flex items-center gap-3">
            <Button type="submit" disabled={busy}>
              {busy ? "Salvando..." : "Salvar"}
            </Button>
            <p className="text-xs text-muted">Logo, favicon e dados valem para as telas públicas e documentos conforme cada módulo for conectado.</p>
          </div>
        </form>
      )}
    </div>
  );
}
