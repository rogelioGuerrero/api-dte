# Migration Plan: DTE Backend Separation

## Deployment Architecture Options

### Option A: 3 Services (Recommended - Separation of Concerns)

**Service 1: Frontend (Netlify - Free)**
```
└── React/TypeScript App
    ├── UI Components
    ├── Form Validation
    ├── IndexedDB Cache
    └── API Client (calls backend)
```

**Service 2: Backend API (Render - $7-15/mo)**
```
└── Node.js + Express + TypeScript
    ├── LangGraph Workflow Engine
    ├── Supabase Database Client
    ├── Resend Email Service
    ├── MH API Integration
    └── Java Firma Service Client
```

**Service 3: Firma Service (Render - $7-15/mo)**
```
└── Java/Spring Boot (EXISTENTE - No cambiar)
    ├── Electronic Signature
    ├── P12 Certificate Handling
    └── JWS Generation
```

**Cost: ~$14-30/mo total**
**Ventajas:**
- ✅ Java service ya funciona y está probado
- ✅ Independencia de tecnologías (Node.js vs Java)
- ✅ Escalamiento separado (firma puede necesitar más recursos)
- ✅ Menos riesgo en migración
- ✅ Rollback más fácil si algo falla

---

### Option B: 2 Services (Combined Backend - Cost Optimized)

**Service 1: Frontend (Netlify - Free)**
```
└── React/TypeScript App
    ├── UI Components
    ├── Form Validation
    ├── IndexedDB Cache
    └── API Client (calls backend)
```

**Service 2: Backend + Firma (Render - $7-15/mo)**
```
└── Node.js + Express + TypeScript
    ├── LangGraph Workflow Engine
    ├── Supabase Database Client
    ├── Resend Email Service
    ├── MH API Integration
    └── FIRMA INTEGRADA (migrar Java a Node.js)
        ├── P12 Certificate Handling
        ├── JWS Generation  
        └── Signature Logic
```

**Cost: ~$7-15/mo total**
**Ventajas:**
- ✅ Más económico (1 servicio menos)
- ✅ Menor complejidad de despliegue
**Desventajas:**
- ❌ Hay que migrar lógica de Java a Node.js
- ❌ Mayor riesgo (tocar código que ya funciona)
- ❌ Puede requerir librerías criptográficas adicionales

## Recommendation: Option A

**Why keep Java service separate:**
- ✅ Java service ya funciona y está probado
- ✅ Independencia de tecnologías
- ✅ Escalamiento separado (firma puede necesitar más recursos)
- ✅ Menos riesgo en migración
- ✅ Rollback más fácil si algo falla

## Cost Optimization

### Render Free Tier Limitations:
- **Free**: 750 hours/mo, 512MB RAM, shared CPU
- **Starter**: $7/mo, 512MB RAM, dedicated CPU
- **Standard**: $15/mo, 1GB RAM, better performance

### Supabase Free Tier:
- 500MB database
- 50MB file storage
- 2GB bandwidth
- 50,000 monthly active users

### Resend Free Tier:
- 3,000 emails/mo
- 100 emails/day

## Migration Steps

### Step 1: Create Backend Project
```bash
mkdir d:\proyectoBolt\dte-backend
cd d:\proyectoBolt\dte-backend
npm init -y
# Install dependencies...
```

### Step 2: Copy Core Files
Copy these folders/files to new backend:
- `utils/agents/` → `src/workflows/`
- `utils/tax/` → `src/tax/`
- `utils/mh/` → `src/mh/`
- `utils/dteGenerator.ts` → `src/dte/`
- `utils/firmaApiClient.ts` → `src/integrations/`
- `utils/processor.ts` → `src/processing/`
- `utils/fieldMapping.ts` → `src/exports/`
- `types.ts` → `src/types/`

### Step 3: Setup New Project Structure
```
dte-backend/
├── src/
│   ├── controllers/     # API handlers
│   ├── middleware/      # Auth, validation
│   ├── workflows/       # LangGraph nodes
│   ├── integrations/    # External APIs
│   ├── database/        # Supabase client
│   ├── utils/          # Helpers
│   └── types/          # TypeScript types
├── tests/
├── docs/
└── package.json
```

### Step 4: Deploy Backend
1. Push to GitHub
2. Connect to Render
3. Set environment variables
4. Deploy and test

### Step 5: Update Frontend
1. Remove LangGraph dependencies
2. Update API calls to new backend
3. Test integration
4. Deploy to Netlify

## Files to Move vs Copy

### Move (Delete from frontend):
```bash
# These go to backend completely
utils/agents/
utils/tax/
utils/mh/
utils/dteGenerator.ts
utils/firmaApiClient.ts
utils/processor.ts
utils/fieldMapping.ts
```

### Copy (Keep in both):
```bash
# Shared types - keep in frontend for UI
types.ts
utils/mh/types.ts
```

### Keep in Frontend:
```bash
# UI-specific
components/
hooks/
utils/clientDb.ts
utils/dteHistoryDb.ts
utils/inventoryDb.ts
utils/productDb.ts
utils/emisorDb.ts
utils/settings.ts
utils/validators.ts (simple form validation)
utils/globalToast.ts
utils/notifications.ts
utils/secureStorage.ts
utils/deviceFingerprint.ts
utils/qrClientCapture.ts
utils/p12Handler.ts
utils/pdfGenerator.ts
utils/pdfTemplates.ts
utils/ocr.ts
utils/images/
utils/inventario/
```

## Environment Variables Setup

### Backend (.env)
```env
# Copy from existing .env
MH_BASE_URL_TEST=https://apitest.dtes.mh.gob.sv
MH_BASE_URL_PROD=https://api.dtes.mh.gob.sv

# New backend variables
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_KEY=your_service_key
RESEND_API_KEY=your_resend_key
JWT_SECRET=your_jwt_secret
API_KEY_SECRET=your_api_key
```

### Frontend (.env)
```env
# Update to point to new backend
VITE_API_URL=https://your-backend.onrender.com
# Keep existing MH proxy for direct calls if needed
```

## Testing Strategy

### Phase 1: Backend Testing
- Unit tests for each workflow node
- Integration tests with Supabase
- Mock tests for MH and Firma services

### Phase 2: Integration Testing
- Test full DTE workflow end-to-end
- Verify frontend-backend communication
- Load testing with batch operations

### Phase 3: Production Testing
- Deploy to staging first
- Test with real MH sandbox
- Verify email notifications
- Performance testing

## Rollback Plan

If backend migration fails:
1. Keep frontend working with current implementation
2. Backend can be turned off without affecting frontend
3. Gradual migration possible
4. Zero downtime deployment strategy

---

**Decision Point:**
¿Prefieres Option A (3 servicios) o Option B (2 servicios combinados)?

Te recomiendo Option A por seguridad y mantenibilidad, pero Option B te ahorra ~$7-15/mo.
