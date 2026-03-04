import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import { PassThrough } from 'stream';
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

  const safe = (val: any) => (val === undefined || val === null || val === '' ? '—' : String(val));
  const money = (val: any) => Number(val || 0).toFixed(2);

  const doc = new PDFDocument({ size: 'A4', margin: 36 });
  const stream = new PassThrough();
  const chunks: Buffer[] = [];
  stream.on('data', (c) => chunks.push(c));
  doc.pipe(stream);

  doc.font('Helvetica-Bold').fontSize(12).text('DOCUMENTO TRIBUTARIO ELECTRÓNICO', { align: 'center' });
  doc.moveDown(0.2);
  doc.font('Helvetica-Bold').fontSize(11).text(tipoDocNombre, { align: 'center' });
  doc.moveDown(0.7);

  const topY = doc.y;
  if (qrBuffer) {
    doc.image(qrBuffer, doc.page.width - doc.page.margins.right - 110, topY, { width: 110 });
  }
  doc.font('Helvetica').fontSize(9);
  doc.text(`Código de Generación: ${safe(dte.identificacion.codigoGeneracion)}`);
  doc.text(`Número de Control: ${safe(dte.identificacion.numeroControl)}`);
  doc.text(`Fecha/Hora: ${safe(dte.identificacion.fecEmi)} ${safe(dte.identificacion.horEmi)}`);
  if (sello) doc.text(`Sello: ${sello}`);
  if (fechaProc) doc.text(`Procesado: ${fechaProc}`);
  doc.moveDown(0.8);

  doc.font('Helvetica-Bold').fontSize(10).text('EMISOR');
  doc.font('Helvetica').fontSize(9);
  doc.text(`Nombre: ${safe(dte.emisor?.nombre)}`);
  doc.text(`NIT: ${safe(dte.emisor?.nit)}`);
  doc.text(`NRC: ${safe(dte.emisor?.nrc)}`);
  doc.text(`Dirección: ${safe(dte.emisor?.direccion?.complemento)}`);
  doc.moveDown(0.5);

  doc.font('Helvetica-Bold').fontSize(10).text('RECEPTOR');
  doc.font('Helvetica').fontSize(9);
  doc.text(`Nombre: ${safe(dte.receptor?.nombre)}`);
  doc.text(`Documento: ${safe(dte.receptor?.numDocumento)}`);
  doc.text(`Dirección: ${safe(dte.receptor?.direccion?.complemento)}`);
  doc.moveDown(0.8);

  const startX = doc.page.margins.left;
  const tableWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const cols = [
    { key: 'numItem', w: 28, label: 'N°' },
    { key: 'cantidad', w: 50, label: 'Cant.' },
    { key: 'descripcion', w: tableWidth - (28 + 50 + 70 + 70 + 70), label: 'Descripción' },
    { key: 'precioUni', w: 70, label: 'P.U.' },
    { key: 'montoDescu', w: 70, label: 'Desc.' },
    { key: 'ventaGravada', w: 70, label: 'Total' },
  ];

  const drawRow = (y: number, row: Record<string, any>, header = false) => {
    let x = startX;
    const h = 16;
    doc.lineWidth(0.5);
    doc.rect(x, y, tableWidth, h).stroke();
    for (const c of cols) {
      doc.rect(x, y, c.w, h).stroke();
      doc
        .font(header ? 'Helvetica-Bold' : 'Helvetica')
        .fontSize(8)
        .text(safe(row[c.key]), x + 2, y + 4, { width: c.w - 4, align: c.key === 'descripcion' ? 'left' : 'right' });
      x += c.w;
    }
    return y + h;
  };

  let y = doc.y;
  y = drawRow(y, cols.reduce((a, c) => ({ ...a, [c.key]: c.label }), {}), true);

  const items = Array.isArray(dte.cuerpoDocumento) ? dte.cuerpoDocumento : [];
  for (const it of items) {
    if (y > doc.page.height - doc.page.margins.bottom - 80) {
      doc.addPage();
      y = doc.y;
      y = drawRow(y, cols.reduce((a, c) => ({ ...a, [c.key]: c.label }), {}), true);
    }

    y = drawRow(y, {
      numItem: it.numItem,
      cantidad: money(it.cantidad),
      descripcion: safe(it.descripcion),
      precioUni: money(it.precioUni),
      montoDescu: money(it.montoDescu),
      ventaGravada: money(it.ventaGravada),
    });
  }

  doc.moveDown(1.0);
  doc.font('Helvetica-Bold').fontSize(10).text('TOTALES', { align: 'right' });
  doc.font('Helvetica').fontSize(9);
  doc.text(`SubTotal Ventas: ${money(dte.resumen?.subTotalVentas)}`, { align: 'right' });
  doc.text(`SubTotal: ${money(dte.resumen?.subTotal)}`, { align: 'right' });
  doc.font('Helvetica-Bold').fontSize(11).text(`Total a Pagar: ${money(dte.resumen?.totalPagar)}`, { align: 'right' });

  doc.end();

  await new Promise<void>((resolve, reject) => {
    stream.on('finish', resolve);
    stream.on('error', reject);
  });

  return Buffer.concat(chunks).toString('base64');
};
