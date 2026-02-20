// Mapeo de códigos de error MH a mensajes amigables
export const MHErrorMapping = {
  // Errores de Acceso y Contraseña
  '100': {
    category: 'auth' as const,
    code: 'MH_AUTH_USER_INVALID',
    message: 'El nombre de usuario no existe en el sistema',
    userMessage: 'El nombre de usuario que escribiste no existe. Revisa que no tengas espacios extra o letras cambiadas.',
    canRetry: true,
    severity: 'error' as const
  },
  '103': {
    category: 'auth' as const,
    code: 'MH_AUTH_PASSWORD_EXPIRED',
    message: 'La contraseña ha expirado',
    userMessage: 'Tu clave de acceso ya venció. Debes actualizarla desde la Consola de Administración.',
    canRetry: false,
    severity: 'error' as const
  },
  '105': {
    category: 'auth' as const,
    code: 'MH_AUTH_PASSWORD_MISMATCH',
    message: 'Las contraseñas no coinciden',
    userMessage: 'Al cambiar tu clave, escribiste algo diferente en la confirmación. Escribe ambas con cuidado para que sean idénticas.',
    canRetry: true,
    severity: 'error' as const
  },
  '106': {
    category: 'auth' as const,
    code: 'MH_AUTH_CREDENTIALS_INVALID',
    message: 'Credenciales inválidas',
    userMessage: 'El usuario o la contraseña no coinciden. Verifica tus datos y recuerda que la contraseña debe tener entre 13 y 25 caracteres, incluyendo letras, números y un carácter especial.',
    canRetry: true,
    severity: 'error' as const
  },
  '107': {
    category: 'auth' as const,
    code: 'MH_AUTH_TOKEN_INVALID',
    message: 'Token inválido',
    userMessage: 'Tu "pase de entrada" digital falló. Tu sistema debe solicitar un nuevo token de seguridad.',
    canRetry: true,
    severity: 'error' as const
  },
  '108': {
    category: 'auth' as const,
    code: 'MH_AUTH_TOKEN_REQUIRED',
    message: 'Token requerido',
    userMessage: 'Tu "pase de entrada" digital ya caducó. Tu sistema debe solicitar un nuevo token de seguridad.',
    canRetry: true,
    severity: 'error' as const
  },

  // Errores en los Datos del Documento
  '003': {
    category: 'data' as const,
    code: 'MH_DATA_INVALID_VALUE',
    message: 'Valor no válido',
    userMessage: 'Pusiste un dato que el sistema no reconoce. Revisa que estés usando los códigos correctos (por ejemplo, el código de unidad de medida o de país).',
    canRetry: true,
    severity: 'error' as const
  },
  '004': {
    category: 'data' as const,
    code: 'MH_DATA_ALREADY_EXISTS',
    message: 'Registro ya existe',
    userMessage: 'Estás intentando enviar una factura con un número que ya habías enviado antes. Revisa tu correlativo; no puedes repetir números de control.',
    canRetry: false,
    severity: 'error' as const
  },
  '006': {
    category: 'data' as const,
    code: 'MH_DATA_INVALID_FORMAT',
    message: 'Formato no válido',
    userMessage: 'Algún dato, como el NIT o un correo, está mal escrito. Verifica que el NIT tenga 14 dígitos y los guiones correctos.',
    canRetry: true,
    severity: 'error' as const
  },
  '009': {
    category: 'data' as const,
    code: 'MH_DATA_NIT_NOT_EXISTS',
    message: 'NIT no existe',
    userMessage: 'El NIT que pusiste (ya sea el tuyo o el del cliente) no está registrado en el Ministerio de Hacienda. Pídele al cliente su tarjeta de NIT para confirmar el número.',
    canRetry: true,
    severity: 'error' as const
  },
  '010': {
    category: 'data' as const,
    code: 'MH_DATA_INACTIVE_TAXPAYER',
    message: 'Contribuyente no activo',
    userMessage: 'Tú o tu cliente aparecen como "no activos" para Hacienda. Debes revisar tu situación tributaria o la de tu cliente en el Ministerio.',
    canRetry: false,
    severity: 'error' as const
  },

  // Errores de Fechas y Cálculos
  '017': {
    category: 'date' as const,
    code: 'MH_DATE_INVALID',
    message: 'Fecha no es correcta',
    userMessage: 'Pusiste una fecha que no existe (ej. 30 de febrero). Corrige el calendario de tu documento.',
    canRetry: true,
    severity: 'error' as const
  },
  '018': {
    category: 'date' as const,
    code: 'MH_DATE_OUT_OF_DEADLINE',
    message: 'Fecha fuera de plazo',
    userMessage: 'Estás enviando el documento demasiado tarde. Normalmente solo tienes hasta el día siguiente de la venta para enviarlo.',
    canRetry: false,
    severity: 'warning' as const
  },
  '020': {
    category: 'calculation' as const,
    code: 'MH_CALCULATION_INCORRECT',
    message: 'Cálculo incorrecto',
    userMessage: 'Las sumas o el cálculo del IVA no cuadran con los precios que pusiste. Revisa tus sumas. Recuerda que el sistema permite una diferencia de apenas un centavo ($0.01).',
    canRetry: true,
    severity: 'error' as const
  },

  // Errores de Invalidación y Contingencia
  '012': {
    category: 'contingency' as const,
    code: 'MH_CONTINGENCY_NO_EVENT',
    message: 'No existe evento de contingencia',
    userMessage: 'Quieres enviar una factura "atrasada" por falta de internet, pero no has enviado primero el aviso de que tuviste problemas técnicos.',
    canRetry: false,
    severity: 'error' as const
  },
  '096': {
    category: 'technical' as const,
    code: 'MH_TECHNICAL_JSON_SCHEMA',
    message: 'No cumple esquema JSON',
    userMessage: 'El archivo digital que genera tu sistema está "roto" o mal construido. Esto es un problema técnico que debe revisar el encargado de tu sistema.',
    canRetry: false,
    severity: 'error' as const
  },

  // Caso especial - Observaciones (no es error)
  '002': {
    category: 'warning' as const,
    code: 'MH_RECEIVED_WITH_OBSERVATIONS',
    message: 'Recibido con observaciones',
    userMessage: '¡Hacienda aceptó tu documento y es válido! Solo encontró un pequeño detalle que debes corregir en el futuro (como un cálculo redondeado), pero no detuvo tu venta.',
    canRetry: false,
    severity: 'success' as const
  }
};

export interface MHErrorResponse {
  category: 'auth' | 'data' | 'date' | 'calculation' | 'contingency' | 'technical' | 'warning';
  code: string;
  message: string;        // Mensaje técnico
  userMessage: string;    // Mensaje amigable para usuario
  canRetry: boolean;     // Si el usuario puede reintentar
  severity: 'error' | 'warning' | 'success';
}

// Función para mapear errores de MH
export const mapMHError = (errorCode: number | string): MHErrorResponse | null => {
  const error = MHErrorMapping[errorCode as keyof typeof MHErrorMapping];
  
  if (!error) {
    // Error no conocido
    return {
      category: 'technical' as const,
      code: 'MH_UNKNOWN_ERROR',
      message: `Error desconocido: ${errorCode}`,
      userMessage: 'Ocurrió un error inesperado. Por favor, intenta nuevamente o contacta a soporte técnico.',
      canRetry: true,
      severity: 'error' as const
    };
  }
  
  return error;
};

// Función para procesar respuesta de MH y extraer errores
export const processMHResponse = (mhResponse: any): {
  success: boolean;
  errors?: MHErrorResponse[];
  warnings?: MHErrorResponse[];
  observations?: MHErrorResponse;
} => {
  if (mhResponse.success) {
    return { success: true };
  }

  const errors: MHErrorResponse[] = [];
  const warnings: MHErrorResponse[] = [];
  let observations: MHErrorResponse | undefined;

  // Procesar errores de la respuesta
  if (mhResponse.errores) {
    mhResponse.errores.forEach((error: any) => {
      const mappedError = mapMHError(error.codigo);
      
      if (mappedError) {
        if (mappedError.severity === 'error') {
          errors.push(mappedError);
        } else if (mappedError.severity === 'warning') {
          warnings.push(mappedError);
        } else if (mappedError.code === 'MH_RECEIVED_WITH_OBSERVATIONS') {
          observations = mappedError;
        }
      }
    });
  }

  return {
    success: false,
    errors: errors.length > 0 ? errors : undefined,
    warnings: warnings.length > 0 ? warnings : undefined,
    observations
  };
};
