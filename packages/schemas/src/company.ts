import { z } from "zod";

const text = z.string().default("");

/** Linha devolvida por public.public_company(): dados de divulgacao da empresa (white label). */
export const publicCompanySchema = z.object({
  company_name: z.string().min(1),
  legal_name: text,
  cnpj: text,
  phone: text,
  whatsapp: text,
  email: text,
  website: text,
  business_hours: text,
  address: text,
  number: text,
  complement: text,
  neighborhood: text,
  city: text,
  state: text,
  postal_code: text,
  facebook: text,
  instagram: text,
  linkedin: text,
  youtube: text,
  logo_path: z.string().nullable().default(null),
  favicon_path: z.string().nullable().default(null),
  /** Cor de destaque do site (#rrggbb). null = laranja padrao. */
  accent_color: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable().catch(null).default(null),
});
export type PublicCompany = z.infer<typeof publicCompanySchema>;

/** Visao pronta para a interface: tudo que as telas exibem, ja montado. Campo vazio = dado nao configurado. */
export interface CompanyView {
  /** true quando veio do banco (modulo White Label); false = valores padrao da instalacao. */
  configured: boolean;
  name: string;
  legalName: string;
  cnpj: string;
  phone: string;
  whatsapp: string;
  /** Apenas digitos, com 55, pronto para wa.me. Vazio se nao houver WhatsApp valido. */
  whatsappDigits: string;
  email: string;
  website: string;
  businessHours: string;
  /** Rua, numero, complemento e bairro. */
  addressLine: string;
  /** Cidade, UF. */
  cityState: string;
  postalCode: string;
  /** Endereco completo em uma linha. */
  fullAddress: string;
  facebook: string;
  instagram: string;
  linkedin: string;
  youtube: string;
  logoUrl: string | null;
  faviconUrl: string | null;
  /** Cor de destaque escolhida (#rrggbb) ou null para o laranja padrao. */
  accentColor: string | null;
}

/** Padrao quando o White Label ainda nao foi configurado (mantem o comportamento original da instalacao). */
export const DEFAULT_COMPANY: PublicCompany = {
  company_name: "Olimach",
  legal_name: "",
  cnpj: "",
  phone: "",
  whatsapp: "(22) 99615-0138",
  email: "",
  website: "",
  business_hours: "Seg a sex 08h às 17h30, sáb 08h às 12h30",
  address: "",
  number: "",
  complement: "",
  neighborhood: "",
  city: "Macaé",
  state: "RJ",
  postal_code: "",
  facebook: "",
  instagram: "",
  linkedin: "",
  youtube: "",
  logo_path: null,
  favicon_path: null,
  accent_color: null,
};

/** WhatsApp para wa.me: so digitos; acrescenta 55 quando vier sem o codigo do pais (10 ou 11 digitos). */
export function whatsappDigits(value: string): string {
  const d = value.replace(/\D/g, "");
  if (d.length === 10 || d.length === 11) return `55${d}`;
  if ((d.length === 12 || d.length === 13) && d.startsWith("55")) return d;
  return "";
}

function join(parts: Array<string | undefined>, separator: string): string {
  return parts.map((p) => (p ?? "").trim()).filter(Boolean).join(separator);
}

/** Monta a visao da empresa. storageBase = URL do Supabase (para os arquivos do bucket publico "branding"). */
export function buildCompanyView(row: PublicCompany | null, storageBase: string | null, configured = row !== null): CompanyView {
  const c = row ?? DEFAULT_COMPANY;
  const file = (path: string | null) => (path && storageBase ? `${storageBase.replace(/\/$/, "")}/storage/v1/object/public/branding/${path.split("/").map(encodeURIComponent).join("/")}` : null);
  const street = join([join([c.address, c.number], ", "), c.complement], " - ");
  const addressLine = join([street, c.neighborhood], " - ");
  const cityState = join([c.city, c.state], ", ");
  return {
    configured,
    name: c.company_name.trim() || DEFAULT_COMPANY.company_name,
    legalName: c.legal_name.trim(),
    cnpj: c.cnpj.trim(),
    phone: c.phone.trim(),
    whatsapp: c.whatsapp.trim(),
    whatsappDigits: whatsappDigits(c.whatsapp),
    email: c.email.trim(),
    website: c.website.trim(),
    businessHours: c.business_hours.trim(),
    addressLine,
    cityState,
    postalCode: c.postal_code.trim(),
    fullAddress: join([addressLine, cityState, c.postal_code ? `CEP ${c.postal_code.trim()}` : ""], " - "),
    facebook: c.facebook.trim(),
    instagram: c.instagram.trim(),
    linkedin: c.linkedin.trim(),
    youtube: c.youtube.trim(),
    logoUrl: file(c.logo_path),
    faviconUrl: file(c.favicon_path),
    accentColor: c.accent_color ?? null,
  };
}

/** Laranja padrao da marca (token --orange-500). */
export const DEFAULT_ACCENT = "#f28a1e";

const hexToRgb = (hex: string): [number, number, number] => {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const toHex = (rgb: number[]) => `#${rgb.map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, "0")).join("")}`;

/** Tons derivados da cor de destaque: o base (orange-500) e o escuro do hover (orange-600, ~15% mais escuro). */
export function deriveAccent(hex: string): { base: string; dark: string; baseRgb: string; darkRgb: string } {
  const base = /^#[0-9a-fA-F]{6}$/.test(hex) ? hex.toLowerCase() : DEFAULT_ACCENT;
  const rgb = hexToRgb(base);
  const darkParts = rgb.map((v) => v * 0.85);
  return { base, dark: toHex(darkParts), baseRgb: rgb.join(" "), darkRgb: darkParts.map(Math.round).join(" ") };
}

/** Razao de contraste da cor com texto branco (WCAG). >= 3 e aceitavel para texto grande e botoes. */
export function contrastWithWhite(hex: string): number {
  const lin = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const [r, g, b] = hexToRgb(hex);
  const luminance = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  return 1.05 / (luminance + 0.05);
}
