# Configurar Contraseña API para MH

## Paso 1: Guardar la contraseña API

Usa este endpoint para guardar la contraseña de acceso API en Supabase:

```bash
curl -X POST http://localhost:3002/api/business/credentials \
  -H "Content-Type: application/json" \
  -H "x-business-id: 14012805761025" \
  -d '{
    "nit": "14012805761025",
    "ambiente": "00",
    "apiPassword": "Factura#Punto2025"
  }'
```

## Paso 2: Verificar que se guardó

```sql
SELECT nit, api_password, api_token, updated_at 
FROM mh_credentials 
WHERE nit = '14012805761025' AND ambiente = '00';
```

## Paso 3: Probar transmisión

Ahora puedes enviar un DTE. El sistema:
1. Usará la contraseña API para obtener un token si no existe o está vencido
2. Guardará el token en `api_token` como `Bearer eyJ...`
3. Lo usará en el header `Authorization` de la transmisión

## Token actual (válido por ~48 horas)

```
Bearer eyJhbGciOiJIUzUxMiJ9.eyJzdWIiOiIxNDAxMjgwNTc2MTAyNSIsImF1dGhvcml0aWVzIjpbIlVTRVIiLCJVU0VSX0FQSSIsIlVTRVJfV0VCIiwiVXN1YXJpbyJdLCJjX25pdCI6IjE0MDEyODA1NzYxMDI1IiwiY19kdWkiOiIwMjQ1MzA5OTYiLCJpYXQiOjE3NzE3MzAyNDAsImV4cCI6MTc3MTgxNjY0MH0.a0uLwVWQWnO3j90qHa_z4Ompssx1WOyjwWMJWWCKqgkTlujzqPZrCnhcI4zy8EsNmaGmJbB99CDWSrzs6_47NA
```
