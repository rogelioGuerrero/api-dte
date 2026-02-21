import { Router, Request, Response } from 'express';
import { createLogger } from '../utils/logger';
import { sendEmail } from '../services/emailService';

const router = Router();
const logger = createLogger('testController');

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

export default router;
