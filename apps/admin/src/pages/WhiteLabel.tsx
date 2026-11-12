import { DEFAULT_ACCENT, contrastWithWhite, deriveAccent } from "@olimach/schemas";
import { Badge, Button } from "@olimach/ui";
import { ImageUp, Trash2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { Navigate } from "react-router-dom";
import { Field, PageHeader, dbErrorMessage, inputClass } from "../components/ui";
import { isSuperAdminRole, useAuth } from "../lib/auth";
import { useCompany } from "../lib/company";
import { isCepComplete, isPhoneComplete, maskCep, maskPhone, onlyDigits } from "../lib/masks";
import { supabase } from "../lib/supabase";
import { useToast } from "../lib/toast";

const BUCKET = "branding";
// PNG e JPG: sao os formatos que o gerador do PDF do certificado le.
const LOGO_TYPES: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg" };
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
  business_hours: string;
  address: string;
  number: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
  postal_code: string;
  facebook: string;
  instagram: string;
  linkedin: string;
  youtube: string;
  logo_path: string | null;
  logo_gray_path: string | null;
  favicon_path: string | null;
  accent_color: string | null;
}

const TEXT_FIELDS = ["company_name", "legal_name", "cnpj", "phone", "whatsapp", "email", "website", "business_hours", "address", "number", "complement", "neighborhood", "city", "state", "postal_code", "facebook", "instagram", "linkedin", "youtube"] as const;
type TextField = (typeof TEXT_FIELDS)[number];
type Values = Record<TextField, string>;

const COLUMNS = [...TEXT_FIELDS, "logo_path", "logo_gray_path", "favicon_path", "accent_color"].join(", ");
const blank: Values = Object.fromEntries(TEXT_FIELDS.map((f) => [f, ""])) as Values;

const LIMITS: Record<TextField, number> = {
  company_name: 120,
  legal_name: 160,
  cnpj: 24,
  phone: 40,
  whatsapp: 40,
  email: 160,
  website: 200,
  business_hours: 160,
  address: 200,
  number: 20,
  complement: 80,
  neighborhood: 80,
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

/** Gera a versao em escala de cinza da logo (PNG com transparencia), usada como marca d'agua no certificado. */
async function makeGrayLogo(file: File): Promise<Blob | null> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = reject;
      el.src = url;
    });
    const scale = Math.min(1, 700 / img.naturalWidth);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
    for (let i = 0; i < data.data.length; i += 4) {
      const gray = Math.round(0.299 * data.data[i]! + 0.587 * data.data[i + 1]! + 0.114 * data.data[i + 2]!);
      data.data[i] = data.data[i + 1] = data.data[i + 2] = gray;
    }
    ctx.putImageData(data, 0, 0);
    return await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
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

/** Seletor de cor (color picker nativo + codigo hexadecimal) com previa e aviso de contraste. */
function AccentPicker({ value, onChange }: { value: string | null; onChange: (next: string | null) => void }) {
  const current = value ?? DEFAULT_ACCENT;
  const [hex, setHex] = useState(current);
  useEffect(() => setHex(current), [current]);
  const tones = deriveAccent(current);
  const contrast = contrastWithWhite(tones.base);
  const valid = (v: string) => /^#[0-9a-fA-F]{6}$/.test(v);
  return (
    <div className="flex flex-wrap items-start gap-6">
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <label htmlFor="accent-picker" className="sr-only">
            Escolher cor de destaque
          </label>
          <input
            id="accent-picker"
            type="color"
            value={current}
            onChange={(e) => onChange(e.target.value.toLowerCase())}
            className="h-12 w-16 cursor-pointer rounded-btn-admin border border-line bg-white p-1"
          />
          <Field label="Código da cor" error={hex && !valid(hex) ? "Use o formato #RRGGBB." : undefined} className="w-36">
            {(p) => (
              <input
                {...p}
                value={hex}
                maxLength={7}
                spellCheck={false}
                autoComplete="off"
                className={`${inputClass} font-mono uppercase`}
                onChange={(e) => {
                  const raw = e.target.value.trim();
                  const next = raw.startsWith("#") ? raw : `#${raw}`;
                  setHex(next);
                  if (valid(next)) onChange(next.toLowerCase());
                }}
              />
            )}
          </Field>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <Button type="button" variant="secondary" onClick={() => onChange(null)} disabled={value === null}>
            Restaurar laranja padrão
          </Button>
          {value === null && <span className="text-muted">Usando o padrão da marca.</span>}
        </div>
        {contrast < 3 && (
          <p role="alert" className="max-w-sm rounded-btn-admin bg-warning/15 p-2.5 text-xs text-ink">
            Cor muito clara: o texto branco dos botões pode ficar difícil de ler. Prefira um tom mais escuro.
          </p>
        )}
      </div>
      <div>
        <p className="mb-1.5 text-xs font-semibold text-navy-900">Pré-visualização</p>
        <div className="flex flex-wrap items-center gap-3 rounded-[12px] border border-line bg-white p-4">
          <span className="rounded-full px-5 py-2.5 text-xs font-bold text-white" style={{ backgroundColor: tones.base }}>
            Botão de destaque
          </span>
          <span className="rounded-full px-5 py-2.5 text-xs font-bold text-white" style={{ backgroundColor: tones.dark }}>
            Ao passar o mouse
          </span>
          <span className="text-xs font-extrabold uppercase tracking-[0.15em]" style={{ color: tones.dark }}>
            Detalhe
          </span>
        </div>
      </div>
    </div>
  );
}

/** Modulo White Label (so super_admin): marca e dados da empresa desta instalacao. */
export function WhiteLabel() {
  const { profile, loading } = useAuth();
  const toast = useToast();
  const { reload: reloadCompany } = useCompany();
  const [values, setValues] = useState<Values>(blank);
  const [row, setRow] = useState<CompanyRow | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [faviconFile, setFaviconFile] = useState<File | null>(null);
  const [removeLogo, setRemoveLogo] = useState(false);
  const [removeFavicon, setRemoveFavicon] = useState(false);
  const [accent, setAccent] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [cepStatus, setCepStatus] = useState<{ tone: "info" | "error"; text: string } | null>(null);
  const lastCep = useRef("");
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
    setAccent(next?.accent_color ?? null);
    setLoaded(true);
  }, [toast]);

  useEffect(() => {
    if (isSuper) void load();
  }, [isSuper, load]);

  if (loading) return null;
  if (!isSuper) return <Navigate to="/" replace />;

  const set = (key: TextField, value: string) => setValues((v) => ({ ...v, [key]: value }));

  /** Preenche logradouro, bairro, cidade e estado a partir do CEP (ViaCEP). Numero e complemento ficam com voce. */
  async function lookupCep(masked: string) {
    const cep = onlyDigits(masked);
    if (cep.length !== 8 || cep === lastCep.current) return;
    lastCep.current = cep;
    setCepStatus({ tone: "info", text: "Buscando endereço..." });
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      if (!response.ok) throw new Error(String(response.status));
      const data = (await response.json()) as { erro?: boolean | string; logradouro?: string; bairro?: string; localidade?: string; uf?: string };
      if (data.erro) {
        lastCep.current = "";
        return setCepStatus({ tone: "error", text: "CEP não encontrado. Preencha o endereço manualmente." });
      }
      setValues((v) => ({
        ...v,
        address: data.logradouro?.trim() || v.address,
        neighborhood: data.bairro?.trim() || v.neighborhood,
        city: data.localidade?.trim() || v.city,
        state: data.uf?.trim() || v.state,
      }));
      setCepStatus({ tone: "info", text: "Endereço preenchido pelo CEP. Complete número e complemento." });
    } catch {
      lastCep.current = "";
      setCepStatus({ tone: "error", text: "Não foi possível consultar o CEP agora. Preencha o endereço manualmente." });
    }
  }
  const text = (key: TextField, label: string, opts?: { hint?: string; type?: string; className?: string; placeholder?: string; mask?: (v: string) => string; inputMode?: "tel" | "numeric" }) => (
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
          inputMode={opts?.inputMode}
          onChange={(e) => set(key, opts?.mask ? opts.mask(e.target.value) : e.target.value)}
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
    for (const key of ["phone", "whatsapp"] as const) {
      if (values[key].trim() && !isPhoneComplete(values[key])) next[key] = "Informe DDD e número, ex.: (22) 99999-9999.";
    }
    if (values.postal_code.trim() && !isCepComplete(values.postal_code)) next.postal_code = "O CEP deve ter 8 dígitos.";
    for (const key of ["website", "facebook", "instagram", "linkedin", "youtube"] as const) {
      const v = values[key].trim();
      if (v && !/^https?:\/\//i.test(v)) next[key] = "Use o endereço completo, começando com https://";
    }
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    setBusy(true);

    let logoPath = removeLogo ? null : (row?.logo_path ?? null);
    let logoGrayPath = removeLogo ? null : (row?.logo_gray_path ?? null);
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
      // versao em cinza para a marca d'agua do certificado (se falhar, o certificado usa a logo no lugar)
      const gray = await makeGrayLogo(logoFile);
      logoGrayPath = null;
      if (gray) {
        const grayPath = `logo-gray-${Date.now()}.png`;
        const { error: grayError } = await supabase.storage.from(BUCKET).upload(grayPath, gray, { contentType: "image/png", cacheControl: "31536000" });
        if (!grayError) {
          uploaded.push(grayPath);
          logoGrayPath = grayPath;
        }
      }
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

    const payload = { singleton: true, ...Object.fromEntries(TEXT_FIELDS.map((f) => [f, values[f].trim()])), logo_path: logoPath, logo_gray_path: logoGrayPath, favicon_path: faviconPath, accent_color: accent, updated_at: new Date().toISOString() };
    const { error } = await supabase.from("company_settings").upsert(payload);
    if (error) {
      if (uploaded.length) await supabase.storage.from(BUCKET).remove(uploaded);
      setBusy(false);
      return void toast.error(dbErrorMessage(error, {}));
    }
    // remove os arquivos substituidos
    const stale = [row?.logo_path !== logoPath ? row?.logo_path : null, row?.logo_gray_path !== logoGrayPath ? row?.logo_gray_path : null, row?.favicon_path !== faviconPath ? row?.favicon_path : null].filter((p): p is string => Boolean(p));
    if (stale.length) await supabase.storage.from(BUCKET).remove(stale);
    setBusy(false);
    toast.success("Dados da empresa salvos.");
    await Promise.all([load(), reloadCompany()]);
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
                hint="PNG ou JPG, até 2 MB. PNG com fundo transparente funciona melhor. Também é usada no certificado."
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
            <h2 className="mb-1 text-base text-navy-900">Cor de destaque</h2>
            <p className="mb-4 text-xs text-muted">Substitui o laranja da marca em botões, selos e detalhes do site.</p>
            <AccentPicker value={accent} onChange={setAccent} />
          </section>

          <section className="rounded-[15px] border border-line bg-surface p-5 shadow-sm">
            <h2 className="mb-4 text-base text-navy-900">Empresa</h2>
            <div className="grid gap-4 md:grid-cols-2">
              {text("company_name", "Nome da empresa", { hint: "Nome de exibição (site, painel, certificado)." })}
              {text("legal_name", "Razão social")}
              {text("cnpj", "CNPJ", { placeholder: "00.000.000/0001-00" })}
              {text("email", "E-mail", { type: "email" })}
              {text("phone", "Telefone", { placeholder: "(22) 0000-0000", mask: maskPhone, inputMode: "tel" })}
              {text("business_hours", "Horário de atendimento", { className: "md:col-span-2", hint: "Ex.: Seg a sex 08h às 17h30, sáb 08h às 12h30." })}
              {text("whatsapp", "WhatsApp", { placeholder: "(22) 90000-0000", hint: "Com DDD.", mask: maskPhone, inputMode: "tel" })}
            </div>
          </section>

          <section className="rounded-[15px] border border-line bg-surface p-5 shadow-sm">
            <h2 className="mb-4 text-base text-navy-900">Localização</h2>
            <div className="grid gap-4 md:grid-cols-6">
              <Field label="CEP" error={errors.postal_code ?? (cepStatus?.tone === "error" ? cepStatus.text : undefined)} hint={cepStatus?.tone === "info" ? cepStatus.text : undefined} className="md:col-span-2">
                {(p) => (
                  <input
                    {...p}
                    inputMode="numeric"
                    maxLength={9}
                    placeholder="00000-000"
                    autoComplete="off"
                    className={inputClass}
                    value={values.postal_code}
                    onChange={(e) => {
                      const masked = maskCep(e.target.value);
                      set("postal_code", masked);
                      if (masked.length < 9) setCepStatus(null);
                      else void lookupCep(masked);
                    }}
                    onBlur={() => void lookupCep(values.postal_code)}
                  />
                )}
              </Field>
              {text("address", "Endereço", { className: "md:col-span-4", hint: "Rua ou avenida. Preenchido pelo CEP." })}
              {text("number", "Número", { className: "md:col-span-2" })}
              {text("complement", "Complemento", { className: "md:col-span-4", hint: "Sala, andar, bloco, galpão..." })}
              {text("neighborhood", "Bairro", { className: "md:col-span-2" })}
              {text("city", "Cidade", { className: "md:col-span-3" })}
              {text("state", "Estado", { className: "md:col-span-1" })}
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
