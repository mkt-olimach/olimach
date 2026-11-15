import { maskPhone, onlyDigits } from "./masks";

export interface Country {
  iso: string;
  name: string;
  dial: string;
  flag: string;
}

/** Paises mais comuns para alunos da operacao; Brasil primeiro (padrao). */
export const COUNTRIES: Country[] = [
  { iso: "BR", name: "Brasil", dial: "55", flag: "🇧🇷" },
  { iso: "PT", name: "Portugal", dial: "351", flag: "🇵🇹" },
  { iso: "US", name: "Estados Unidos", dial: "1", flag: "🇺🇸" },
  { iso: "AR", name: "Argentina", dial: "54", flag: "🇦🇷" },
  { iso: "UY", name: "Uruguai", dial: "598", flag: "🇺🇾" },
  { iso: "PY", name: "Paraguai", dial: "595", flag: "🇵🇾" },
  { iso: "CL", name: "Chile", dial: "56", flag: "🇨🇱" },
  { iso: "CO", name: "Colômbia", dial: "57", flag: "🇨🇴" },
  { iso: "VE", name: "Venezuela", dial: "58", flag: "🇻🇪" },
  { iso: "BO", name: "Bolívia", dial: "591", flag: "🇧🇴" },
  { iso: "PE", name: "Peru", dial: "51", flag: "🇵🇪" },
  { iso: "MX", name: "México", dial: "52", flag: "🇲🇽" },
  { iso: "AO", name: "Angola", dial: "244", flag: "🇦🇴" },
  { iso: "MZ", name: "Moçambique", dial: "258", flag: "🇲🇿" },
  { iso: "ES", name: "Espanha", dial: "34", flag: "🇪🇸" },
  { iso: "GB", name: "Reino Unido", dial: "44", flag: "🇬🇧" },
  { iso: "NO", name: "Noruega", dial: "47", flag: "🇳🇴" },
];

export const DEFAULT_COUNTRY = COUNTRIES[0] as Country;

/** Mascara do numero nacional: Brasil com DDD; demais paises em grupos de 3 digitos. */
export function maskNational(country: Country, value: string): string {
  if (country.iso === "BR") return maskPhone(value);
  const d = onlyDigits(value).slice(0, 12);
  return d.replace(/(\d{3})(?=\d)/g, "$1 ");
}

/** Brasil: DDD + 8 ou 9 digitos. Demais: de 6 a 12 digitos. */
export function isNationalValid(country: Country, value: string): boolean {
  const n = onlyDigits(value).length;
  return country.iso === "BR" ? n === 10 || n === 11 : n >= 6 && n <= 12;
}

/** Valor gravado: "+55 (22) 99999-9999". Vazio quando nao ha numero. */
export function composePhone(country: Country, national: string): string {
  const masked = maskNational(country, national);
  return masked ? `+${country.dial} ${masked}` : "";
}

/** Le um telefone gravado (com ou sem "+pais"); sem pais, assume Brasil (cadastros antigos). */
export function parsePhone(value: string | null | undefined): { country: Country; national: string } {
  const raw = (value ?? "").trim();
  if (raw.startsWith("+")) {
    const digits = onlyDigits(raw);
    const match = [...COUNTRIES].sort((a, b) => b.dial.length - a.dial.length).find((c) => digits.startsWith(c.dial));
    if (match) return { country: match, national: maskNational(match, digits.slice(match.dial.length)) };
  }
  const digits = onlyDigits(raw);
  const national = digits.length > 11 && digits.startsWith("55") ? digits.slice(2) : digits;
  return { country: DEFAULT_COUNTRY, national: maskNational(DEFAULT_COUNTRY, national) };
}

/** Digitos para wa.me (com pais). Vazio se o numero nao parece valido. */
export function phoneToWhatsapp(value: string | null | undefined): string {
  const { country, national } = parsePhone(value);
  return isNationalValid(country, national) ? `${country.dial}${onlyDigits(national)}` : "";
}
