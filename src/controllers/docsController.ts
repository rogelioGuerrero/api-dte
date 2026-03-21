import { Router, Request, Response } from 'express';
import { openApiSpec } from '../docs/openapi';

const router = Router();

const swaggerHtml = `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>API DTE · Swagger</title>
    <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
    <style>
      html, body { margin: 0; padding: 0; background: #0f172a; }
      .swagger-ui .topbar { display: none; }
      .swagger-ui .info .title { color: #e2e8f0; }
      .swagger-ui .scheme-container { background: #111827; box-shadow: none; margin: 0 0 16px; }
      .swagger-ui .opblock .opblock-summary-description, .swagger-ui .opblock .opblock-summary-path { color: #94a3b8; }
      .swagger-ui .info { margin: 24px 0 12px; }
      .swagger-ui .btn.authorize { background-color: #2563eb; border-color: #2563eb; }
      .swagger-ui .btn.authorize:hover { background-color: #1d4ed8; border-color: #1d4ed8; }
      .swagger-banner {
        background: linear-gradient(135deg, #0f172a 0%, #111827 100%);
        color: #e2e8f0;
        padding: 20px 24px 0;
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      }
      .swagger-banner h1 { margin: 0 0 8px; font-size: 22px; }
      .swagger-banner p { margin: 0 0 14px; color: #cbd5e1; line-height: 1.5; }
      .swagger-banner .actions { display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 12px; }
      .swagger-banner .actions button, .swagger-banner .actions a {
        appearance: none;
        border: 1px solid #334155;
        background: #1e293b;
        color: #e2e8f0;
        padding: 10px 14px;
        border-radius: 10px;
        font-weight: 600;
        cursor: pointer;
        text-decoration: none;
      }
      .swagger-banner .actions button:hover, .swagger-banner .actions a:hover { background: #334155; }
      .swagger-token { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 12px; word-break: break-all; }
    </style>
  </head>
  <body>
    <div class="swagger-banner">
      <h1>API DTE · Swagger</h1>
      <p>
        Usa <strong>/api/test/dev-token</strong> para obtener un bearer técnico y probar endpoints protegidos sin depender del frontend.
        El botón inferior carga el token automáticamente en Swagger cuando estás en desarrollo.
      </p>
      <div class="actions">
        <button id="generate-token">Generar token dev</button>
        <button id="copy-token">Copiar token</button>
        <a href="/api/openapi.json" target="_blank" rel="noreferrer">Ver OpenAPI JSON</a>
      </div>
      <div id="token-status" class="swagger-token">Token dev no generado todavía.</div>
    </div>
    <div id="swagger-ui"></div>
    <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
    <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-standalone-preset.js"></script>
    <script>
      const ui = SwaggerUIBundle({
        url: '/api/openapi.json',
        dom_id: '#swagger-ui',
        deepLinking: true,
        persistAuthorization: true,
        displayRequestDuration: true,
        defaultModelsExpandDepth: 1,
        docExpansion: 'none',
        presets: [SwaggerUIBundle.presets.apis, SwaggerUIStandalonePreset],
        layout: 'BaseLayout',
      });

      const tokenStatus = document.getElementById('token-status');
      const generateBtn = document.getElementById('generate-token');
      const copyBtn = document.getElementById('copy-token');
      let currentToken = '';

      async function generateToken() {
        tokenStatus.textContent = 'Generando token técnico...';
        const response = await fetch('/api/test/dev-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ role: 'admin', isPlatformAdmin: true }),
        });

        if (!response.ok) {
          const text = await response.text();
          throw new Error(text || 'No se pudo generar el token dev');
        }

        const data = await response.json();
        currentToken = data.accessToken;
        tokenStatus.textContent = data.accessToken;
        ui.preauthorizeApiKey('bearerAuth', data.accessToken);
        return data.accessToken;
      }

      generateBtn.addEventListener('click', async () => {
        try {
          await generateToken();
        } catch (error) {
          tokenStatus.textContent = 'Error generando token dev: ' + (error?.message || error);
        }
      });

      copyBtn.addEventListener('click', async () => {
        if (!currentToken) {
          await generateToken();
        }
        await navigator.clipboard.writeText(currentToken);
        tokenStatus.textContent = 'Token copiado al portapapeles.';
      });
    </script>
  </body>
</html>`;

router.get('/openapi.json', (_req: Request, res: Response) => {
  res.json(openApiSpec);
});

router.get('/docs', (_req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(swaggerHtml);
});

export default router;
