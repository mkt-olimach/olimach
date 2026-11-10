/** Protege a planilha contra injecao de formulas (celulas que comecam com = + - @). */
export function csvCell(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return `"${safe.replace(/"/g, '""')}"`;
}

/** Excel abre o CSV em UTF-8 com acentos corretos quando ha BOM. */
const BOM = String.fromCharCode(0xfeff);

/** CSV com separador ";" (padrao do Excel em pt-BR), cabecalho e celulas protegidas. */
export function buildCsv(header: string[], rows: string[][]): string {
  const lines = [header, ...rows].map((row) => row.map(csvCell).join(";"));
  return `${BOM}${lines.join("\r\n")}`;
}
