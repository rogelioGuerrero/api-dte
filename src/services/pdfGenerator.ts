import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import { PassThrough } from 'stream';
import axios from 'axios';
import { createLogger } from '../utils/logger';

const logger = createLogger('pdfGenerator');

const fallbackLogoDataUrl =
  'data:image/svg+xml;base64,' +
  Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="40" viewBox="0 0 120 40" fill="none">
      <rect width="120" height="40" rx="8" fill="#0F172A"/>
      <path fill="#fff" d="M18 28V12h6.7c2.9 0 5 1.8 5 4.7 0 2.9-2.1 4.7-5 4.7h-3.6V28H18Zm3.4-8.4h3.1c1.1 0 1.9-.7 1.9-1.9 0-1.2-.8-1.9-1.9-1.9h-3.1v3.8Zm19.3 8.6c-3.9 0-6.7-2.6-6.7-6.4 0-3.8 2.8-6.4 6.7-6.4 3.9 0 6.7 2.6 6.7 6.4 0 3.8-2.8 6.4-6.7 6.4Zm0-3c2 0 3.3-1.5 3.3-3.4 0-1.9-1.3-3.4-3.3-3.4-2 0-3.3 1.5-3.3 3.4 0 1.9 1.3 3.4 3.3 3.4Zm11.8 2.8V16.1h3.3v1.6c.8-1.2 2-1.9 3.7-1.9 2.7 0 4.7 2 4.7 5.4V28h-3.3v-6.1c0-1.8-1-3-2.5-3-1.5 0-2.6 1.2-2.6 3V28h-3.3Zm18.8 0V12h3.3v6.2c.8-1.2 2-1.9 3.7-1.9 2.7 0 4.7 2 4.7 5.4V28h-3.3v-6.1c0-1.8-1-3-2.5-3-1.5 0-2.6 1.2-2.6 3V28h-3.3Z"/>
    </svg>`
  ).toString('base64');

const generarQRBuffer = async (texto: string): Promise<Buffer | null> => {
  try {
    return await QRCode.toBuffer(texto, {
      type: 'png',
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 140,
    });
  } catch (error) {
    logger.warn('No se pudo generar QR', { error: (error as any)?.message });
    return null;
  }
};

const getTipoDocumentoNombre = (codigo: string, tiposDocumento: any[]): string => {
  const tipo = tiposDocumento.find((t) => t.codigo === codigo);
  if (!tipo) return 'DOCUMENTO TRIBUTARIO ELECTRÓNICO';
  return tipo.descripcion.replace(/\s*\(.*?\)\s*/g, ' ').trim().toUpperCase();
};

const tiposDocumento = [
  { codigo: '01', descripcion: 'Factura' },
  { codigo: '03', descripcion: 'Comprobante de Crédito Fiscal' },
  { codigo: '11', descripcion: 'Factura de Exportación' }
];

const safe = (val: any) => (val === undefined || val === null || val === '' ? '—' : String(val));
const money = (val: any) => Number(val || 0).toFixed(2);

const clampText = (text: string, maxLen: number) => {
  const t = String(text ?? '').trim();
  if (!t) return '—';
  return t.length > maxLen ? `${t.slice(0, Math.max(0, maxLen - 1))}…` : t;
};

const tryDecodeDataImage = (dataUrl: string): { buffer: Buffer; type: string } | null => {
  const m = /^data:(image\/[^;]+);base64,(.+)$/i.exec(dataUrl || '');
  if (!m) return null;
  try {
    return { type: m[1], buffer: Buffer.from(m[2], 'base64') };
  } catch {
    return null;
  }
};

const tryFetchImage = async (url: string): Promise<Buffer | null> => {
  try {
    const res = await axios.get<ArrayBuffer>(url, { responseType: 'arraybuffer', timeout: 4000 });
    return Buffer.from(res.data);
  } catch (error) {
    logger.warn('No se pudo descargar logo; se usará icono genérico', { error: (error as any)?.message });
    return null;
  }
};

const drawGenericLogo = (doc: PDFKit.PDFDocument, x: number, y: number, w: number, h: number) => {
  const stroke = '#0F172A';
  const fill = '#0F172A';

  doc.save();
  doc.lineWidth(1);
  doc.roundedRect(x, y, w, h, 6).stroke(stroke);

  // Folded corner
  const fold = Math.min(w, h) * 0.28;
  doc
    .moveTo(x + w - fold, y)
    .lineTo(x + w, y + fold)
    .stroke(stroke);
  doc
    .moveTo(x + w - fold, y)
    .lineTo(x + w - fold, y + fold)
    .lineTo(x + w, y + fold)
    .stroke(stroke);

  // Lines
  doc.lineWidth(1);
  const lx = x + 10;
  let ly = y + 14;
  for (let i = 0; i < 3; i++) {
    doc.moveTo(lx, ly).lineTo(x + w - 10, ly).stroke('#CBD5E1');
    ly += 10;
  }

  // Accent dot
  doc.circle(x + 12, y + h - 12, 3).fill(fill);
  doc.restore();
};

const drawKeyValue = (doc: PDFKit.PDFDocument, x: number, y: number, label: string, value: string, opts?: { valueMaxLen?: number }) => {
  const valueMaxLen = opts?.valueMaxLen ?? 120;
  doc.font('Helvetica').fontSize(9).fillColor('#475569').text(label, x, y, { continued: true });
  doc.font('Helvetica').fontSize(9).fillColor('#0F172A').text(` ${clampText(value, valueMaxLen)}`);
};

const drawCard = (doc: PDFKit.PDFDocument, x: number, y: number, w: number, title: string, lines: Array<{ label: string; value: string }>) => {
  const padding = 10;
  const headerH = 18;
  const lineH = 12;
  const innerY = y + padding + headerH;

  const contentH = Math.max(54, lines.length * lineH + headerH + padding * 2);
  doc.save();
  doc.lineWidth(0.7);
  doc.roundedRect(x, y, w, contentH, 6).stroke('#E2E8F0');

  doc.font('Helvetica-Bold').fontSize(10).fillColor('#0F172A').text(title, x + padding, y + padding);
  doc.moveTo(x + padding, y + padding + headerH - 4).lineTo(x + w - padding, y + padding + headerH - 4).lineWidth(0.5).stroke('#E2E8F0');

  let cy = innerY;
  for (const ln of lines) {
    doc.font('Helvetica').fontSize(9).fillColor('#475569').text(ln.label, x + padding, cy, { width: 90 });
    doc.font('Helvetica').fontSize(9).fillColor('#0F172A').text(clampText(ln.value, 120), x + padding + 92, cy, { width: w - padding * 2 - 92 });
    cy += lineH;
  }

  doc.restore();
  return y + contentH;
};

export interface GeneratePdfOptions {
  dte: any;
  mhResponse?: any;
  logoUrl?: string | null;
}

export const generateDtePdfBase64 = async ({ dte, mhResponse, logoUrl }: GeneratePdfOptions): Promise<string> => {
  const tipoDocNombre = getTipoDocumentoNombre(dte.identificacion.tipoDte, tiposDocumento);
  const qrData =
    mhResponse?.enlaceConsulta ||
    `https://consultadte.mh.gob.sv/consulta/${dte.identificacion.codigoGeneracion}?ambiente=${dte.identificacion.ambiente}&fechaEmi=${dte.identificacion.fecEmi}`;
  const qrBuffer = await generarQRBuffer(qrData);
  const sello = mhResponse?.selloRecepcion || mhResponse?.selloRecibido || '';
  const fechaProc = mhResponse?.fechaHoraProcesamiento || mhResponse?.fhProcesamiento || '';

  const doc = new PDFDocument({ size: 'A4', margin: 36 });
  const stream = new PassThrough();
  const chunks: Buffer[] = [];
  stream.on('data', (c) => chunks.push(c));
  doc.pipe(stream);

  const pageW = doc.page.width;
  const marginL = doc.page.margins.left;
  const marginR = doc.page.margins.right;
  const contentW = pageW - marginL - marginR;

  // Header: left block + QR right
  const headerY = doc.y;
  const qrSize = 110;
  const qrX = pageW - marginR - qrSize;
  const qrY = headerY;
  if (qrBuffer) {
    doc.image(qrBuffer, qrX, qrY, { width: qrSize });
  }

  const leftW = contentW - qrSize - 14;
  const leftX = marginL;

  // Logo area
  const logoBoxW = 120;
  const logoBoxH = 40;
  const logoX = leftX;
  const logoY = headerY;

  let logoBuffer: Buffer | null = null;
  if (logoUrl) {
    const decoded = tryDecodeDataImage(logoUrl);
    if (decoded) logoBuffer = decoded.buffer;
    else if (/^https?:\/\//i.test(logoUrl)) logoBuffer = await tryFetchImage(logoUrl);
  }

  if (logoBuffer) {
    try {
      doc.image(logoBuffer, logoX, logoY, { fit: [logoBoxW, logoBoxH], align: 'left', valign: 'top' });
    } catch {
      drawGenericLogo(doc, logoX, logoY, logoBoxW, logoBoxH);
    }
  } else {
    drawGenericLogo(doc, logoX, logoY, logoBoxW, logoBoxH);
  }

  const titleX = logoX + logoBoxW + 12;
  const titleY = logoY + 2;
  doc.font('Helvetica-Bold').fontSize(12).fillColor('#0F172A').text('DOCUMENTO TRIBUTARIO ELECTRÓNICO', titleX, titleY, { width: leftW - (logoBoxW + 12) });
  doc.font('Helvetica-Bold').fontSize(18).fillColor('#0F172A').text(tipoDocNombre, titleX, titleY + 16, { width: leftW - (logoBoxW + 12) });

  // Key lines under title (5 lines on left)
  let ky = titleY + 40;
  drawKeyValue(doc, titleX, ky, 'N° Control:', safe(dte.identificacion.numeroControl));
  ky += 12;
  drawKeyValue(doc, titleX, ky, 'Código generación:', safe(dte.identificacion.codigoGeneracion));
  ky += 12;
  drawKeyValue(doc, titleX, ky, 'Fecha/Hora emisión:', `${safe(dte.identificacion.fecEmi)} ${safe(dte.identificacion.horEmi)}`);
  ky += 12;
  drawKeyValue(
    doc,
    titleX,
    ky,
    'Ambiente:',
    String(dte.identificacion.ambiente || '').trim() === '01' ? 'Producción' : 'Pruebas'
  );
  ky += 12;
  if (sello) {
    drawKeyValue(doc, titleX, ky, 'Sello recepción:', sello, { valueMaxLen: 90 });
    ky += 12;
  }
  if (fechaProc) {
    drawKeyValue(doc, titleX, ky, 'Procesado:', fechaProc);
    ky += 12;
  }

  const headerBottom = Math.max(logoY + logoBoxH, qrY + qrSize, ky) + 10;
  doc.moveTo(marginL, headerBottom).lineTo(pageW - marginR, headerBottom).lineWidth(0.7).stroke('#E2E8F0');

  doc.y = headerBottom + 12;

  // Cards: EMISOR / RECEPTOR
  const gap = 12;
  const cardW = (contentW - gap) / 2;
  const cardY = doc.y;

  const emisor = dte.emisor || {};
  const receptor = dte.receptor || {};

  const emisorLines = [
    { label: 'Nombre', value: safe(emisor.nombre || emisor.nombreComercial) },
    { label: 'NIT', value: safe(emisor.nit) },
    { label: 'NRC', value: safe(emisor.nrc) },
    { label: 'Dirección', value: safe(emisor.direccion?.complemento || emisor.direccion) },
    { label: 'Correo', value: safe(emisor.correo) },
  ];

  const receptorLines = [
    { label: 'Nombre', value: safe(receptor.nombre) },
    { label: 'Documento', value: safe(receptor.numDocumento || receptor.dui || receptor.nit) },
    { label: 'Dirección', value: safe(receptor.direccion?.complemento || receptor.direccion) },
    { label: 'Correo', value: safe(receptor.correo) },
    { label: 'Condición', value: String(dte.resumen?.condicionOperacion ?? '') === '2' ? 'Crédito' : 'Contado' },
  ];

  const endEmisor = drawCard(doc, marginL, cardY, cardW, 'EMISOR', emisorLines);
  const endReceptor = drawCard(doc, marginL + cardW + gap, cardY, cardW, 'RECEPTOR', receptorLines);
  doc.y = Math.max(endEmisor, endReceptor) + 14;

  // Items table (minimal)
  const startX = marginL;
  const tableWidth = contentW;
  const cols = [
    { key: 'numItem', w: 26, label: '#' },
    { key: 'cantidad', w: 46, label: 'Cant.' },
    { key: 'descripcion', w: tableWidth - (26 + 46 + 58 + 58 + 66), label: 'Descripción' },
    { key: 'precioUni', w: 58, label: 'P.U.' },
    { key: 'montoDescu', w: 58, label: 'Desc.' },
    { key: 'importe', w: 66, label: 'Importe' },
  ];

  const drawTableHeader = (y: number) => {
    doc.save();
    doc.rect(startX, y, tableWidth, 18).fill('#F1F5F9');
    doc.fillColor('#0F172A');
    doc.lineWidth(0.7).strokeColor('#E2E8F0').rect(startX, y, tableWidth, 18).stroke();
    let x = startX;
    for (const c of cols) {
      doc
        .font('Helvetica-Bold')
        .fontSize(8)
        .fillColor('#0F172A')
        .text(c.label, x + 4, y + 6, { width: c.w - 8, align: c.key === 'descripcion' ? 'left' : 'right' });
      x += c.w;
    }
    doc.restore();
    return y + 18;
  };

  const drawRow = (y: number, row: Record<string, any>) => {
    const paddingY = 6;
    const baseFont = 8.5;
    const descX = startX + cols[0].w + cols[1].w;
    const descW = cols[2].w;
    const descText = safe(row.descripcion);
    doc.font('Helvetica').fontSize(baseFont);
    const descH = doc.heightOfString(descText, { width: descW - 8, align: 'left' });
    const h = Math.max(18, descH + paddingY * 2);

    // horizontal rule only
    doc.lineWidth(0.7).strokeColor('#E2E8F0');
    doc.moveTo(startX, y).lineTo(startX + tableWidth, y).stroke();

    let x = startX;
    const cy = y + paddingY;
    for (const c of cols) {
      const align = c.key === 'descripcion' ? 'left' : 'right';
      const txt = safe(row[c.key]);
      doc.font('Helvetica').fontSize(baseFont).fillColor('#0F172A');
      doc.text(txt, x + 4, cy, { width: c.w - 8, align });
      x += c.w;
    }
    return y + h;
  };

  let y = drawTableHeader(doc.y);
  const items = Array.isArray(dte.cuerpoDocumento) ? dte.cuerpoDocumento : [];
  for (const it of items) {
    // page break
    if (y > doc.page.height - doc.page.margins.bottom - 140) {
      doc.addPage();
      y = drawTableHeader(doc.y);
    }

    y = drawRow(y, {
      numItem: safe(it.numItem),
      cantidad: money(it.cantidad),
      descripcion: safe(it.descripcion),
      precioUni: money(it.precioUni),
      montoDescu: money(it.montoDescu),
      importe: money(it.ventaGravada),
    });
  }
  // bottom line
  doc.lineWidth(0.7).strokeColor('#E2E8F0').moveTo(startX, y).lineTo(startX + tableWidth, y).stroke();

  doc.y = y + 14;

  // Totals (right aligned), IVA hidden for tipo 01
  const totalsW = 220;
  const totalsX = pageW - marginR - totalsW;
  let ty = doc.y;
  doc.font('Helvetica-Bold').fontSize(10).fillColor('#0F172A').text('TOTALES', totalsX, ty, { width: totalsW, align: 'right' });
  ty += 14;
  doc.font('Helvetica').fontSize(9).fillColor('#0F172A');
  doc.fillColor('#475569').text('Subtotal ventas', totalsX, ty, { width: totalsW - 80, align: 'right', continued: true });
  doc.fillColor('#0F172A').text(` ${money(dte.resumen?.subTotalVentas)}`, { width: 80, align: 'right' });
  ty += 12;
  doc.fillColor('#475569').text('Subtotal', totalsX, ty, { width: totalsW - 80, align: 'right', continued: true });
  doc.fillColor('#0F172A').text(` ${money(dte.resumen?.subTotal)}`, { width: 80, align: 'right' });
  ty += 14;

  doc.font('Helvetica-Bold').fontSize(14).fillColor('#0F172A').text('TOTAL', totalsX, ty, { width: totalsW - 80, align: 'right', continued: true });
  doc.font('Helvetica-Bold').fontSize(14).fillColor('#0F172A').text(` ${money(dte.resumen?.totalPagar)}`, { width: 80, align: 'right' });

  // Total letras
  const letras = (dte.resumen?.totalLetras || '').trim();
  if (letras) {
    doc.font('Helvetica').fontSize(8.5).fillColor('#475569');
    doc.text(`Total en letras: ${letras}`, marginL, ty + 22, { width: contentW });
  }

  // Small validation line
  doc.font('Helvetica').fontSize(8).fillColor('#94A3B8');
  doc.text(`Consulta: ${qrData}`, marginL, doc.page.height - doc.page.margins.bottom - 12, { width: contentW });

  doc.end();

  await new Promise<void>((resolve, reject) => {
    stream.on('finish', resolve);
    stream.on('error', reject);
  });

  return Buffer.concat(chunks).toString('base64');
};
