# Deploy en Render - Backend DTE

## 🚀 Configuración para Render

Este backend está configurado para deploy automático en Render.

### 1. Conectar Repositorio

1. Ve a [Render Dashboard](https://dashboard.render.com/)
2. Click "New +" → "Web Service"
3. Conecta tu repositorio GitHub: `rogelioGuerrero/api-dte`
4. Render detectará automáticamente que es un proyecto Node.js

### 2. Configuración del Service

**Build Settings:**
- **Runtime**: Node 18 (o superior)
- **Build Command**: `npm install && npm run build`
- **Start Command**: `npm start`

**Environment Variables:**
```env
NODE_ENV=production
PORT=3001

# Supabase (requerido)
SUPABASE_URL=tu_supabase_url
SUPABASE_ANON_KEY=tu_supabase_anon_key
SUPABASE_SERVICE_KEY=tu_supabase_service_key

# Ministerio Hacienda (requerido)
MH_BASE_URL_TEST=https://apitest.dtes.mh.gob.sv
MH_BASE_URL_PROD=https://api.dtes.mh.gob.sv

# Servicio de Firma (requerido)
FIRMA_SERVICE_URL=https://api-firma.onrender.com/firma

# Seguridad (requerido)
JWT_SECRET=tu_jwt_secreto
API_KEY_SECRET=tu_api_key_secreta

# Opcional
RESEND_API_KEY=tu_resend_key
RESEND_FROM_EMAIL=noreply@tudominio.com
LOG_LEVEL=info
```

### 3. Health Check

Render verificará automáticamente el endpoint `/health`:
```json
{
  "status": "ok",
  "timestamp": "2026-02-20T21:00:00.000Z",
  "environment": "production"
}
```

### 4. URL del Backend

Una vez deployado, tu backend estará disponible en:
```
https://tu-service-name.onrender.com
```

### 5. Endpoints Disponibles

```bash
# DTE Operations
POST /api/dte/process          # Workflow completo
POST /api/dte/validate         # Validación
POST /api/dte/sign             # Firma
POST /api/dte/transmit         # Transmisión
POST /api/dte/contingency      # Contingencia
GET  /api/dte/:id/status       # Estado
POST /api/dte/:id/retry        # Reintentar

# Tax Operations
GET  /api/tax/accumulators/:period
POST /api/tax/accumulators
GET  /api/tax/f14/:period

# Health Check
GET /health
```

### 6. Autenticación

Todos los endpoints requieren JWT:
```bash
Authorization: Bearer <tu_jwt_token>
```

### 7. Troubleshooting

**Error: ERR_MODULE_NOT_FOUND**
- ✅ Ya está arreglado (cambiamos a CommonJS)

**Error: Cannot find module**
- ✅ Ya está arreglado (configuración TypeScript correcta)

**Variables de entorno faltantes**
- Configura todas las variables requeridas en el dashboard de Render

**Conexión a Supabase falla**
- Verifica que las credenciales de Supabase sean correctas
- Asegura que las tablas `dte_documents` y `tax_accumulators` existan

### 8. Verificación

Para verificar que todo funciona:

1. **Health Check:**
```bash
curl https://tu-service-name.onrender.com/health
```

2. **Probar endpoint (con JWT válido):**
```bash
curl -X POST https://tu-service-name.onrender.com/api/dte/validate \
  -H "Authorization: Bearer <jwt>" \
  -H "Content-Type: application/json" \
  -d '{"dte": {"identificacion": {"tipoDte": "01"}}}'
```

### 9. Monitoreo

- **Logs**: Disponibles en el dashboard de Render
- **Metrics**: Render provee métricas básicas
- **Health Checks**: Automáticos cada 30s

### 10. Cambios Recientes para Deploy

- ✅ Cambiado de ESNext a CommonJS en `tsconfig.json`
- ✅ Agregado `"type": "commonjs"` en `package.json`
- ✅ Arreglado `import.meta.env` → `process.env`
- ✅ Agregado `.nvmrc` para Node 18
- ✅ Agregado `render.yaml` para configuración
- ✅ Deshabilitado `declaration` en TypeScript

---

## 🎯 Listo para Producción

El backend ahora está listo para deploy en Render. Una vez configuradas las variables de entorno, el servicio debería iniciar correctamente y estar disponible para el frontend.
