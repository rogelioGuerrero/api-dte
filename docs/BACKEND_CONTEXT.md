# DTE Backend Context - El Salvador

## Project Overview
Sistema de facturación electrónica DTE para El Salvador con arquitectura de microservicios. Este backend Node.js orquestará el flujo completo de DTE usando LangGraph, mientras se integra con servicios existentes.

## Complete Architecture
```
Frontend (Netlify Free) → Backend Node.js (Render) → Java Firma (Render) → Ministerio de Hacienda
     ↓                      ↓                        ↓                    ↓
   React/TS            LangGraph +              Spring Boot           API MH
   UI Simple           Supabase +               Firma Electrónica      Validación
   Feedback            Resend                   P12/JWS              Sello Recepción
```

## Service Responsibilities

### Frontend (React/TypeScript - Netlify)
- **Role**: Interfaz de usuario simple
- **Functions**: Formularios, validación básica, mostrar resultados
- **LangGraph**: Solo heurísticas livianas (sin IA por ahora)
- **Calls**: Solo al backend Node.js

### Backend (Node.js/TypeScript - Render) - ESTE PROYECTO
- **Role**: Orquestador principal del flujo DTE
- **LangGraph**: Workflow completo con nodos especializados
- **Integrations**: Supabase (DB), Resend (Email), Java (Firma), MH (API)
- **Processing**: Validación, firma, transmisión, reintentos, contingencia

### Firma Service (Java/Spring - Render)
- **Role**: Servicio de firma electrónica dedicado
- **Functions**: Manejo de certificados P12, generación JWS
- **Status**: EXISTENTE - No modificar, solo consumir vía API

### Ministerio de Hacienda (API Externa)
- **Role**: Autoridad fiscal que valida y sella DTEs
- **Environments**: Sandbox (pruebas) + Production (real)
- **Response**: Sello de recepción o errores de validación

## Key Features to Implement

### 1. DTE Workflow (LangGraph)
- **Validator Node**: Validación de estructura y reglas de negocio MH
- **Signer Node**: Coordinación con servicio de firma Java
- **Transmitter Node**: Transmisión a MH con reintentos automáticos
- **Contingency Node**: Manejo de modo offline/diferido
- **Tax Keeper Node**: Actualización de acumulados fiscales F14/F07
- **Reception Node**: Procesamiento de DTE recibidos

### 2. Tax Calculation Engine
- Cálculo de IVA (13%) con redondeo MH (11.8 precisión)
- Acumulados mensuales automáticos
- Generación F14 (Pago a Cuenta)
- Exportación CSV DGII formato oficial

### 3. Integration Points
- **Ministerio de Hacienda**: 
  - Sandbox: `https://apitest.dtes.mh.gob.sv`
  - Production: `https://api.dtes.mh.gob.sv`
- **Servicio Firma**: `https://api-firma.onrender.com/firma`
- **Supabase**: Persistencia fiscal y catálogos
- **Resend**: Notificaciones email

## Business Rules (El Salvador)

### MH Validation Rules
- **Redondeo Cuerpo**: 11 enteros, 8 decimales (11.8)
- **Redondeo Resumen**: Máximo 2 decimales
- **Holgura**: +/- $0.01 tolerancia
- **IVA**: 13% sobre base imponible

### Document Types
- **01**: Factura Consumidor Final
- **03**: Crédito Fiscal (CCF)
- **04**: Nota de Crédito
- **05**: Nota de Débito
- **07**: Comprobante de Retención
- **08**: Comprobante de Liquidación
- **09**: Factura Exportación

### Tax Types
- **20**: IVA (13%)
- **F14**: Pago a Cuenta (1% IVA)
- **F07**: Declaración Mensual

## Technical Requirements

### Dependencies
```json
{
  "@langchain/langgraph": "^1.1.4",
  "@langchain/core": "^1.1.25",
  "@supabase/supabase-js": "^2.x",
  "resend": "^3.x",
  "express": "^4.x",
  "cors": "^2.x",
  "helmet": "^7.x",
  "joi": "^17.x",
  "winston": "^3.x"
}
```

### Environment Variables
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
NODE_ENV=production
PORT=3001
```

## API Endpoints Structure

### DTE Operations
```
POST /api/dte/validate          - Validate DTE structure
POST /api/dte/sign              - Sign DTE (coordina con Java)
POST /api/dte/transmit          - Transmit to MH
POST /api/dte/process           - Full workflow (LangGraph)
POST /api/dte/contingency       - Handle offline mode
```

### Tax Operations
```
GET  /api/tax/accumulators/:period - Get monthly accumulator
POST /api/tax/accumulators         - Update accumulator
GET  /api/tax/f14/:period         - Generate F14
GET  /api/tax/export/csv           - Export DGII format
```

### Batch Operations
```
POST /api/batch/ingest         - Process multiple DTEs
GET  /api/batch/status/:id     - Check batch status
```

## Database Schema (Supabase)

### Tables
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

-- Batch Processing
CREATE TABLE batch_operations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status text NOT NULL, -- processing, completed, failed
  total_items integer NOT NULL,
  successful_items integer DEFAULT 0,
  failed_items integer DEFAULT 0,
  errors jsonb,
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz
);
```

## Migration Strategy

### Phase 1: Backend Foundation
1. **Crear nuevo proyecto** `dte-backend/`
2. **Mover lógica LangGraph** del frontend al backend
3. **Configurar Express + TypeScript** base
4. **Implementar integración Supabase + Resend**

### Phase 2: Service Integration
1. **Conectar con Java Firma** existente (via HTTP calls)
2. **Implementar endpoints MH** (sandbox + production)
3. **Crear API endpoints** para consumo del frontend
4. **Testing con servicios existentes**

### Phase 3: Frontend Updates
1. **Simplificar frontend** - remover LangGraph pesado
2. **Mantener LangGraph liviano** para heurísticas UI
3. **Actualizar llamadas API** al nuevo backend
4. **Testing integración completa**

### Phase 4: Production Deployment
1. **Deploy backend** a Render
2. **Configurar environment variables**
3. **Testing end-to-end**
4. **Monitor performance**

---

**Note Importante:** Este backend NO reemplaza al servicio Java existente. Lo CONSUME como un cliente más, manteniendo la separación de responsabilidades.

## Security Considerations
- API Key authentication for endpoints
- Request rate limiting
- Input validation with Joi
- HTTPS only
- CORS configuration
- Audit logging

## Monitoring & Logging
- Winston for structured logging
- Health check endpoint
- Performance metrics
- Error tracking
- DTE processing status

## Deployment Notes
- **Backend**: Render (Node.js)
- **Database**: Supabase (PostgreSQL)
- **Email**: Resend
- **Firma**: Existing Java service (Render)
- **Frontend**: Netlify (React)

## Testing Strategy
- Unit tests for workflow nodes
- Integration tests for API endpoints
- Mock MH responses for testing
- Load testing for batch operations
- End-to-end workflow testing

---

**Next Steps:**
1. Create new backend project structure
2. Setup Express + TypeScript foundation
3. Implement LangGraph workflow migration
4. Add Supabase integration
5. Create API endpoints
6. Test with existing frontend
