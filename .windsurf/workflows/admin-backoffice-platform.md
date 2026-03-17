---
description: crear un proyecto administrador para operar el backend api-dte y consultar Supabase por negocio, usuario y documentos
---

# Objetivo

Construir una plataforma administrativa separada del backend `api-dte` para:

1. Consultar facturas/DTE generados y almacenados en Supabase.
2. Filtrar por negocio, NIT, ambiente, tipo DTE, estado, fechas y usuario.
3. Administrar configuración operativa y comercial:
   - negocios
   - licencias
   - planes
   - features habilitadas
   - estados de integración
4. Auditar actividad operativa del sistema.

# Contexto real del backend y Supabase que debes respetar

El proyecto `api-dte` ya persiste y consulta información en Supabase. Antes de inventar nuevas tablas o módulos, asume como base mínima existente:

1. `businesses`
2. `business_users`
3. `business_settings`
4. `platform_admins`
5. `mh_credentials`
6. `dte_documents`
7. `dte_responses`
8. `tax_accumulators`
9. `push_subscriptions`
10. `push_logs`
11. `debug_signed_dte`

Debes diseñar la plataforma administrativa para apoyarse primero en estas entidades reales.

No dupliques lo que ya existe en Supabase.

Debes considerar especialmente que:

1. `businesses` guarda identidad fiscal y operativa del negocio:
   - NIT
   - NRC
   - nombre
   - nombre comercial
   - actividad económica
   - establecimiento
   - punto de venta
   - correlativo DTE
2. `business_users` enlaza usuarios con negocios y maneja roles como:
   - `owner`
   - `admin`
   - `operator`
3. `business_settings` ya guarda configuración funcional del negocio:
   - `default_tab`
   - `features`
   - `push_enabled`
   - `fingerprint_enabled`
   - `advanced_config_enabled`
   - `plan_code`
   - `plan_label`
4. `mh_credentials` contiene información sensible y estado operativo con MH:
   - NIT
   - NRC
   - ambiente
   - token MH
   - expiración de token
   - password API
   - certificado
5. `dte_documents` y `dte_responses` contienen el historial documental y el resultado operativo:
   - `codigo_generacion`
   - `numero_control`
   - `tipo_dte`
   - `estado`
   - `dte_json`
   - `mh_response`
   - `sello_recibido`
   - `pdf_url`
   - `json_url`
   - `correo_enviado`
   - `correo_error`
6. `tax_accumulators` sirve para reportes y agregados por período
7. `platform_admins` ya define administradores de plataforma

El sistema administrativo debe proponer primero vistas, RPCs seguras o endpoints de backend para explotar estas tablas, antes de proponer nuevas estructuras.

# Instrucción para el LLM que construirá el proyecto

Trata este documento como especificación inicial del producto. Debes:

1. crear el proyecto desde cero
2. proponer una arquitectura mantenible
3. dejarlo ejecutable
4. evitar mocks innecesarios
5. reutilizar estructura existente de Supabase cuando ya exista
6. pedir aclaración sólo cuando falte un dato realmente bloqueante

# Recomendación tecnológica

Usar:

1. `Next.js`
2. `TypeScript`
3. `Tailwind CSS`
4. `shadcn/ui`
5. `Supabase`
6. `TanStack Query`

Evitar acceso directo irrestricto desde frontend a tablas sensibles. La app debe consumir:

1. vistas seguras de Supabase
2. RPCs controladas
3. endpoints admin del backend cuando aplique

# Módulos mínimos

## 1. Autenticación y autorización

- Login con Supabase Auth.
- Roles mínimos:
  - `super_admin`
  - `support`
  - `sales_admin`
  - `business_admin`
- Protección por rutas y permisos por módulo.

## 2. Dashboard operativo

- KPIs por rango de fecha:
  - DTE emitidos
  - DTE rechazados
  - DTE en contingencia
  - DTE por tipo (`01`, `03`, etc.)
  - tasa de éxito por negocio
- DTE con correo fallido
- DTE sin `pdf_url`
- negocios con credenciales MH incompletas
- negocios con token MH expirado o próximo a vencer
- Tabla de actividad reciente.

## 3. Explorador de DTEs

- Búsqueda por:
  - `codigoGeneracion`
  - `numeroControl`
  - `businessId`
  - `nit`
- Filtros por:
  - ambiente
  - tipoDte
  - fecha
  - estado
- correo enviado / con error
- negocio activo / configuración incompleta
- Vista detalle:
  - JSON emitido
  - respuesta MH
  - sello
  - correo enviado
  - errores
  - links a `pdf_url`, `json_url`, `xml_url` si existen
  - identificación del negocio
  - estado operativo del documento

Debe poder consultar tanto desde `dte_documents` como desde `dte_responses`, o desde una vista consolidada que unifique ambos conceptos:

1. documento emitido
2. respuesta MH
3. estado final
4. artefactos generados
5. resultado del correo

## 4. Administración de negocios

- Listado de negocios.
- Estado de licencia.
- Estado de credenciales MH.
- Estado de certificado.
- Ambiente habilitado.
- Activar/desactivar negocio.
- Editar `business_settings`.
- Editar:
  - `default_tab`
  - `features`
  - `push_enabled`
  - `fingerprint_enabled`
  - `advanced_config_enabled`
  - `plan_code`
  - `plan_label`
- Ver correlativo DTE actual.
- Ver usuarios asociados por negocio.
- Ver estado de configuración MH por negocio sin exponer secretos en claro.

## 5. Administración de planes y features

La propuesta debe partir de que hoy ya existen campos funcionales en `business_settings`.

Primero debes modelar cómo administrar correctamente:

1. `plan_code`
2. `plan_label`
3. `features` como JSON versionable
4. toggles funcionales ya existentes

Después, solo si hace falta de verdad, proponer nuevas tablas para catálogo formal de planes/features.

No hardcodear reglas en frontend.

## 6. Auditoría

- Registro de:
  - login
  - cambios de licencia
  - cambios de negocio
  - reintentos de emisión
  - errores críticos
  - cambios de `business_settings`
  - altas/bajas de usuarios administrativos
  - cambios de estado de credenciales MH
  - acciones manuales sobre notificaciones push

# Diseño de datos recomendado

Debes reutilizar primero:

1. `businesses`
2. `business_users`
3. `business_settings`
4. `platform_admins`
5. `mh_credentials`
6. `dte_documents`
7. `dte_responses`
8. `tax_accumulators`
9. `push_subscriptions`
10. `push_logs`

Solo si el diseño lo exige, proponer adicionalmente:

1. vistas seguras para exploración administrativa
2. RPCs para operaciones sensibles
3. `audit_logs`
4. tablas de catálogo de planes/features si `business_settings` ya no alcanza

No crear duplicados funcionales de documentos, negocios o usuarios.

# Seguridad

- Nunca exponer credenciales MH ni certificados al frontend.
- Toda edición sensible debe pasar por backend o RPC segura.
- Aplicar RLS en Supabase.
- Separar vistas de lectura administrativa de tablas operativas crudas.
- `mh_credentials` debe tratarse como fuente sensible:
  - no mostrar `api_password`
  - no mostrar certificado en claro
  - no mostrar token completo
  - solo mostrar estado, ambiente, vigencia y banderas de salud

# Entregables del proyecto

1. Dashboard admin web.
2. Gestión de negocios y licencias.
3. Explorador de DTEs y respuestas MH.
4. Feature flags y planes.
5. Auditoría.
6. Manual de despliegue.
7. Propuesta clara de vistas/RPCs/endpoints necesarios para operar sobre Supabase sin romper seguridad.

# Criterios de aceptación

1. Un administrador puede consultar DTEs por negocio, NIT, estado y fecha.
2. Un administrador puede ver detalle técnico y de negocio del DTE.
3. Un administrador puede administrar negocios, planes y features según permisos.
4. Toda operación sensible queda auditada.
5. No se exponen secretos, certificados ni credenciales MH al frontend.
6. El proyecto reutiliza el modelo real ya existente en Supabase antes de crear nuevas tablas.
7. La plataforma permite gestionar configuración por negocio desde `business_settings`.

# Orden de ejecución recomendado

1. Modelar roles, permisos y vistas seguras.
2. Construir autenticación admin.
3. Construir explorador de DTEs.
4. Construir módulo de negocios/licencias.
5. Construir módulo de planes/features.
6. Construir dashboard y auditoría.
