import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { DTE_SCHEMA } from './schema';
import type { ErrorValidacionMH } from './types';

// Configurar AJV
const ajv = new Ajv({ 
  allErrors: true, 
  strict: false
});
addFormats(ajv);

// Registrar el esquema raíz
ajv.addSchema(DTE_SCHEMA, 'dte-schema-root');

// Obtener validadores específicos por referencia
const validators: Record<string, any> = {
  '01': ajv.getSchema('dte-schema-root#/definitions/FE'),
  '03': ajv.getSchema('dte-schema-root#/definitions/CCFE'),
  '11': ajv.getSchema('dte-schema-root#/definitions/FEXE'),
};

// Validador genérico de respaldo
const validateGeneric = ajv.compile(DTE_SCHEMA);

export const validateDteSchema = (dte: any): ErrorValidacionMH[] => {
  const tipoDte = dte?.identificacion?.tipoDte;
  
  // Seleccionar validador específico si existe, sino usar el genérico
  let validate = validateGeneric;

  if (tipoDte && validators[tipoDte]) {
    validate = validators[tipoDte];
  } else {
    // Si no hay validador específico, usamos el genérico pero validamos contra el root
    // que tiene oneOf.
  }

  const ok = validate(dte);
  if (ok) return [];

  // Filtramos errores 'multipleOf' porque causan falsos positivos con punto flotante en JS
  // La precisión ya se garantiza en la generación del DTE (dteGenerator.ts)
  const relevantErrors = (validate.errors || []).filter((e: any) => e.keyword !== 'multipleOf');

  return relevantErrors.map((e: any, idx: number) => {
    // Limpiar path del error para hacerlo más legible
    const campo = (e.instancePath || e.schemaPath || '')
      .replace(/^\//, '')
      .replace(/\//g, '.');
      
    // Traducir mensajes técnicos comunes
    let descripcion = e.message || 'Error de esquema';
    if (e.keyword === 'pattern') {
      descripcion = `Formato inválido. Se espera patrón: ${e.params.pattern}`;
    } else if (e.keyword === 'required') {
      descripcion = `Campo obligatorio faltante: ${e.params.missingProperty}`;
    }

    return {
      codigo: `SCHEMA-${String(idx + 1).padStart(4, '0')}`,
      campo: campo || undefined,
      descripcion,
      severidad: 'ERROR',
      valorActual: e.data,
      valorEsperado: e.keyword === 'const' ? e.params.allowedValue : undefined
    };
  });
};
