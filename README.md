# DTE Backend - El Salvador

## 📁 Contenido
Backend Node.js para el sistema de facturación electrónica DTE de El Salvador.

## 🚀 Características

- **Procesamiento DTE** con LangGraph workflow
- **Integración Ministerio Hacienda** (sandbox y producción)
- **Cálculos fiscales** automáticos (IVA, F14, acumulados)
- **Firma electrónica** vía servicio Java dedicado
- **Base de datos** Supabase para persistencia
- **API RESTful** con autenticación JWT
- **Logging estructurado** con Winston
- **Manejo de contingencia** para modo offline

## 📂 Estructura del Proyecto

```
src/
├── controllers/         # API handlers
│   ├── dteController.ts
│   ├── taxController.ts
│   └── batchController.ts
├── middleware/          # Auth, validation, error handling
│   ├── auth.ts
│   └── errorHandler.ts
├── workflows/           # LangGraph workflow (agents/)
│   ├── dteWorkflow.ts   # Workflow principal
│   ├── state.ts         # Estado del agente
│   └── batchIngestion.ts # Procesamiento masivo
├── tax/                # Cálculos fiscales
│   ├── taxCalculator.ts
│   ├── taxStorage.ts
│   └── types.ts
├── mh/                 # Integración Ministerio Hacienda
│   ├── config.ts
│   ├── normalize.ts
│   ├── process.ts
│   ├── sandboxClient.ts
│   ├── schema.ts
│   ├── types.ts
│   ├── validateRules.ts
│   └── validateSchema.ts
├── dte/               # Generación DTE
│   └── generator.ts
├── integrations/      # Clientes externos
│   └── firmaClient.ts # Cliente firma Java
├── database/          # Supabase client
│   └── supabase.ts
├── utils/            # Helpers
│   └── logger.ts
└── types/            # Tipos compartidos
    └── types.ts
```

## 🛠️ Instalación

```bash
# Instalar dependencias
npm install

# Copiar variables de entorno
cp .env.example .env

# Configurar variables de entorno
# Editar .env con tus credenciales
```

## ⚙️ Variables de Entorno

```env
# Supabase
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_KEY=your_service_key

# Resend
RESEND_API_KEY=your_resend_key
RESEND_FROM_EMAIL=noreply@yourdomain.com

# MH Integration
MH_BASE_URL_TEST=https://apitest.dtes.mh.gob.sv
MH_BASE_URL_PROD=https://api.dtes.mh.gob.sv

# Firma Service
FIRMA_SERVICE_URL=https://api-firma.onrender.com/firma

# Security
JWT_SECRET=your_jwt_secret
API_KEY_SECRET=your_api_key

# Environment
NODE_ENV=development
PORT=3001
```

## 🚀 Ejecución

```bash
# Desarrollo
npm run dev

# Producción
npm run build
npm start

# Testing
npm test
```

## � API Endpoints

### DTE Operations
```
POST /api/dte/validate          - Validar estructura DTE
POST /api/dte/sign              - Firmar DTE (coordina con Java)
POST /api/dte/transmit          - Transmitir a MH
POST /api/dte/process           - Workflow completo (LangGraph)
POST /api/dte/contingency       - Modo contingencia
```

### Tax Operations
```
GET  /api/tax/accumulators/:period - Obtener acumulador mensual
POST /api/tax/accumulators         - Actualizar acumulador
GET  /api/tax/f14/:period         - Generar F14
GET  /api/tax/export/csv           - Exportar CSV DGII
GET  /api/tax/accumulators         - Listar todos los acumuladores
```

### Batch Operations
```
POST /api/batch/ingest         - Procesar múltiples DTEs
GET  /api/batch/status/:id     - Verificar estado batch
```

### Health Check
```
GET /health                     - Estado del servidor
```

## � Autenticación

Los endpoints requieren autenticación JWT:

```bash
# Header: Authorization
Bearer <jwt_token>
```

## 📊 Base de Datos (Supabase)

### Tablas Principales

```sql
-- DTE Documents
CREATE TABLE dte_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo_generacion text UNIQUE NOT NULL,
  tipo_dte text NOT NULL,
  numero_control text NOT NULL,
  estado text NOT NULL,
  dte_json jsonb NOT NULL,
  firma_jws text,
  mh_response jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Tax Accumulators
CREATE TABLE tax_accumulators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period text NOT NULL, -- YYYY-MM
  nit_emisor text NOT NULL,
  debito_fiscal numeric(15,2) DEFAULT 0,
  credito_fiscal numeric(15,2) DEFAULT 0,
  ventas_exentas numeric(15,2) DEFAULT 0,
  ventas_no_sujetas numeric(15,2) DEFAULT 0,
  ventas_totales numeric(15,2) DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(period, nit_emisor)
);
```

## 🔄 Workflow LangGraph

El sistema utiliza LangGraph para orquestar el procesamiento DTE:

1. **Validator Node** - Validación estructura y reglas MH
2. **Signer Node** - Coordinación con servicio de firma Java
3. **Transmitter Node** - Transmisión a MH con reintentos
4. **Contingency Node** - Manejo modo offline/diferido
5. **Tax Keeper Node** - Actualización acumulados fiscales
6. **Reception Node** - Procesamiento DTE recibidos

## 🧪 Testing

```bash
# Ejecutar tests
npm test

# Tests con coverage
npm run test:coverage

# Tests específicos
npm test -- --grep "DTE"
```

## 📦 Deploy

### Render (Recomendado)
1. Conectar repo a Render
2. Configurar variables de entorno
3. Deploy automático

### Docker
```bash
# Build
docker build -t dte-backend .

# Run
docker run -p 3001:3001 --env-file .env dte-backend
```

## � Desarrollo

### Logs
Los logs se estructuran por servicio:
- `server` - Servidor Express
- `dteController` - Endpoints DTE
- `taxController` - Operaciones fiscales
- `firmaClient` - Cliente firma
- `supabase` - Base de datos

### Errores
- Manejo centralizado de errores
- Logging automático de errores
- Respuestas estandarizadas

## 📝 Notas Importantes

- **Java Service**: Este backend CONSUME el servicio Java existente, no lo reemplaza
- **Ambientes**: Sandbox (`00`) para pruebas, Producción (`01`) para real
- **Redondeo**: Precisión de 11.8 para cantidades, 2 decimales para resumen
- **Contingencia**: Manejo automático de fallas de comunicación

---

**🚀 Listo para facturar electrónicamente en El Salvador**
