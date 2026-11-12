/** Mascaras de digitacao (so formatacao; a validacao fica no formulario). */
const digits = (value: string) => value.replace(/\D/g, "");

/** Telefone BR: (22) 9999-9999 (fixo) ou (22) 99999-9999 (celular). */
export function maskPhone(value: string): string {
  const d = digits(value).slice(0, 11);
  if (d.length === 0) return "";
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

/** CEP: 00000-000. */
export function maskCep(value: string): string {
  const d = digits(value).slice(0, 8);
  return d.length <= 5 ? d : `${d.slice(0, 5)}-${d.slice(5)}`;
}

/** true quando o telefone tem DDD + 8 ou 9 digitos. */
export const isPhoneComplete = (value: string): boolean => [10, 11].includes(digits(value).length);
export const isCepComplete = (value: string): boolean => digits(value).length === 8;
export const onlyDigits = digits;
