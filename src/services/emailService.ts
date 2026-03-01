import { Resend } from 'resend';
import { createLogger } from '../utils/logger';

const logger = createLogger('emailService');

const resend = new Resend(process.env.RESEND_API_KEY);

export interface EmailRequest {
  to: string | string[];
  subject: string;
  html: string;
  from?: string;
  replyTo?: string;
  attachments?: Array<{
    filename: string;
    content: string | Buffer;
    contentType: string;
  }>;
}

export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Enviar correo electrónico usando Resend
 */
export async function sendEmail(request: EmailRequest): Promise<EmailResult> {
  try {
    if (!process.env.RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY no está configurado');
    }

    if (!process.env.RESEND_FROM_EMAIL) {
      throw new Error('RESEND_FROM_EMAIL no está configurado');
    }

    const { data, error } = await resend.emails.send({
      from: request.from || process.env.RESEND_FROM_EMAIL,
      to: Array.isArray(request.to) ? request.to : [request.to],
      subject: request.subject,
      html: request.html,
      reply_to: request.replyTo,
      attachments: request.attachments
    });

    if (error) {
      logger.error('Error enviando correo', { error, request: { ...request, html: '[HTML_CONTENT]' } });
      return {
        success: false,
        error: error.message
      };
    }

    logger.info('Correo enviado exitosamente', { messageId: data?.id, to: request.to });
    
    return {
      success: true,
      messageId: data?.id
    };
  } catch (error) {
    logger.error('Error en servicio de correo', { error, request: { ...request, html: '[HTML_CONTENT]' } });
    
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido'
    };
  }
}

/**
 * Generar HTML para correo de DTE enviado
 */
export function generateDTEEmailHTML(dteData: any, mhResponse: any): string {
  const receptor = dteData.receptor || {};
  const emisor = dteData.identificacion || {};
  const codigoGeneracion = mhResponse.codigoGeneracion || dteData.codigoGeneracion;
  const selloRecibido = mhResponse.selloRecibido || 'Pendiente';

  const fmt = (val: any) => val ?? '—';
  const tipoDte = dteData.identificacion?.tipoDte || dteData.tipoDte || '—';
  const codGen = mhResponse.codigoGeneracion || dteData.codigoGeneracion || '—';
  const selloRec = selloRecibido || '—';
  const fechaProc = mhResponse.fechaHoraProcesamiento || new Date().toLocaleString('es-SV');
  const emisorNombre = emisor.nombre || emisor.nombreComercial || '—';
  const receptorNombre = receptor.nombre || receptor.nombreComercial || '—';

  const htmlContent = `
    <!doctype html>
    <html lang="es">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <style>
        body { margin:0; padding:24px 0; background:#f5f7fb; font-family: 'Segoe UI', Arial, sans-serif; color:#0f172a; }
        .card { max-width:640px; margin:0 auto; background:#fff; border:1px solid #e5e7eb; border-radius:12px; padding:24px; box-shadow:0 10px 25px rgba(15,23,42,0.06); }
        h1 { margin:0 0 12px; font-size:22px; letter-spacing:-0.01em; }
        .badge { display:inline-flex; align-items:center; gap:8px; padding:10px 12px; border-radius:10px; background:#ecfdf3; color:#166534; border:1px solid #bbf7d0; font-weight:600; font-size:14px; }
        .section { margin-top:20px; }
        .section h3 { margin:0 0 10px; font-size:15px; letter-spacing:-0.01em; color:#0f172a; }
        .rows { border:1px solid #e5e7eb; border-radius:10px; padding:12px 14px; background:#f8fafc; }
        .row { display:flex; justify-content:space-between; padding:6px 0; font-size:14px; border-bottom:1px solid #e5e7eb; }
        .row:last-child { border-bottom:none; }
        .label { color:#475569; font-weight:600; }
        .value { color:#0f172a; text-align:right; max-width:60%; word-break:break-word; }
        .footer { margin-top:24px; font-size:12px; color:#94a3b8; text-align:center; line-height:1.5; }
      </style>
    </head>
    <body>
      <div class="card">
        <h1>📄 DTE procesado</h1>
        <div class="badge">✅ Recibido por el Ministerio de Hacienda</div>

        <div class="section">
          <h3>Información del documento</h3>
          <div class="rows">
            <div class="row"><span class="label">Código de Generación:</span><span class="value">${codGen}</span></div>
            <div class="row"><span class="label">Tipo de DTE:</span><span class="value">${fmt(tipoDte)}</span></div>
            <div class="row"><span class="label">Sello Recibido:</span><span class="value">${fmt(selloRec)}</span></div>
            <div class="row"><span class="label">Fecha de Procesamiento:</span><span class="value">${fmt(fechaProc)}</span></div>
          </div>
        </div>

        <div class="section">
          <h3>Emisor</h3>
          <div class="rows">
            <div class="row"><span class="label">NIT:</span><span class="value">${fmt(emisor.nit)}</span></div>
            <div class="row"><span class="label">Nombre:</span><span class="value">${fmt(emisorNombre)}</span></div>
            <div class="row"><span class="label">Correo:</span><span class="value">${fmt(emisor.correo)}</span></div>
          </div>
        </div>

        <div class="section">
          <h3>Receptor</h3>
          <div class="rows">
            <div class="row"><span class="label">NIT:</span><span class="value">${fmt(receptor.nit)}</span></div>
            <div class="row"><span class="label">Nombre:</span><span class="value">${fmt(receptorNombre)}</span></div>
            <div class="row"><span class="label">Correo:</span><span class="value">${fmt(receptor.correo)}</span></div>
          </div>
        </div>

        <div class="footer">
          <p>Correo automático del sistema DTE. No responder.</p>
        </div>
      </div>
    </body>
    </html>
  `;
  return htmlContent;
}

/**
 * Enviar correo de DTE a emisor y receptor
 */
export async function sendDTEEmails(
  dteData: any,
  mhResponse: any,
  pdfBase64?: string,
  dteJsonString?: string
): Promise<{ receptor: EmailResult }> {
  const receptor = dteData.receptor || {};
  
  const htmlContent = generateDTEEmailHTML(dteData, mhResponse);
  const subject = `DTE ${dteData.tipoDte || dteData.identificacion?.tipoDte || ''} - Código: ${mhResponse.codigoGeneracion || dteData.codigoGeneracion}`;
  
  const attachments = [] as any[];

  if (pdfBase64) {
    attachments.push({
      filename: `DTE_${mhResponse.codigoGeneracion || dteData.codigoGeneracion}.pdf`,
      content: Buffer.from(pdfBase64, 'base64'),
      contentType: 'application/pdf'
    });
  }

  if (dteJsonString) {
    attachments.push({
      filename: `DTE_${mhResponse.codigoGeneracion || dteData.codigoGeneracion}.json`,
      content: Buffer.from(dteJsonString, 'utf8'),
      contentType: 'application/json'
    });
  }

  // Solo receptor
  let receptorResult: EmailResult = { success: false, error: 'Receptor sin correo' };
  if (receptor.correo) {
    receptorResult = await sendEmail({
      to: receptor.correo,
      subject: subject,
      html: htmlContent,
      attachments
    });
  }

  logger.info('Correos DTE enviados', {
    receptorEmail: receptor.correo,
    receptorSuccess: receptorResult.success
  });

  return {
    receptor: receptorResult
  };
}
