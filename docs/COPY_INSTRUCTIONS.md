# Instrucciones de Copia para Backend DTE

## 🎯 Objetivo
Crear nuevo proyecto backend sin dañar el frontend existente.

## 📁 Carpetas a COPIAR al backend (Mantener en frontend también)

### 1. Tipos Compartidos (Copiar, no mover)
```bash
# Estos se necesitan en ambos lugares
types.ts → backend/src/types/
utils/mh/types.ts → backend/src/mh/types/
```

## 📁 Carpetas a MOVER al backend (Eliminar del frontend después)

### 2. Lógica de Negocio Principal
```bash
utils/agents/ → backend/src/workflows/
├── dteWorkflow.ts     # LangGraph workflow principal
├── state.ts          # Estado del agente DTE
└── batchIngestion.ts # Procesamiento masivo

utils/tax/ → backend/src/tax/
├── taxCalculator.ts  # Cálculos fiscales F14/F07
├── taxStorage.ts     # IndexedDB → Supabase adapter
└── types.ts          # Tipos de impuestos

utils/mh/ → backend/src/mh/
├── config.ts         # Configuración MH
├── normalize.ts      # Normalización de datos
├── process.ts        # Procesamiento principal
├── sandboxClient.ts  # Cliente MH sandbox
├── schema.ts         # Schema validación
├── types.ts          # Tipos MH (copiar también)
├── validateRules.ts  # Reglas de validación
└── validateSchema.ts # Validación de schema
```

### 3. Integraciones y Procesamiento
```bash
utils/dteGenerator.ts → backend/src/dte/generator.ts
utils/firmaApiClient.ts → backend/src/integrations/firmaClient.ts
utils/processor.ts → backend/src/processing/processor.ts
utils/fieldMapping.ts → backend/src/exports/fieldMapping.ts
```

## 📁 Archivos a MANTENER en frontend

### 4. UI y Client-side (No mover)
```bash
components/          # Componentes React
hooks/              # React hooks
utils/clientDb.ts   # Base de datos local
utils/dteHistoryDb.ts # Historial local
utils/inventoryDb.ts # Inventario local
utils/productDb.ts  # Productos local
utils/emisorDb.ts   # Emisor local
utils/settings.ts   # Configuración local
utils/validators.ts # Validación simple de forms
utils/globalToast.ts # Notificaciones UI
utils/notifications.ts # Sistema notificaciones
utils/secureStorage.ts # Almacenamiento seguro
utils/deviceFingerprint.ts # Identificación dispositivo
utils/qrClientCapture.ts # Captura QR
utils/p12Handler.ts # Manejo P12 cliente
utils/pdfGenerator.ts # Generación PDF
utils/pdfTemplates.ts # Plantillas PDF
utils/ocr.ts         # OCR cliente
utils/images/        # Manejo imágenes
utils/inventario/    # Gestión inventario
utils/ai/           # IA frontend (heurísticas livianas)
utils/auth/         # Autenticación frontend
utils/shims/        # Polyfills frontend
```

## 🔄 Proceso de Copia Paso a Paso

### Paso 1: Crear estructura backend
```bash
mkdir d:\proyectoBolt\dte-backend
cd d:\proyectoBolt\dte-backend

mkdir -p src/{workflows,tax,mh,dte,integrations,processing,exports,types,controllers,middleware,database,utils}
mkdir -p tests docs
```

### Paso 2: Copiar archivos (sin mover aún)
```bash
# Copiar tipos compartidos
copy d:\proyectoBolt\dte\types.ts d:\proyectoBolt\dte-backend\src\types\
copy d:\proyectoBolt\dte\utils\mh\types.ts d:\proyectoBolt\dte-backend\src\mh\types\

# Copiar lógica de negocio
xcopy d:\proyectoBolt\dte\utils\agents d:\proyectoBolt\dte-backend\src\workflows\ /E /I
xcopy d:\proyectoBolt\dte\utils\tax d:\proyectoBolt\dte-backend\src\tax\ /E /I
xcopy d:\proyectoBolt\dte\utils\mh d:\proyectoBolt\dte-backend\src\mh\ /E /I

# Copiar integraciones
copy d:\proyectoBolt\dte\utils\dteGenerator.ts d:\proyectoBolt\dte-backend\src\dte\generator.ts
copy d:\proyectoBolt\dte\utils\firmaApiClient.ts d:\proyectoBolt\dte-backend\src\integrations\firmaClient.ts
copy d:\proyectoBolt\dte\utils\processor.ts d:\proyectoBolt\dte-backend\src\processing\processor.ts
copy d:\proyectoBolt\dte\utils\fieldMapping.ts d:\proyectoBolt\dte-backend\src\exports\fieldMapping.ts
```

### Paso 3: Actualizar imports en backend
```bash
# Actualizar rutas relativas en archivos copiados
# Ejemplo: cambiar '../utils/agents' → './workflows'
```

### Paso 4: Crear package.json backend
```json
{
  "name": "dte-backend",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "jest"
  },
  "dependencies": {
    "@langchain/langgraph": "^1.1.4",
    "@langchain/core": "^1.1.25",
    "@supabase/supabase-js": "^2.x",
    "resend": "^3.x",
    "express": "^4.x",
    "cors": "^2.x",
    "helmet": "^7.x",
    "joi": "^17.x",
    "winston": "^3.x",
    "dotenv": "^16.x"
  },
  "devDependencies": {
    "@types/node": "^20.x",
    "@types/express": "^4.x",
    "typescript": "^5.x",
    "tsx": "^4.x",
    "jest": "^29.x",
    "@types/jest": "^29.x"
  }
}
```

### Paso 5: Configurar TypeScript
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "node",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

### Paso 6: Probar backend antes de eliminar
```bash
cd d:\proyectoBolt\dte-backend
npm install
npm run dev
# Probar que todo compile sin errores
```

### Paso 7: Eliminar del frontend (solo después de probar)
```bash
# Borrar carpetas movidas
rmdir /s /q d:\proyectoBolt\dte\utils\agents
rmdir /s /q d:\proyectoBolt\dte\utils\tax
rmdir /s /q d:\proyectoBolt\dte\utils\mh

# Borrar archivos movidos
del d:\proyectoBolt\dte\utils\dteGenerator.ts
del d:\proyectoBolt\dte\utils\firmaApiClient.ts
del d:\proyectoBolt\dte\utils\processor.ts
del d:\proyectoBolt\dte\utils\fieldMapping.ts
```

### Paso 8: Actualizar frontend
```bash
# Remover dependencias LangGraph del package.json frontend
npm uninstall @langchain/langgraph @langchain/core

# Actualizar imports en componentes que usaban los archivos movidos
# Cambiar llamadas directas a llamadas API al nuevo backend
```

## ⚠️ Precauciones

1. **Hacer backup** del proyecto completo antes de empezar
2. **Probar backend** completamente antes de eliminar del frontend
3. **Mantener git commits** pequeños y reversibles
4. **Documentar cambios** en README del frontend
5. **Testing gradual**: probar cada componente antes de siguiente

## 🎯 Resultado Esperado

**Frontend (ligero):**
- Solo UI y validaciones simples
- LangGraph liviano para heurísticas
- Llamadas API al backend

**Backend (potente):**
- Toda la lógica de negocio
- LangGraph workflow completo
- Integraciones con servicios externos

---

**¿Listo para empezar con la copia?**
