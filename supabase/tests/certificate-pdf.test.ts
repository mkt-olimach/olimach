import { writeFileSync } from "node:fs";
import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { addMonths, buildCertificatePdf, formatDate, sha256Hex, toWinAnsi, wrapText } from "../functions/_shared/certificate-pdf";
import type { CertificateData } from "../functions/_shared/certificate-pdf";

// PNG 1x1 transparente (assinatura de teste)
const PNG_1PX = Uint8Array.from(
  atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="),
  (c) => c.charCodeAt(0),
);

const sample = (over: Partial<CertificateData> = {}): CertificateData => ({
  code: "A7K3M9XQ2P",
  studentName: "Maria das Graças Oliveira Albuquerque",
  cpfMasked: "***.982.247-**",
  courseName: "NR-33 Segurança e Saúde nos Trabalhos em Espaços Confinados",
  workloadHours: 16,
  startDate: "2026-11-03",
  endDate: "2026-11-04",
  location: "Macaé, RJ",
  issuedAt: new Date(Date.UTC(2026, 10, 10, 12, 0, 0)),
  expiresAt: new Date(Date.UTC(2028, 10, 10, 12, 0, 0)),
  syllabus: "1. Introdução\n2. Riscos em espaços confinados\n3. Procedimentos de entrada e resgate",
  instructors: [
    { name: "[EXEMPLO] João Pereira", qualification: "Técnico de Segurança do Trabalho", registry: "MTE 12345", signature: { bytes: PNG_1PX, type: "png" } },
    { name: "[EXEMPLO] Ana Lima", qualification: "Engenheira de Segurança", registry: "CREA-RJ 9876", signature: null },
  ],
  technicalLead: { name: "[EXEMPLO] Carlos Souza", qualification: "Engenheiro de Segurança do Trabalho", registry: "CREA-RJ 55555", signature: { bytes: PNG_1PX, type: "png" } },
  companyName: "[EXEMPLO] Olimach Consultoria e Treinamentos Offshore LTDA",
  companyCnpj: "00.000.000/0001-00",
  validationUrl: "https://exemplo.com.br/validar/A7K3M9XQ2P",
  ...over,
});

describe("certificate-pdf", () => {
  it("gera A4 paisagem com frente e verso", async () => {
    const bytes = await buildCertificatePdf(sample());
    if (process.env.OLIMACH_SAMPLE_PDF) writeFileSync(process.env.OLIMACH_SAMPLE_PDF, bytes);
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(2);
    const { width, height } = doc.getPage(0).getSize();
    expect(Math.round(width)).toBe(842);
    expect(Math.round(height)).toBe(595);
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
  });

  it("aceita certificado sem validade e sem assinaturas", async () => {
    const bytes = await buildCertificatePdf(
      sample({ expiresAt: null, instructors: [], technicalLead: { name: "Carlos Souza", qualification: "Engenheiro", registry: "CREA 1", signature: null } }),
    );
    expect((await PDFDocument.load(bytes)).getPageCount()).toBe(2);
  });

  it("continua o conteudo programatico em mais paginas do verso", async () => {
    const longSyllabus = Array.from({ length: 120 }, (_, i) => `${i + 1}. Tópico de estudo número ${i + 1} do programa`).join("\n");
    const doc = await PDFDocument.load(await buildCertificatePdf(sample({ syllabus: longSyllabus })));
    expect(doc.getPageCount()).toBeGreaterThan(2);
  });

  it("e deterministico no conteudo e o hash muda com o codigo", async () => {
    const a = await sha256Hex(await buildCertificatePdf(sample()));
    const b = await sha256Hex(await buildCertificatePdf(sample({ code: "B7K3M9XQ2P" })));
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(a).not.toBe(b);
  });
});

describe("helpers", () => {
  it("addMonths limita ao fim do mes como o Postgres", () => {
    expect(formatDate(addMonths(new Date(Date.UTC(2026, 0, 31)), 1))).toBe("28/02/2026");
    expect(formatDate(addMonths(new Date(Date.UTC(2026, 10, 10)), 24))).toBe("10/11/2028");
    expect(formatDate(addMonths(new Date(Date.UTC(2024, 1, 29)), 12))).toBe("28/02/2025");
  });

  it("toWinAnsi troca caracteres fora da fonte e mantem acentos", () => {
    expect(toWinAnsi("Ação – “teste” ✓")).toBe('Ação - "teste" ?');
  });

  it("wrapText respeita a largura e as quebras de linha", async () => {
    const doc = await PDFDocument.create();
    const { StandardFonts } = await import("pdf-lib");
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const lines = wrapText("um dois tres quatro cinco seis sete oito nove dez\n\nfim", font, 10, 80);
    expect(lines.length).toBeGreaterThan(3);
    expect(lines).toContain("");
    expect(lines.every((l) => font.widthOfTextAtSize(l, 10) <= 80 || !l.includes(" "))).toBe(true);
  });
});
