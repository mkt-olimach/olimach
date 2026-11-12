// Gerador do PDF do certificado (A4 retrato, frente e verso). Sem dependencias de runtime alem de
// pdf-lib e qrcode (mapeadas em supabase/functions/deno.json para Deno e em package.json para os testes).
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { PDFFont, PDFPage } from "pdf-lib";
import QRCode from "qrcode";
import { LOGO_PNG_BASE64 } from "./logo.ts";

export interface Signer {
  name: string;
  qualification: string;
  registry: string;
  signature?: { bytes: Uint8Array; type: "png" | "jpg" } | null;
}

export interface CertificateData {
  code: string;
  studentName: string;
  /** CPF ja mascarado (***.456.789-**). Nunca o CPF completo. */
  cpfMasked: string;
  courseName: string;
  workloadHours: number;
  theoryHours: number;
  practiceHours: number;
  /** yyyy-mm-dd */
  startDate: string;
  endDate: string;
  location: string;
  issuedAt: Date;
  expiresAt: Date | null;
  syllabus: string;
  /** Engenheiro tecnico, diretoria e tecnico em seguranca (assinaturas padrao). Mais o campo em branco do aluno. */
  signers: Array<{ role: string; signer: Signer }>;
  companyName: string;
  companyCnpj: string;
  validationUrl: string;
}

const PAGE: [number, number] = [595.28, 841.89]; // A4 retrato
const NAVY = rgb(0x0b / 255, 0x1f / 255, 0x4d / 255);
const ORANGE = rgb(0xf2 / 255, 0x8a / 255, 0x1e / 255);
const GRAY = rgb(0x6b / 255, 0x76 / 255, 0x89 / 255);
const INK = rgb(0x1c / 255, 0x24 / 255, 0x33 / 255);
const MARGIN = 36;

/** Soma meses em UTC com o dia limitado ao fim do mes (igual ao make_interval do Postgres). */
export function addMonths(date: Date, months: number): Date {
  const result = new Date(date.getTime());
  const day = result.getUTCDate();
  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)).getUTCDate();
  result.setUTCDate(Math.min(day, lastDay));
  return result;
}

const pad = (n: number) => String(n).padStart(2, "0");
export const formatDate = (d: Date) => `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`;
export const formatDay = (iso: string) => {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
};

/** As fontes padrao do PDF so cobrem WinAnsi: troca o que fica fora por equivalentes simples. */
export function toWinAnsi(text: string): string {
  return text
    .replace(/[–—]/g, "-")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/•/g, "-")
    .replace(/[^\t\n\u0020-\u007e\u00a1-\u00ff]/g, "?");
}

/** Quebra o texto em linhas que cabem em maxWidth (respeita quebras de linha existentes). */
export function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const paragraph of toWinAnsi(text).split(/\r?\n/)) {
    if (paragraph.trim() === "") {
      lines.push("");
      continue;
    }
    let current = "";
    for (const word of paragraph.split(/\s+/)) {
      const candidate = current ? `${current} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= maxWidth) current = candidate;
      else {
        if (current) lines.push(current);
        current = word;
      }
    }
    if (current) lines.push(current);
  }
  return lines;
}

function drawCentered(page: PDFPage, text: string, y: number, font: PDFFont, size: number, color = INK, spacing = 0) {
  const clean = toWinAnsi(text);
  const width = font.widthOfTextAtSize(clean, size) + spacing * Math.max(0, clean.length - 1);
  page.drawText(clean, { x: (PAGE[0] - width) / 2, y, size, font, color, ...(spacing ? { characterSpacing: spacing } : {}) });
}

/** Reduz o corpo da fonte ate o texto caber em maxWidth (minimo minSize). */
function fitSize(text: string, font: PDFFont, size: number, maxWidth: number, minSize = 12): number {
  let current = size;
  while (current > minSize && font.widthOfTextAtSize(toWinAnsi(text), current) > maxWidth) current -= 0.5;
  return current;
}

function drawFrame(page: PDFPage) {
  page.drawRectangle({ x: 18, y: 18, width: PAGE[0] - 36, height: PAGE[1] - 36, borderColor: NAVY, borderWidth: 1.2 });
  page.drawRectangle({ x: 18, y: PAGE[1] - 26, width: 120, height: 8, color: ORANGE });
  page.drawRectangle({ x: PAGE[0] - 138, y: 18, width: 120, height: 8, color: ORANGE });
}

function drawQr(page: PDFPage, text: string, x: number, y: number, size: number) {
  const qr = QRCode.create(text, { errorCorrectionLevel: "M" });
  const count = qr.modules.size;
  const cell = size / count;
  for (let row = 0; row < count; row++) {
    for (let col = 0; col < count; col++) {
      if (qr.modules.get(row, col)) {
        page.drawRectangle({ x: x + col * cell, y: y + size - (row + 1) * cell, width: cell + 0.15, height: cell + 0.15, color: NAVY });
      }
    }
  }
}

async function drawSigner(doc: PDFDocument, page: PDFPage, signer: Signer | null, centerX: number, baseY: number, bold: PDFFont, regular: PDFFont, role: string) {
  const width = 210;
  if (signer?.signature) {
    const image = signer.signature.type === "png" ? await doc.embedPng(signer.signature.bytes) : await doc.embedJpg(signer.signature.bytes);
    const scale = Math.min(130 / image.width, 48 / image.height);
    page.drawImage(image, { x: centerX - (image.width * scale) / 2, y: baseY + 4, width: image.width * scale, height: image.height * scale });
  }
  page.drawLine({ start: { x: centerX - width / 2, y: baseY }, end: { x: centerX + width / 2, y: baseY }, thickness: 0.7, color: GRAY });
  const draw = (text: string, y: number, font: PDFFont, size: number, color = INK) => {
    const clean = toWinAnsi(text);
    const w = font.widthOfTextAtSize(clean, size);
    page.drawText(clean, { x: centerX - w / 2, y, size, font, color });
  };
  if (!signer) return;
  draw(signer.name, baseY - 12, bold, fitSize(signer.name, bold, 10, width + 20, 8));
  let ty = baseY - 23;
  for (const line of [signer.qualification, signer.registry]) {
    if (!line.trim()) continue;
    draw(line, ty, regular, fitSize(line, regular, 8, width + 20, 6.5), GRAY);
    ty -= 10;
  }
  draw(role, ty, bold, 7, NAVY);
}

export async function buildCertificatePdf(data: CertificateData): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`Certificado ${data.code}`);
  doc.setAuthor(data.companyName);
  doc.setSubject(`Certificado de conclusão: ${data.courseName}`);
  doc.setProducer("Olimach");
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const logo = await doc.embedPng(Uint8Array.from(atob(LOGO_PNG_BASE64), (c) => c.charCodeAt(0)));

  // ---------------------------------------------------------------- frente
  const front = doc.addPage(PAGE);
  drawFrame(front);
  const logoHeight = 84;
  const logoWidth = (logo.width / logo.height) * logoHeight;
  front.drawImage(logo, { x: (PAGE[0] - logoWidth) / 2, y: PAGE[1] - 40 - logoHeight, width: logoWidth, height: logoHeight });

  const textWidth = PAGE[0] - 2 * (MARGIN + 24);
  drawCentered(front, "CERTIFICADO", PAGE[1] - 190, bold, 30, NAVY, 2);
  drawCentered(front, "Certificamos que", PAGE[1] - 228, regular, 11, GRAY);
  const nameSize = fitSize(data.studentName, bold, 24, textWidth, 13);
  drawCentered(front, data.studentName, PAGE[1] - 260, bold, nameSize, INK);
  drawCentered(front, `CPF ${data.cpfMasked}`, PAGE[1] - 277, regular, 9, GRAY);
  drawCentered(front, "concluiu com aproveitamento o treinamento de", PAGE[1] - 306, regular, 11, GRAY);

  const courseLines = wrapText(data.courseName, bold, 17, textWidth).slice(0, 3);
  let y = PAGE[1] - 334;
  for (const line of courseLines) {
    drawCentered(front, line, y, bold, fitSize(line, bold, 17, textWidth, 11), NAVY);
    y -= 21;
  }
  const period = data.startDate === data.endDate ? formatDay(data.startDate) : `${formatDay(data.startDate)} a ${formatDay(data.endDate)}`;
  const workload = `carga horária total de ${data.workloadHours} horas (${data.theoryHours} h teóricas e ${data.practiceHours} h práticas)`;
  const detail = `com ${workload}, realizado em ${period}, em ${data.location}.`;
  const detailLines = wrapText(detail, regular, 10.5, textWidth);
  y -= 6;
  for (const line of detailLines) {
    drawCentered(front, line, y, regular, 10.5, INK);
    y -= 15;
  }
  const validity = data.expiresAt ? `Validade: ${formatDate(data.expiresAt)}` : "Certificado sem prazo de validade definido";
  drawCentered(front, `Emitido em ${formatDate(data.issuedAt)}  |  ${validity}`, y - 6, regular, 9.5, GRAY);

  // Quatro campos de assinatura em grade 2x2: aluno (em branco, com o nome abaixo) e as tres padrao.
  const leftX = PAGE[0] / 4 + 6;
  const rightX = (PAGE[0] * 3) / 4 - 6;
  const rowTop = 330;
  const rowBottom = 215;
  const student: Signer = { name: data.studentName, qualification: `CPF ${data.cpfMasked}`, registry: "", signature: null };
  await drawSigner(doc, front, student, leftX, rowTop, bold, regular, "Aluno");
  const standard = data.signers.slice(0, 3);
  const spots: Array<[number, number]> = [
    [rightX, rowTop],
    [leftX, rowBottom],
    [rightX, rowBottom],
  ];
  for (let i = 0; i < standard.length; i++) {
    const item = standard[i];
    const spot = spots[i];
    if (item && spot) await drawSigner(doc, front, item.signer, spot[0], spot[1], bold, regular, item.role);
  }

  // QR + codigo (canto inferior esquerdo)
  const qrSize = 66;
  const qrX = MARGIN + 14;
  const qrY = 70;
  drawQr(front, data.validationUrl, qrX, qrY, qrSize);
  front.drawText("Código de validação", { x: qrX + qrSize + 10, y: qrY + 50, size: 7, font: regular, color: GRAY });
  front.drawText(toWinAnsi(data.code), { x: qrX + qrSize + 10, y: qrY + 34, size: 14, font: bold, color: NAVY });
  const urlLines = wrapText(data.validationUrl, regular, 6.5, 260);
  urlLines.slice(0, 3).forEach((line, i) => front.drawText(line, { x: qrX + qrSize + 10, y: qrY + 22 - i * 8, size: 6.5, font: regular, color: GRAY }));

  drawCentered(front, toWinAnsi(`${data.companyName}  |  CNPJ ${data.companyCnpj}`), 28, regular, 8, GRAY);

  // ----------------------------------------------------------------- verso
  const bodySize = 10;
  const lineHeight = 14;
  const backWidth = PAGE[0] - MARGIN * 2 - 40;
  const lines = wrapText(data.syllabus.trim() || "Conteúdo programático não informado.", regular, bodySize, backWidth);
  let index = 0;
  let pageNumber = 0;
  while (index < lines.length || pageNumber === 0) {
    const back = doc.addPage(PAGE);
    pageNumber++;
    drawFrame(back);
    back.drawText("CONTEÚDO PROGRAMÁTICO", { x: MARGIN + 20, y: PAGE[1] - 66, size: 15, font: bold, color: NAVY });
    back.drawText(toWinAnsi(wrapText(data.courseName, regular, 10, backWidth)[0] ?? ""), { x: MARGIN + 20, y: PAGE[1] - 84, size: 10, font: regular, color: GRAY });
    back.drawLine({ start: { x: MARGIN + 20, y: PAGE[1] - 94 }, end: { x: PAGE[0] - MARGIN - 20, y: PAGE[1] - 94 }, thickness: 0.7, color: ORANGE });
    let ty = PAGE[1] - 116;
    while (index < lines.length && ty > 70) {
      const line = lines[index] ?? "";
      if (line) back.drawText(line, { x: MARGIN + 20, y: ty, size: bodySize, font: regular, color: INK });
      ty -= lineHeight;
      index++;
    }
    back.drawText(toWinAnsi(`Certificado ${data.code}  |  página ${pageNumber} do verso`), { x: MARGIN + 20, y: 34, size: 8, font: regular, color: GRAY });
    if (index >= lines.length) break;
  }

  return doc.save();
}

/** SHA-256 em hexadecimal (Web Crypto: Deno e Node). */
export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

