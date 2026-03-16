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
- Vista detalle:
  - JSON emitido
  - respuesta MH
  - sello
  - correo enviado
  - errores

## 4. Administración de negocios

- Listado de negocios.
- Estado de licencia.
- Estado de credenciales MH.
- Estado de certificado.
- Ambiente habilitado.
- Activar/desactivar negocio.

## 5. Administración de planes y features

- Planes sugeridos:
  - `tabas`
  - `negocio`
  - `profesional`
- Cada plan debe mapearse a features explícitas, por ejemplo:
  - emisión DTE
  - contingencia
  - correo automático
  - multiusuario
  - reportes
  - múltiples sucursales
- No hardcodear reglas en frontend.
- Guardar catálogo de planes/features en tablas propias o config versionada.

## 6. Auditoría

- Registro de:
  - login
  - cambios de licencia
  - cambios de negocio
  - reintentos de emisión
  - errores críticos

# Diseño de datos recomendado

Crear o validar estas entidades:

1. `businesses`
2. `business_users`
3. `plans`
4. `plan_features`
5. `business_subscriptions`
6. `feature_flags`
7. `audit_logs`
8. `admin_profiles`

Si alguna ya existe, reutilizarla. No duplicar estructura.

# Seguridad

- Nunca exponer credenciales MH ni certificados al frontend.
- Toda edición sensible debe pasar por backend o RPC segura.
- Aplicar RLS en Supabase.
- Separar vistas de lectura administrativa de tablas operativas crudas.

# Entregables del proyecto

1. Dashboard admin web.
2. Gestión de negocios y licencias.
3. Explorador de DTEs y respuestas MH.
4. Feature flags y planes.
5. Auditoría.
6. Manual de despliegue.

# Orden de ejecución recomendado

1. Modelar roles, permisos y vistas seguras.
2. Construir autenticación admin.
3. Construir explorador de DTEs.
4. Construir módulo de negocios/licencias.
5. Construir módulo de planes/features.
6. Construir dashboard y auditoría.
