import { describe, expect, it } from "vitest";
import { buildCsv, csvCell } from "./csv";

describe("csv", () => {
  it("neutraliza formulas e escapa aspas", () => {
    expect(csvCell("=SOMA(A1)")).toBe(`"'=SOMA(A1)"`);
    expect(csvCell("+55")).toBe(`"'+55"`);
    expect(csvCell("@cmd")).toBe(`"'@cmd"`);
    expect(csvCell('Ana "Lu" Souza')).toBe('"Ana ""Lu"" Souza"');
    expect(csvCell("Maria")).toBe('"Maria"');
  });

  it("monta cabecalho, linhas com ; e BOM", () => {
    const csv = buildCsv(["A", "B"], [["1", "2"]]);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv.slice(1)).toBe('"A";"B"\r\n"1";"2"');
  });
});
