import { Router, Request, Response } from 'express';
import { createLogger } from '../utils/logger';
import { sendEmail, generateDTEEmailHTML } from '../services/emailService';
import { generateDtePdfBase64 } from '../services/pdfGenerator';
import { createDevAuthToken } from '../auth/devAuth';

const router = Router();
const logger = createLogger('testController');

// --- Fixtures básicos para previsualización (ajustar en desarrollo según necesidad) ---
const sampleDte = {
  identificacion: {
    tipoDte: '01',
    codigoGeneracion: 'ABC123-XYZ',
    fecEmi: new Date().toISOString().slice(0, 10),
    ambiente: '00',
    version: 1,
  },
  emisor: {
    nit: '0614-290786-102-3',
    nombre: 'Comercial Demo S.A. de C.V.',
    nombreComercial: 'Demo Market',
    correo: 'demo@emisor.com',
    logo_url: undefined,
  },
  receptor: {
    nombre: 'Cliente Prueba',
    nit: '0614-010101-101-1',
    correo: 'cliente@example.com',
  },
  resumen: {
    totalGravada: 100,
    totalExenta: 0,
    totalNoSujeta: 0,
    tributos: [{ codigo: '20', valor: 13 }],
    totalPagar: 113,
  },
  selloRecibido: 'SELLO_DEMO',
};

const sampleMhResponse = {
  codigoGeneracion: 'ABC123-XYZ',
  selloRecibido: 'SELLO_DEMO',
  fechaHoraProcesamiento: new Date().toISOString(),
  enlaceConsulta: 'https://example.com/consulta',
};

// POST /api/test/dev-token - Genera un bearer técnico para Swagger y pruebas automatizadas
router.post('/dev-token', (req: Request, res: Response) => {
  try {
    const {
      email,
      role = 'admin',
      isPlatformAdmin = true,
      businessId,
      expiresIn,
    } = req.body || {};

    const accessToken = createDevAuthToken({
      email,
      role,
      isPlatformAdmin,
      businessId,
      expiresIn,
    });

    res.json({
      success: true,
      tokenType: 'Bearer',
      accessToken,
      expiresIn: expiresIn || process.env.SWAGGER_DEV_TOKEN_TTL || '8h',
      user: {
        id: (email || process.env.SWAGGER_DEV_EMAIL || 'swagger.dev@local').toString().toLowerCase(),
        email: (email || process.env.SWAGGER_DEV_EMAIL || 'swagger.dev@local').toString().toLowerCase(),
        role,
        isPlatformAdmin,
        businessId: businessId || null,
      },
    });
  } catch (error) {
    logger.error('Error generando token dev', { error });
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'No se pudo generar el token dev',
    });
  }
});

// POST /api/test/email - Solo para desarrollo/testing (sin auth)
router.post('/email', async (req: Request, res: Response) => {
  try {
    const { to, subject, html } = req.body;
    
    // Validaciones básicas
    if (!to || !subject) {
      return res.status(400).json({
        error: 'Se requieren "to" y "subject"',
        example: {
          to: 'test@example.com',
          subject: 'Test de correo',
          html: '<h1>Hola mundo!</h1>'
        }
      });
    }

    // HTML por defecto si no se proporciona
    const emailHtml = html || `
      <div style="font-family: Arial, sans-serif; padding: 20px; background: #f4f4f4;">
        <div style="max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px;">
          <h1 style="color: #007bff;">✅ Test de Correo Exitoso</h1>
          <p>Este es un correo de prueba desde api-dte usando Resend.</p>
          <p><strong>Destinatario:</strong> ${to}</p>
          <p><strong>Asunto:</strong> ${subject}</p>
          <p><strong>Fecha:</strong> ${new Date().toLocaleString('es-SV')}</p>
          <hr style="margin: 20px 0;">
          <p style="color: #666; font-size: 12px;">
            Este correo fue generado automáticamente por el endpoint de prueba de api-dte.
          </p>
        </div>
      </div>
    `;

    // Enviar correo
    const result = await sendEmail({
      to,
      subject,
      html: emailHtml
    });

    if (result.success) {
      logger.info('Test email enviado exitosamente', { 
        to, 
        messageId: result.messageId 
      });

      res.json({
        success: true,
        message: 'Correo de prueba enviado exitosamente',
        messageId: result.messageId,
        details: {
          to,
          subject,
          timestamp: new Date().toISOString()
        }
      });
    } else {
      logger.error('Error enviando test email', { error: result.error });
      
      res.status(500).json({
        success: false,
        error: 'Error enviando correo',
        details: result.error
      });
    }
  } catch (error) {
    logger.error('Error en endpoint test email', { error });
    
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      details: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
});

// GET /api/test/email-preview - Dev: render HTML del correo sin enviarlo
router.get('/email-preview', async (_req: Request, res: Response) => {
  try {
    const html = generateDTEEmailHTML(sampleDte, sampleMhResponse);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (error) {
    logger.error('Error en email-preview', { error });
    res.status(500).json({ error: 'Error generando preview de email' });
  }
});

// GET /api/test/pdf-preview - Dev: render PDF en el navegador usando data URL
router.get('/pdf-preview', async (_req: Request, res: Response) => {
  try {
    const pdfBase64 = await generateDtePdfBase64({ dte: sampleDte, mhResponse: sampleMhResponse, logoUrl: sampleDte.emisor.logo_url });
    const html = `<!doctype html><html><body style="margin:0; padding:0; width:100vw; height:100vh; overflow:hidden;">
      <iframe src="data:application/pdf;base64,${pdfBase64}" style="border:0; width:100%; height:100%;" title="PDF Preview"></iframe>
    </body></html>`;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (error) {
    logger.error('Error en pdf-preview', { error });
    res.status(500).json({ error: 'Error generando preview de PDF' });
  }
});

export default router;
