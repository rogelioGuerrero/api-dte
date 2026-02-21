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

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>DTE Enviado Exitosamente</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background-color: #f4f4f4; }
        .container { max-width: 600px; margin: 0 auto; background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { text-align: center; border-bottom: 2px solid #007bff; padding-bottom: 20px; margin-bottom: 30px; }
        .header h1 { color: #007bff; margin: 0; }
        .info-section { margin-bottom: 25px; }
        .info-section h3 { color: #333; border-bottom: 1px solid #eee; padding-bottom: 10px; }
        .info-row { display: flex; justify-content: space-between; margin-bottom: 8px; }
        .info-label { font-weight: bold; color: #666; }
        .info-value { color: #333; }
        .success-box { background-color: #d4edda; border: 1px solid #c3e6cb; color: #155724; padding: 15px; border-radius: 5px; text-align: center; margin: 20px 0; }
        .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; color: #666; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>📄 DTE Enviado Exitosamente</h1>
        </div>
        
        <div class="success-box">
          <strong>✅ Su Documento Tributario Electrónico ha sido procesado por el Ministerio de Hacienda</strong>
        </div>

        <div class="info-section">
          <h3>📋 Información del Documento</h3>
          <div class="info-row">
            <span class="info-label">Código de Generación:</span>
            <span class="info-value">${codigoGeneracion}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Tipo de DTE:</span>
            <span class="info-value">${dteData.tipoDte || 'N/A'}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Sello Recibido:</span>
            <span class="info-value">${selloRecibido}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Fecha de Procesamiento:</span>
            <span class="info-value">${new Date().toLocaleString('es-SV')}</span>
          </div>
        </div>

        <div class="info-section">
          <h3>🏢 Emisor</h3>
          <div class="info-row">
            <span class="info-label">NIT:</span>
            <span class="info-value">${emisor.nit || 'N/A'}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Nombre:</span>
            <span class="info-value">${emisor.nombre || 'N/A'}</span>
          </div>
        </div>

        <div class="info-section">
          <h3>👤 Receptor</h3>
          <div class="info-row">
            <span class="info-label">NIT:</span>
            <span class="info-value">${receptor.nit || 'N/A'}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Nombre:</span>
            <span class="info-value">${receptor.nombre || receptor.nombreComercial || 'N/A'}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Email:</span>
            <span class="info-value">${receptor.correo || 'N/A'}</span>
          </div>
        </div>

        <div class="footer">
          <p>Este correo fue generado automáticamente por el Sistema de DTE</p>
          <p>Por favor no responda a este mensaje</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Enviar correo de DTE a emisor y receptor
 */
export async function sendDTEEmails(
  dteData: any,
  mhResponse: any,
  pdfBase64?: string
): Promise<{ emisor: EmailResult; receptor: EmailResult }> {
  const emisor = dteData.identificacion || {};
  const receptor = dteData.receptor || {};
  
  const htmlContent = generateDTEEmailHTML(dteData, mhResponse);
  const subject = `DTE ${dteData.tipoDte} - Código: ${mhResponse.codigoGeneracion || dteData.codigoGeneracion}`;
  
  const attachments = pdfBase64 ? [{
    filename: `DTE_${mhResponse.codigoGeneracion || dteData.codigoGeneracion}.pdf`,
    content: Buffer.from(pdfBase64, 'base64'),
    contentType: 'application/pdf'
  }] : undefined;

  // Enviar a emisor
  const emisorResult = await sendEmail({
    to: emisor.correo || '',
    subject: `Copia de DTE Enviado - ${subject}`,
    html: htmlContent,
    attachments
  });

  // Enviar a receptor
  const receptorResult = await sendEmail({
    to: receptor.correo || '',
    subject: subject,
    html: htmlContent,
    attachments
  });

  logger.info('Correos DTE enviados', {
    emisorEmail: emisor.correo,
    receptorEmail: receptor.correo,
    emisorSuccess: emisorResult.success,
    receptorSuccess: receptorResult.success
  });

  return {
    emisor: emisorResult,
    receptor: receptorResult
  };
}
