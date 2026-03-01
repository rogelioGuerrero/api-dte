import { chromium } from 'playwright';
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

const generarQRDataUrl = async (texto: string): Promise<string> => {
  try {
    return `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(texto)}`;
  } catch {
    return '';
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
  const qrData = mhResponse?.enlaceConsulta ||
    `https://consultadte.mh.gob.sv/consulta/${dte.identificacion.codigoGeneracion}?ambiente=${dte.identificacion.ambiente}&fechaEmi=${dte.identificacion.fecEmi}`;
  const qrUrl = await generarQRDataUrl(qrData);

  const sello = mhResponse?.selloRecepcion || mhResponse?.selloRecibido || '';
  const fechaProc = mhResponse?.fechaHoraProcesamiento || mhResponse?.fhProcesamiento || '';
  const resolvedLogo = logoUrl || fallbackLogoDataUrl;

  const fmt = (val: any) => (val === undefined || val === null || val === '' ? '—' : val);

  const html = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>DTE - ${dte.identificacion.numeroControl}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 11px; line-height: 1.4; color: #000; background: #fff; padding: 20px; }
    .container { max-width: 800px; margin: 0 auto; border: 1px solid #000; padding: 15px; }
    .header { display:flex; justify-content:space-between; align-items:center; margin-bottom: 15px; padding-bottom: 10px; border-bottom: 1px solid #ccc; }
    .header .version { text-align: right; font-size: 10px; color: #666; }
    .header h1 { font-size: 14px; font-weight: bold; margin: 5px 0; text-align:center; flex:1; }
    .header h2 { font-size: 12px; font-weight: bold; margin: 3px 0; text-align:center; flex:1; }
    .logo { width: 120px; height: 40px; object-fit: contain; margin-right:12px; }
    .info-row { display: flex; justify-content: space-between; margin-bottom: 15px; }
    .info-section { flex: 1; padding: 10px; border: 1px solid #ccc; margin: 0 5px; }
    .info-section:first-child { margin-left: 0; } .info-section:last-child { margin-right: 0; }
    .info-section h3 { font-size: 11px; font-weight: bold; margin-bottom: 8px; padding-bottom: 5px; border-bottom: 1px solid #eee; text-align: center; }
    .info-section .field { display: flex; margin-bottom: 4px; }
    .info-section .field .label { font-weight: bold; min-width: 120px; color: #333; }
    .info-section .field .value { flex: 1; }
    .qr-section { display: flex; align-items: flex-start; gap: 15px; margin-bottom: 15px; }
    .qr-code { width: 100px; height: 100px; }
    .qr-info .field { display: flex; margin-bottom: 3px; }
    .qr-info .field .label { font-weight: bold; min-width: 180px; }
    .modelo-info { text-align: right; }
    .modelo-info .field { display: flex; justify-content: flex-end; margin-bottom: 3px; }
    .modelo-info .label { font-weight: bold; margin-right: 10px; }
    table { width: 100%; border-collapse: collapse; margin: 15px 0; }
    table th, table td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; font-size: 10px; }
    table th { background: #f5f5f5; font-weight: bold; text-align: center; }
    table td.number { text-align: right; font-family: 'Courier New', monospace; }
    table td.center { text-align: center; }
    .totals { margin-top: 15px; }
    .totals table { width: 50%; margin-left: auto; }
    .totals table td { padding: 4px 8px; }
    .totals table td:first-child { text-align: right; font-weight: bold; }
    .totals table td:last-child { text-align: right; font-family: 'Courier New', monospace; }
    .totals table tr.total-final { background: #f0f0f0; font-weight: bold; }
    .totals table tr.total-final td { font-size: 12px; }
    .footer { margin-top: 20px; padding-top: 10px; border-top: 1px solid #ccc; font-size: 9px; color: #666; text-align: center; }
    .sello-section { background: #e8f5e9; border: 1px solid #4caf50; padding: 10px; margin: 15px 0; border-radius: 4px; }
    .sello-section h4 { color: #2e7d32; margin-bottom: 5px; }
    .sello-section code { font-family: 'Courier New', monospace; font-size: 10px; word-break: break-all; }
    @media print { body { padding: 0; } .container { border: none; } }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <img class="logo" src="${resolvedLogo}" alt="Logo" />
      <div style="flex:1;">
        <div class="version">Ver.${dte.identificacion.version}</div>
        <h1>DOCUMENTO TRIBUTARIO ELECTRÓNICO</h1>
        <h2>${tipoDocNombre}</h2>
      </div>
    </div>

    <div class="qr-section">
      <img src="${qrUrl}" alt="QR Code" class="qr-code" />
      <div class="qr-info">
        <div class="field"><span class="label">Código de Generación:</span><span class="value">${dte.identificacion.codigoGeneracion}</span></div>
        <div class="field"><span class="label">Número de Control:</span><span class="value">${dte.identificacion.numeroControl}</span></div>
        ${sello ? `<div class="field"><span class="label">Sello de Recepción:</span><span class="value" style="font-size: 9px;">${sello}</span></div>` : ''}
      </div>
      <div class="modelo-info">
        <div class="field"><span class="label">Modelo de Facturación:</span><span class="value">Previo</span></div>
        <div class="field"><span class="label">Tipo de Transmisión:</span><span class="value">Normal</span></div>
        <div class="field"><span class="label">Fecha y Hora de Generación:</span><span class="value">${dte.identificacion.fecEmi} ${dte.identificacion.horEmi}</span></div>
      </div>
    </div>

    <div class="info-row">
      <div class="info-section">
        <h3>EMISOR</h3>
        <div class="field"><span class="label">Nombre o razón social:</span><span class="value">${fmt(dte.emisor.nombre)}</span></div>
        <div class="field"><span class="label">NIT:</span><span class="value">${fmt(dte.emisor.nit)}</span></div>
        <div class="field"><span class="label">NRC:</span><span class="value">${fmt(dte.emisor.nrc)}</span></div>
        <div class="field"><span class="label">Actividad económica:</span><span class="value">${fmt(dte.emisor.descActividad)}</span></div>
        <div class="field"><span class="label">Dirección:</span><span class="value">${fmt(dte.emisor.direccion?.complemento)}</span></div>
        <div class="field"><span class="label">Número de teléfono:</span><span class="value">${fmt(dte.emisor.telefono)}</span></div>
        <div class="field"><span class="label">Correo electrónico:</span><span class="value">${fmt(dte.emisor.correo)}</span></div>
        ${dte.emisor.nombreComercial ? `<div class="field"><span class="label">Nombre Comercial:</span><span class="value">${fmt(dte.emisor.nombreComercial)}</span></div>` : ''}
        <div class="field"><span class="label">Tipo de establecimiento:</span><span class="value">${dte.emisor.tipoEstablecimiento === '01' ? 'Casa Matriz' : 'Sucursal'}</span></div>
      </div>

      <div class="info-section">
        <h3>RECEPTOR</h3>
        <div class="field"><span class="label">Nombre o razón social:</span><span class="value">${fmt(dte.receptor.nombre)}</span></div>
        <div class="field"><span class="label">NIT:</span><span class="value">${fmt(dte.receptor.numDocumento)}</span></div>
        ${dte.receptor.nrc ? `<div class="field"><span class="label">NRC:</span><span class="value">${fmt(dte.receptor.nrc)}</span></div>` : ''}
        <div class="field"><span class="label">Actividad económica:</span><span class="value">${fmt(dte.receptor.descActividad)}</span></div>
        <div class="field"><span class="label">Dirección:</span><span class="value">${fmt(dte.receptor.direccion?.complemento)}</span></div>
        <div class="field"><span class="label">Número de teléfono:</span><span class="value">${fmt(dte.receptor.telefono)}</span></div>
        <div class="field"><span class="label">Correo electrónico:</span><span class="value">${fmt(dte.receptor.correo)}</span></div>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th style="width: 30px;">N°</th>
          <th style="width: 50px;">Cantidad</th>
          <th style="width: 50px;">Unidad</th>
          <th>Descripción</th>
          <th style="width: 70px;">Precio Unitario</th>
          <th style="width: 60px;">Descuento por ítem</th>
          <th style="width: 70px;">Otros montos no afectos</th>
          <th style="width: 60px;">Ventas No Sujetas</th>
          <th style="width: 60px;">Ventas Exentas</th>
          <th style="width: 70px;">Ventas Gravadas</th>
        </tr>
      </thead>
      <tbody>
        ${dte.cuerpoDocumento.map((item: any) => `
        <tr>
          <td class="center">${fmt(item.numItem)}</td>
          <td class="number">${Number(item.cantidad || 0).toFixed(2)}</td>
          <td class="center">${item.uniMedida === 99 ? 'Unidad' : item.uniMedida}</td>
          <td>${fmt(item.descripcion)}</td>
          <td class="number">${Number(item.precioUni || 0).toFixed(2)}</td>
          <td class="number">${Number(item.montoDescu || 0).toFixed(2)}</td>
          <td class="number">0.00</td>
          <td class="number">${Number(item.ventaNoSuj || 0).toFixed(2)}</td>
          <td class="number">${Number(item.ventaExenta || 0).toFixed(2)}</td>
          <td class="number">${Number(item.ventaGravada || 0).toFixed(2)}</td>
        </tr>
        `).join('')}
      </tbody>
    </table>

    <div class="totals">
      <table>
        <tr><td>Suma de Ventas:</td><td>${Number(dte.resumen.subTotalVentas || 0).toFixed(2)}</td></tr>
        <tr><td>Suma Total de Operaciones:</td><td>${Number(dte.resumen.subTotalVentas || 0).toFixed(2)}</td></tr>
        <tr><td>Monto global Desc., Rebajas y otros a ventas no sujetas:</td><td>${Number(dte.resumen.descuNoSuj || 0).toFixed(2)}</td></tr>
        <tr><td>Monto global Desc., Rebajas y otros a ventas Exentas:</td><td>${Number(dte.resumen.descuExenta || 0).toFixed(2)}</td></tr>
        <tr><td>Monto global Desc., Rebajas y otros a ventas gravadas:</td><td>${Number(dte.resumen.descuGravada || 0).toFixed(2)}</td></tr>
        ${dte.identificacion.tipoDte !== '01' ? `<tr><td>Impuesto al Valor Agregado 13%:</td><td>${Number(dte.resumen.tributos?.[0]?.valor || 0).toFixed(2)}</td></tr>` : ''}
        <tr><td>Sub-Total:</td><td>${Number(dte.resumen.subTotal || 0).toFixed(2)}</td></tr>
        <tr><td>IVA Percibido:</td><td>0.00</td></tr>
        <tr><td>IVA Retenido:</td><td>${Number(dte.resumen.ivaRete1 || 0).toFixed(2)}</td></tr>
        <tr class="total-final"><td>Monto Total de la Operación:</td><td>${Number(dte.resumen.totalPagar || 0).toFixed(2)}</td></tr>
      </table>
    </div>

    ${sello ? `
    <div class="sello-section">
      <h4>✓ Documento Validado por el Ministerio de Hacienda</h4>
      <p><strong>Sello de Recepción:</strong></p>
      <code>${sello}</code>
      <p style="margin-top: 5px;"><strong>Fecha de Procesamiento:</strong> ${fmt(fechaProc)}</p>
    </div>
    ` : ''}

    <div class="footer">
      <p>Este documento es una representación impresa de un Documento Tributario Electrónico (DTE)</p>
      <p>Puede verificar su autenticidad en: https://consultadte.mh.gob.sv</p>
    </div>
  </div>
</body>
</html>
  `;

  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 800, height: 1120 } });
    await page.setContent(html, { waitUntil: 'networkidle' });
    const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true });
    return pdfBuffer.toString('base64');
  } catch (error) {
    logger.error('Error generando PDF', { error });
    throw error;
  } finally {
    await browser.close();
  }
};
