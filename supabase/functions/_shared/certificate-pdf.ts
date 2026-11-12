// Gerador do PDF do certificado (A4 retrato: conteudo na primeira pagina, continuacao do conteudo programatico na segunda). Sem dependencias de runtime alem de
// pdf-lib e qrcode (mapeadas em supabase/functions/deno.json para Deno e em package.json para os testes).
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { PDFFont, PDFPage } from "pdf-lib";
import QRCode from "qrcode";
import { LOGO_PNG_BASE64 } from "./logo.ts";
import { LOGO_GRAY_PNG_BASE64 } from "./logo-gray.ts";

export interface Signer {
  name: string;
  qualification: string;
  registry: string;
  signature?: { bytes: Uint8Array; type: "png" | "jpg" } | null;
  /** Ajuste da assinatura (pt) em relacao a posicao padrao: x e y (y positivo sobe) e multiplicador de tamanho. */
  adjust?: { x: number; y: number; scale: number } | null;
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
  /** Normas e padroes de referencia (pode ser vazio). */
  technicalReference: string;
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
  /** Logo e logo em cinza (marca d'agua) do White Label. Sem elas, usa a logo padrao. */
  companyLogo?: { bytes: Uint8Array; type: "png" | "jpg" } | null;
  companyLogoGray?: { bytes: Uint8Array; type: "png" | "jpg" } | null;
  /** Endereco, telefone, e-mail e site para o rodape (uma linha; pode ser vazio). */
  companyContact?: string;
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

/** Campo de assinatura (igual a pre-visualizacao do painel): imagem sobre a linha; nome, qualificacao, registro e funcao abaixo. */
async function drawSigner(doc: PDFDocument, page: PDFPage, signer: Signer | null, centerX: number, lineY: number, bold: PDFFont, regular: PDFFont, role: string) {
  const width = 215;
  const draw = (text: string, y: number, font: PDFFont, size: number, color = INK) => {
    const clean = toWinAnsi(text);
    page.drawText(clean, { x: centerX - font.widthOfTextAtSize(clean, size) / 2, y, size, font, color });
  };
  page.drawLine({ start: { x: centerX - width / 2, y: lineY }, end: { x: centerX + width / 2, y: lineY }, thickness: 0.7, color: GRAY });
  let ty = lineY - 13;
  if (signer) {
    draw(signer.name, ty, bold, fitSize(signer.name, bold, 9.5, width + 30, 7.5));
    ty -= 11;
    for (const line of [signer.qualification, signer.registry]) {
      if (!line.trim()) continue;
      draw(line, ty, regular, fitSize(line, regular, 8, width + 30, 6.5), GRAY);
      ty -= 10;
    }
  }
  draw(role.toUpperCase(), ty - 1, bold, 7, NAVY);
  // Assinatura por ultimo: fica em primeiro plano e pode cobrir a linha e os textos.
  if (signer?.signature) {
    const image = signer.signature.type === "png" ? await doc.embedPng(signer.signature.bytes) : await doc.embedJpg(signer.signature.bytes);
    const adjust = signer.adjust ?? { x: 0, y: 0, scale: 1 };
    const scale = Math.min(190 / image.width, 46 / image.height) * adjust.scale;
    const w = image.width * scale;
    const h = image.height * scale;
    page.drawImage(image, { x: centerX + adjust.x - w / 2, y: lineY + 4 + adjust.y, width: w, height: h });
  }
}

export async function buildCertificatePdf(data: CertificateData): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`Certificado ${data.code}`);
  doc.setAuthor(data.companyName);
  doc.setSubject(`Certificado de conclusão: ${data.courseName}`);
  doc.setProducer("Olimach");
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const embedImage = async (image: { bytes: Uint8Array; type: "png" | "jpg" } | null | undefined) => {
    if (!image) return null;
    try {
      return image.type === "png" ? await doc.embedPng(image.bytes) : await doc.embedJpg(image.bytes);
    } catch {
      return null; // imagem invalida: cai na logo padrao
    }
  };
  const customLogo = await embedImage(data.companyLogo);
  const logo = customLogo ?? (await doc.embedPng(Uint8Array.from(atob(LOGO_PNG_BASE64), (c) => c.charCodeAt(0))));

  const watermark =
    (await embedImage(data.companyLogoGray)) ?? customLogo ?? (await doc.embedPng(Uint8Array.from(atob(LOGO_GRAY_PNG_BASE64), (c) => c.charCodeAt(0))));
  const drawWatermark = (page: PDFPage) => {
    const width = 470;
    const height = (watermark.height / watermark.width) * width;
    page.drawImage(watermark, { x: (PAGE[0] - width) / 2, y: (PAGE[1] - height) / 2, width, height, opacity: 0.07 });
  };

  // ---------------------------------------------------------------- frente
  const front = doc.addPage(PAGE);
  drawWatermark(front);
  drawFrame(front);
  const left = MARGIN + 24;
  const right = PAGE[0] - MARGIN - 24;
  const textWidth = right - left;

  // Topo: codigo e QR a esquerda, titulo ao centro, logo a direita
  const qrSize = 58;
  const qrX = left - 14;
  const qrY = PAGE[1] - 52 - qrSize;
  front.drawText(toWinAnsi(`Certificado: ${data.code}`), { x: qrX, y: PAGE[1] - 44, size: 7.5, font: bold, color: NAVY });
  drawQr(front, data.validationUrl, qrX, qrY, qrSize);
  const logoHeight = 54;
  const logoWidth = (logo.width / logo.height) * logoHeight;
  front.drawImage(logo, { x: right + 14 - logoWidth, y: PAGE[1] - 40 - logoHeight, width: logoWidth, height: logoHeight });
  drawCentered(front, "CERTIFICADO", PAGE[1] - 92, bold, 24, GRAY, 1.5);
  drawCentered(front, data.companyName, PAGE[1] - 108, regular, 8.5, GRAY);

  drawCentered(front, "Certificamos que", PAGE[1] - 148, regular, 10, GRAY);
  drawCentered(front, data.studentName, PAGE[1] - 168, bold, fitSize(data.studentName, bold, 18, textWidth, 11), INK);
  drawCentered(front, `CPF ${data.cpfMasked}`, PAGE[1] - 181, regular, 8, GRAY);
  drawCentered(front, "concluiu com aproveitamento o treinamento", PAGE[1] - 198, regular, 10, GRAY);

  const courseLines = wrapText(`${data.courseName} - ${data.workloadHours}h`, bold, 14, textWidth).slice(0, 3);
  let y = PAGE[1] - 220;
  for (const line of courseLines) {
    drawCentered(front, line, y, bold, fitSize(line, bold, 14, textWidth, 10), NAVY);
    y -= 17;
  }
  y -= 12;

  // Conteudo programatico; o que nao couber continua na segunda pagina.
  const bodySize = 8.5;
  const lineHeight = 11;
  const lines = wrapText(data.syllabus.trim() || "Conteúdo programático não informado.", regular, bodySize, textWidth);
  const refText = data.technicalReference.trim() ? `Referência Técnica: ${data.technicalReference.trim()}` : "";
  const refLines = refText ? wrapText(refText, regular, 8, textWidth) : [];
  // bloco de carga horaria, referencia tecnica e datas (altura) + margem acima da grade de assinaturas
  const infoHeight = 14 + (refLines.length ? refLines.length * 10 + 8 : 0) + 26 + 14 + 10;
  const frontFloor = 320 + infoHeight;
  front.drawText("CONTEÚDO:", { x: left, y, size: 9, font: bold, color: INK });
  y -= 14;
  let index = 0;
  while (index < lines.length && y > frontFloor) {
    const line = lines[index] ?? "";
    if (line) front.drawText(line, { x: left, y, size: bodySize, font: regular, color: INK });
    y -= lineHeight;
    index++;
  }
  const overflow = index < lines.length;
  if (overflow) {
    front.drawText("Continua na página seguinte.", { x: left, y: Math.max(y, frontFloor - 4), size: 7.5, font: regular, color: GRAY });
    y = frontFloor - 16;
  }

  // Carga horaria e datas, logo abaixo do conteudo
  y -= 10;
  const hours = (n: number) => (n > 0 ? `${String(n).padStart(2, "0")}h` : "N/A");
  front.drawText(toWinAnsi(`Teoria: ${hours(data.theoryHours)}`), { x: left, y, size: 9, font: regular, color: INK });
  front.drawText(toWinAnsi(`Prática: ${hours(data.practiceHours)}`), { x: left + 150, y, size: 9, font: regular, color: INK });
  front.drawText(toWinAnsi(`Carga Horária: ${hours(data.workloadHours)}`), { x: left + 300, y, size: 9, font: regular, color: INK });
  y -= 14;
  if (refLines.length) {
    y -= 4;
    for (const line of refLines) {
      front.drawText(line, { x: left, y, size: 8, font: regular, color: INK });
      y -= 10;
    }
    y -= 4;
  }
  y -= 12;
  const dots = (d: Date) => formatDate(d).replace(/\//g, ".");
  const dotsDay = (iso: string) => formatDay(iso).replace(/\//g, ".");
  const period = data.startDate === data.endDate ? dotsDay(data.startDate) : `${dotsDay(data.startDate)} a ${dotsDay(data.endDate)}`;
  front.drawText(toWinAnsi(`Período: ${period}`), { x: left, y, size: 9, font: bold, color: INK });
  const emitted = toWinAnsi(`Emitido: ${dots(data.issuedAt)}`);
  front.drawText(emitted, { x: right - bold.widthOfTextAtSize(emitted, 9), y, size: 9, font: bold, color: INK });
  y -= 14;
  front.drawText(toWinAnsi(data.expiresAt ? `Válido até: ${dots(data.expiresAt)}` : "Sem prazo de validade definido"), { x: left, y, size: 9, font: bold, color: INK });
  front.drawText(toWinAnsi(`Local: ${data.location}`), { x: right - regular.widthOfTextAtSize(toWinAnsi(`Local: ${data.location}`), 8.5), y, size: 8.5, font: regular, color: GRAY });

  // Assinaturas em grade 2x2 (ordem do modelo): diretoria, engenheiro tecnico, tecnico em seguranca e aluno
  const leftX = PAGE[0] / 4 + 6;
  const rightX = (PAGE[0] * 3) / 4 - 6;
  const rowTop = 252;
  const rowBottom = 132;
  const byOrder = [data.signers[1], data.signers[0], data.signers[2]];
  const spots: Array<[number, number]> = [
    [leftX, rowTop],
    [rightX, rowTop],
    [leftX, rowBottom],
  ];
  for (let i = 0; i < byOrder.length; i++) {
    const item = byOrder[i];
    const spot = spots[i];
    if (item && spot) await drawSigner(doc, front, item.signer, spot[0], spot[1], bold, regular, item.role);
  }
  const student: Signer = { name: data.studentName, qualification: `CPF ${data.cpfMasked}`, registry: "", signature: null };
  await drawSigner(doc, front, student, rightX, rowBottom, bold, regular, "Assinatura do aluno");

  front.drawLine({ start: { x: left - 14, y: 64 }, end: { x: right + 14, y: 64 }, thickness: 0.6, color: GRAY });
  drawCentered(front, toWinAnsi(`${data.companyName}  |  CNPJ ${data.companyCnpj}`), 52, regular, 8, GRAY);
  const contact = (data.companyContact ?? "").trim();
  if (contact) {
    const size = fitSize(contact, regular, 7.5, PAGE[0] - 2 * (MARGIN + 6), 6);
    drawCentered(front, contact, 42, regular, size, GRAY);
  }
  drawCentered(front, toWinAnsi(`Valide em ${data.validationUrl}`), 32, regular, 7, GRAY);

  // ------------------------------------------------- segunda pagina (so se sobrar conteudo)
  let pageNumber = 1;
  while (index < lines.length) {
    const next = doc.addPage(PAGE);
    pageNumber++;
    drawWatermark(next);
    drawFrame(next);
    next.drawText("CONTEÚDO PROGRAMÁTICO (continuação)", { x: MARGIN + 24, y: PAGE[1] - 66, size: 14, font: bold, color: NAVY });
    next.drawText(toWinAnsi(wrapText(data.courseName, regular, 10, textWidth)[0] ?? ""), { x: MARGIN + 24, y: PAGE[1] - 84, size: 10, font: regular, color: GRAY });
    next.drawLine({ start: { x: MARGIN + 24, y: PAGE[1] - 94 }, end: { x: PAGE[0] - MARGIN - 24, y: PAGE[1] - 94 }, thickness: 0.7, color: ORANGE });
    let ty = PAGE[1] - 116;
    while (index < lines.length && ty > 70) {
      const line = lines[index] ?? "";
      if (line) next.drawText(line, { x: MARGIN + 24, y: ty, size: 10, font: regular, color: INK });
      ty -= 14;
      index++;
    }
    next.drawText(toWinAnsi(`Certificado ${data.code}  |  página ${pageNumber}`), { x: MARGIN + 24, y: 34, size: 8, font: regular, color: GRAY });
  }

  return doc.save();
}

/** SHA-256 em hexadecimal (Web Crypto: Deno e Node). */
export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

