---
description: crear un proyecto móvil Android para facturación DTE consumiendo api-dte y manteniendo compatibilidad con el frontend actual
---

# Objetivo

Crear una app Android para emitir DTE usando el backend `api-dte`, sin reemplazar el frontend React actual.

La app debe permitir:

1. autenticación del negocio o usuario autorizado
2. captura de datos de factura
3. emisión de DTE
4. consulta de estado
5. historial de documentos
6. operación tolerante a conectividad móvil

# Contexto real del backend y Supabase que debes respetar

El backend `api-dte` ya usa Supabase y ya existe un modelo real que la app debe respetar.

Asume como base:

1. `businesses`
2. `business_users`
3. `business_settings`
4. `mh_credentials`
5. `dte_documents`
6. `dte_responses`
7. `tax_accumulators`

La app Android no debe inventar un modelo alterno para negocio, usuario o historial documental.

Debes considerar que:

1. el negocio tiene identidad fiscal y operativa en `businesses`
2. el usuario se vincula al negocio mediante `business_users`
3. la configuración funcional del negocio está en `business_settings`
4. el historial documental y resultados operativos existen en `dte_documents` y `dte_responses`
5. las credenciales MH son administradas por backend/Supabase y no deben exponerse a móvil

# Instrucción para el LLM que construirá el proyecto

Trata este documento como especificación inicial del producto. Debes:

1. crear una app Android mantenible
2. priorizar `01` en la primera entrega
3. usar `api-dte` como backend oficial
4. no mover firma ni lógica MH al dispositivo
5. no improvisar contratos si backend no los define
6. dejar preparada la base para `03` sin implementarlo a medias
7. asumir que la app debe convivir con autenticación, negocio y configuración ya existentes

# Recomendación tecnológica

La opción más profesional para Android puro es:

1. `Kotlin`
2. `Jetpack Compose`
3. `Retrofit`
4. `Room`
5. `WorkManager`
6. `Hilt`

Si se prioriza compartir lógica con el frontend web, evaluar después:

1. `React Native`
2. `Expo`

Pero mi recomendación inicial es `Kotlin + Compose` si de verdad quieres una APK sólida Android.

# Principios de integración

- La app **no** debe firmar localmente.
- La app **no** debe hablar directo con MH.
- La app debe usar `api-dte` como backend orquestador.
- La app debe manejar payload de entrada y mostrar resultado del flujo.

# Módulos mínimos

## 1. Autenticación

- Login seguro.
- Persistencia de sesión.
- Recuperación de negocio/NIT asociado.
- Resolver el contexto del negocio usando `business_users`.
- Cargar configuración operativa desde `business_settings`.

## 2. Catálogos

- Productos/servicios.
- Clientes frecuentes.
- Formas de pago.
- Sucursales / puntos de venta si aplica.

Si esos catálogos aún no existen de forma oficial en backend o Supabase, no inventarlos como fuente maestra persistente sin antes definir su contrato.

## 3. Emisión DTE

- Captura de datos para `01` primero.
- Cálculo local visual de totales.
- Validación previa UX.
- Envío del JSON a `api-dte`.
- Presentación de:
  - validación
  - firma
  - transmisión
  - sello
  - errores

La app debe usar el contexto del negocio para:

1. mostrar datos del emisor desde `businesses`
2. respetar toggles o features desde `business_settings`
3. mostrar restricciones funcionales según plan o configuración activa

## 4. Historial

- Lista de documentos emitidos.
- Filtros por fecha, tipo, estado.
- Vista detalle del documento y respuesta MH.
- Mostrar cuando exista:
  - `codigo_generacion`
  - `numero_control`
  - `tipo_dte`
  - `estado`
  - `sello_recibido`
  - `correo_enviado`
  - `pdf_url`
  - `json_url`
  - `xml_url`
- El historial debe poder construirse desde `dte_documents`, `dte_responses` o desde un endpoint consolidado.

## 5. Operación offline parcial

- Guardar borradores localmente.
- Encolar reintentos con `WorkManager`.
- Sin inventar una lógica paralela a la de contingencia del backend.

Los borradores locales no deben considerarse documentos oficiales hasta que el backend los procese.

# Alcance recomendado por fases

## Fase 1

- Login
- emisión `01`
- historial básico
- detalle de documento

## Fase 2

- clientes/productos
- borradores locales
- reintento automático

## Fase 3

- soporte `03`
- reportes básicos
- impresión o compartir PDF

# UX mínima recomendada

- flujo simple en 4 pasos:
  - receptor
  - items
  - resumen
  - emitir
- mostrar claramente:
  - estado del envío
  - sello recibido
  - errores de validación
  - errores MH

# Seguridad

- No guardar certificados ni secretos MH en la app.
- No hardcodear URLs ni keys.
- Usar variables de entorno y configuración por build flavor.
- Si hay token Bearer, usar storage seguro.

# Integración con backend

La app debe usar endpoints del backend para:

1. validar
2. firmar/transmitir por flujo completo
3. consultar historial
4. consultar detalle por `codigoGeneracion`
5. consultar negocio actual y configuración funcional
6. consultar estado operativo del contexto del usuario

Si hoy esos endpoints no están pensados para móvil, crear una capa de API estable antes de arrancar el cliente Android.

La app no debe consultar directamente tablas sensibles como `mh_credentials`.

# Entregables

1. APK Android funcional.
2. Proyecto Android mantenible.
3. Cliente API tipado.
4. Soporte inicial a `01`.
5. Manual de publicación interna.
6. Propuesta explícita de contrato API móvil contra `api-dte`.

# Criterios de aceptación

1. El usuario puede autenticarse y emitir `01`.
2. La app muestra estado del procesamiento y sello cuando exista.
3. La app permite consultar historial y detalle.
4. La app no almacena secretos sensibles del backend o MH.
5. La arquitectura permite crecer luego a `03` sin rehacer la app.
6. La app reutiliza el contexto real de negocio/usuario/configuración ya existente en backend y Supabase.

# Orden recomendado

1. Definir contrato de API móvil.
2. Diseñar auth y sesión.
3. Construir emisión `01`.
4. Construir historial.
5. Agregar borradores y reintentos.
6. Extender a otros DTE.
