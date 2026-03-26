import { DTEState } from '../state';
import { createLogger } from '../../utils/logger';
import { supabase } from '../../database/supabase';
import { generarNumeroControl } from '../../dte/generator';

const logger = createLogger('reserveControlNumberNode');

export const reserveControlNumberNode = async (state: DTEState): Promise<Partial<DTEState>> => {
  const dteBase = state.preparedDte || state.dte;
  const forceReserve = !!state.forceReserveControlNumber;

  if (!dteBase) {
    return {
      status: 'failed',
      errorCode: 'CONTROL_NUMBER_NO_DTE',
      errorMessage: 'No hay DTE en el estado para reservar número de control',
      canRetry: false,
      currentStep: 'reserve_control_number',
    };
  }

  const flowType = state.flowType || 'emission';
  if (flowType !== 'emission') {
    return {
      currentStep: 'reserve_control_number',
    };
  }

  const existing = (dteBase as any)?.identificacion?.numeroControl;
  if (!forceReserve && typeof existing === 'string' && existing.trim().length > 0) {
    return {
      currentStep: 'reserve_control_number',
    };
  }

  const businessId = state.businessId;
  if (!businessId) {
    return {
      status: 'failed',
      errorCode: 'CONTROL_NUMBER_NO_BUSINESS',
      errorMessage: 'No se pudo determinar el businessId para reservar el correlativo',
      canRetry: false,
      currentStep: 'reserve_control_number',
    };
  }

  try {
    const tipoDte = ((dteBase as any)?.identificacion?.tipoDte || '01').toString().trim();

    const { data, error } = await supabase
      .rpc('reserve_dte_correlativo', { p_business_id: businessId })
      .single();

    if (error) {
      logger.error('Error reservando correlativo en Supabase', { businessId, error: error.message });
      return {
        status: 'failed',
        errorCode: 'CONTROL_NUMBER_RESERVE_FAILED',
        errorMessage: 'No se pudo reservar el número de control. Intenta nuevamente.',
        canRetry: true,
        currentStep: 'reserve_control_number',
      };
    }

    const reserveResult = data as any;
    const correlativo = Number(reserveResult?.correlativo);
    if (!Number.isFinite(correlativo) || correlativo <= 0) {
      logger.error('Correlativo inválido recibido desde Supabase', { businessId, correlativo: reserveResult?.correlativo });
      return {
        status: 'failed',
        errorCode: 'CONTROL_NUMBER_INVALID_SEQUENCE',
        errorMessage: 'No se pudo generar el número de control por un correlativo inválido',
        canRetry: true,
        currentStep: 'reserve_control_number',
      };
    }

    const numeroControl = generarNumeroControl(
      tipoDte,
      correlativo,
      reserveResult?.cod_estable_mh ?? null,
      reserveResult?.cod_punto_venta_mh ?? null
    );

    const updatedDte = {
      ...dteBase,
      identificacion: {
        ...(dteBase as any).identificacion,
        numeroControl,
      },
    };

    logger.info('Número de control reservado', {
      businessId,
      tipoDte,
      correlativo,
      numeroControl,
      codigoGeneracion: updatedDte?.identificacion?.codigoGeneracion,
    });

    return {
      dte: updatedDte,
      preparedDte: updatedDte,
      reservedCorrelativo: correlativo,
      reservedNumeroControl: numeroControl,
      forceReserveControlNumber: false,
      controlNumberRetryCount: state.controlNumberRetryCount || 0,
      status: 'signing',
      currentStep: 'reserve_control_number',
    };
  } catch (e: any) {
    logger.error('Excepción reservando número de control', { businessId, error: e?.message });
    return {
      status: 'failed',
      errorCode: 'CONTROL_NUMBER_UNEXPECTED',
      errorMessage: 'Error interno reservando el número de control',
      canRetry: true,
      currentStep: 'reserve_control_number',
    };
  }
};
