# API Endpoints - Historial y Resumen de DTEs

## 1. Listado de DTEs (Historial)

**Endpoint:** `GET /api/dte/business/{businessId}/dtes`

**Autenticación:** Bearer token requerido

**Parámetros Query:**
```typescript
{
  search?: string;        // Búsqueda por nombre o NIT del receptor
  fechaDesde?: string;    // Formato: YYYY-MM-DD
  fechaHasta?: string;    // Formato: YYYY-MM-DD
  tipo?: string;         // Tipo de DTE: "01", "03", etc.
  estado?: string;       // Estado: "PROCESADO", "RECHAZADO", "PENDIENTE", etc.
  limit?: number;        // Límite de resultados (default: 50)
  offset?: number;       // Paginación (default: 0)
}
```

**Respuesta:**
```json
{
  "businessId": "uuid-del-negocio",
  "dtes": [
    {
      "codigoGeneracion": "12345678-1234-1234-1234-123456789012",
      "tipoDte": "01",
      "numeroControl": "DTE-01-00000001",
      "estado": "PROCESADO",
      "claseDocumento": "FACTURA",
      "createdAt": "2024-03-23T10:30:00.000Z",
      "updatedAt": "2024-03-23T10:32:15.000Z",
      "montoTotal": 125.50,
      "receptorNombre": "JUAN PEREZ",
      "receptorNit": "12345678-9",
      "selloRecibido": "ABC123...",
      "fhProcesamiento": "2024-03-23T10:32:00.000Z",
      "tienePdf": true,
      "tieneXml": true,
      "tieneJson": true
    }
  ],
  "total": 1,
  "pagination": {
    "limit": 50,
    "offset": 0,
    "hasMore": false
  }
}
```

## 2. Resumen de Ventas

**Endpoint:** `GET /api/dte/business/{businessId}/resumen`

**Autenticación:** Bearer token requerido

**Parámetros Query:**
```typescript
{
  fechaDesde: string;      // Requerido. Formato: YYYY-MM-DD
  fechaHasta: string;      // Requerido. Formato: YYYY-MM-DD
  tipoDte?: string;        // Opcional. "01", "03", etc.
}
```

**Respuesta:**
```json
{
  "businessId": "uuid-del-negocio",
  "periodo": {
    "fechaDesde": "2024-03-23",
    "fechaHasta": "2024-03-23"
  },
  "resumen": {
    "totalVentas": 1250.75,
    "totalIva": 200.12,
    "totalGravada": 1050.63,
    "totalExenta": 0,
    "totalNoSuj": 0,
    "cantidadDocumentos": 10,
    "detallePorTipo": {
      "01": {
        "cantidad": 7,
        "total": 875.50
      },
      "03": {
        "cantidad": 3,
        "total": 375.25
      }
    }
  }
}
```

## Ejemplos de uso

### Obtener historial del día
```javascript
GET /api/dte/business/{businessId}/dtes?fechaDesde=2024-03-23&fechaHasta=2024-03-23&limit=100
```

### Buscar por nombre de receptor
```javascript
GET /api/dte/business/{businessId}/dtes?search=JUAN%20PEREZ
```

### Obtener resumen de ventas del mes
```javascript
GET /api/dte/business/{businessId}/resumen?fechaDesde=2024-03-01&fechaHasta=2024-03-31
```

### Resumen de facturas de consumidor final (tipo 01)
```javascript
GET /api/dte/business/{businessId}/resumen?fechaDesde=2024-03-01&fechaHasta=2024-03-31&tipoDte=01
```

## Notas importantes

- Todos los montos vienen redondeados a 2 decimales
- Las fechas deben estar en formato YYYY-MM-DD
- El parámetro `search` busca en nombre y NIT del receptor (case insensitive)
- Para paginar, usa `limit` y `offset`
- El campo `hasMore` en la respuesta indica si hay más resultados disponibles
