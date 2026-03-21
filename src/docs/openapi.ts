export const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'API DTE',
    version: '1.0.0',
    description:
      'Documentación oficial del backend api-dte. Usa el endpoint /api/test/dev-token para obtener un bearer de desarrollo y probar los endpoints protegidos sin interacción manual.',
  },
  servers: [
    {
      url: '/',
      description: 'Servidor actual',
    },
  ],
  tags: [
    { name: 'Health', description: 'Estado general del servicio' },
    { name: 'Auth', description: 'Token técnico para pruebas con Swagger' },
    { name: 'Test', description: 'Endpoints públicos de pruebas y previsualización' },
    { name: 'DTE', description: 'Flujo de validación, firma, transmisión y contingencia' },
    { name: 'Business', description: 'Operaciones por negocio' },
    { name: 'Tax', description: 'Contadores e impacto fiscal' },
    { name: 'Admin', description: 'Operaciones administrativas' },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Pega aquí el token dev generado por /api/test/dev-token o un access token válido de Supabase Auth.',
      },
    },
    schemas: {
      DevTokenResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          tokenType: { type: 'string', example: 'Bearer' },
          accessToken: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' },
          expiresIn: { type: 'string', example: '8h' },
          user: {
            type: 'object',
            properties: {
              id: { type: 'string', example: 'swagger.dev@local' },
              email: { type: 'string', example: 'swagger.dev@local' },
              role: { type: 'string', example: 'admin' },
              isPlatformAdmin: { type: 'boolean', example: true },
            },
          },
        },
      },
      DevTokenRequest: {
        type: 'object',
        properties: {
          email: { type: 'string', example: 'swagger.dev@local' },
          role: { type: 'string', enum: ['admin', 'operator'], example: 'admin' },
          isPlatformAdmin: { type: 'boolean', example: true },
          businessId: { type: 'string', example: '11111111-2222-3333-4444-555555555555' },
          expiresIn: { type: 'string', example: '8h' },
        },
      },
      DtePayload: {
        type: 'object',
        description: 'Objeto DTE crudo esperado por el backend',
        additionalProperties: true,
      },
      DteValidateRequest: {
        type: 'object',
        required: ['dte'],
        properties: {
          dte: { $ref: '#/components/schemas/DtePayload' },
        },
      },
      DteSignRequest: {
        type: 'object',
        required: ['dte', 'passwordPri'],
        properties: {
          dte: { $ref: '#/components/schemas/DtePayload' },
          passwordPri: { type: 'string', example: '********' },
        },
      },
      DteTransmitRequest: {
        type: 'object',
        required: ['dte'],
        properties: {
          dte: { $ref: '#/components/schemas/DtePayload' },
          passwordPri: { type: 'string', example: '********' },
          ambiente: { type: 'string', enum: ['00', '01'], example: '00' },
        },
      },
      DteProcessRequest: {
        type: 'object',
        required: ['dte'],
        properties: {
          dte: { $ref: '#/components/schemas/DtePayload' },
          passwordPri: { type: 'string', example: '********' },
          ambiente: { type: 'string', enum: ['00', '01'], example: '00' },
          flowType: { type: 'string', enum: ['emission', 'reception'], example: 'emission' },
          businessId: { type: 'string', example: '11111111-2222-3333-4444-555555555555' },
          nit: { type: 'string', example: '0614-290786-102-3' },
          deviceId: { type: 'string', example: 'device-fingerprint-123' },
        },
      },
      DteContingencyRequest: {
        type: 'object',
        required: ['dte', 'passwordPri'],
        properties: {
          dte: { $ref: '#/components/schemas/DtePayload' },
          passwordPri: { type: 'string', example: '********' },
          motivo: { type: 'string', example: 'Falla en el servicio de Internet' },
        },
      },
      ApiError: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          error: {
            type: 'object',
            properties: {
              severity: { type: 'string', example: 'error' },
              category: { type: 'string', example: 'system' },
              code: { type: 'string', example: 'SYSTEM_ERROR' },
              userMessage: { type: 'string', example: 'Error interno del sistema' },
              canRetry: { type: 'boolean', example: true },
              details: { type: 'array', items: { type: 'string' } },
            },
          },
        },
      },
    },
  },
  paths: {
    '/health': {
      get: {
        tags: ['Health'],
        summary: 'Health check',
        responses: {
          200: {
            description: 'Servicio operativo',
          },
        },
      },
    },
    '/api/test/dev-token': {
      post: {
        tags: ['Auth'],
        summary: 'Genera un bearer técnico para pruebas',
        requestBody: {
          required: false,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/DevTokenRequest' },
            },
          },
        },
        responses: {
          200: {
            description: 'Token generado',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/DevTokenResponse' },
              },
            },
          },
        },
      },
    },
    '/api/test/email': {
      post: {
        tags: ['Test'],
        summary: 'Envía un correo de prueba',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['to', 'subject'],
                properties: {
                  to: { type: 'string', example: 'test@example.com' },
                  subject: { type: 'string', example: 'Test de correo' },
                  html: { type: 'string', example: '<h1>Hola mundo!</h1>' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Correo enviado' },
        },
      },
    },
    '/api/test/email-preview': {
      get: {
        tags: ['Test'],
        summary: 'Previsualiza el HTML del correo',
        responses: {
          200: { description: 'HTML generado' },
        },
      },
    },
    '/api/test/pdf-preview': {
      get: {
        tags: ['Test'],
        summary: 'Previsualiza el PDF del DTE',
        responses: {
          200: { description: 'PDF renderizado en HTML' },
        },
      },
    },
    '/api/dte/validate': {
      post: {
        tags: ['DTE'],
        security: [{ bearerAuth: [] }],
        summary: 'Valida y normaliza un DTE',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/DteValidateRequest' },
            },
          },
        },
        responses: {
          200: { description: 'Resultado de validación' },
          401: { description: 'No autorizado' },
        },
      },
    },
    '/api/dte/sign': {
      post: {
        tags: ['DTE'],
        security: [{ bearerAuth: [] }],
        summary: 'Firma un DTE',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/DteSignRequest' },
            },
          },
        },
        responses: {
          200: { description: 'Firma generada' },
          401: { description: 'No autorizado' },
        },
      },
    },
    '/api/dte/transmit': {
      post: {
        tags: ['DTE'],
        security: [{ bearerAuth: [] }],
        summary: 'Firma y transmite un DTE a MH',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/DteTransmitRequest' },
            },
          },
        },
        responses: {
          200: { description: 'Resultado de transmisión' },
          401: { description: 'No autorizado' },
        },
      },
    },
    '/api/dte/process': {
      post: {
        tags: ['DTE'],
        security: [{ bearerAuth: [] }],
        summary: 'Ejecuta el flujo completo del DTE',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/DteProcessRequest' },
            },
          },
        },
        responses: {
          200: { description: 'Flujo procesado' },
          401: { description: 'No autorizado' },
        },
      },
    },
    '/api/dte/contingency': {
      post: {
        tags: ['DTE'],
        security: [{ bearerAuth: [] }],
        summary: 'Procesa un DTE en modo contingencia',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/DteContingencyRequest' },
            },
          },
        },
        responses: {
          200: { description: 'Contingencia procesada' },
          401: { description: 'No autorizado' },
        },
      },
    },
    '/api/dte/{codigoGeneracion}/status': {
      get: {
        tags: ['DTE'],
        security: [{ bearerAuth: [] }],
        summary: 'Consulta el estado de un DTE',
        parameters: [
          {
            name: 'codigoGeneracion',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          200: { description: 'Estado del DTE' },
          401: { description: 'No autorizado' },
        },
      },
    },
    '/api/dte/business/{businessId}/dtes': {
      get: {
        tags: ['DTE'],
        security: [{ bearerAuth: [] }],
        summary: 'Lista los DTE de un negocio',
        parameters: [
          {
            name: 'businessId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          200: { description: 'Listado de DTEs' },
          401: { description: 'No autorizado' },
        },
      },
    },
    '/api/dte/{codigoGeneracion}/retry': {
      post: {
        tags: ['DTE'],
        security: [{ bearerAuth: [] }],
        summary: 'Reintenta una transmisión fallida',
        parameters: [
          {
            name: 'codigoGeneracion',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          200: { description: 'Reintento ejecutado' },
          401: { description: 'No autorizado' },
        },
      },
    },
  },
} as const;
