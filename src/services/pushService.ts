import webpush from 'web-push';
import { createLogger } from '../utils/logger';
import { supabase } from '../database/supabase';

const logger = createLogger('pushService');

const publicVapidKey = process.env.VAPID_PUBLIC_KEY;
const privateVapidKey = process.env.VAPID_PRIVATE_KEY;
const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:soporte@rogelioguerrero.com';

let pushEnabled = true;

if (!publicVapidKey || !privateVapidKey) {
  pushEnabled = false;
  logger.warn('Push deshabilitado: faltan VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY');
} else {
  try {
    webpush.setVapidDetails(vapidSubject, publicVapidKey, privateVapidKey);
  } catch (err: any) {
    pushEnabled = false;
    logger.warn('Push deshabilitado: VAPID keys inválidas', { error: err?.message });
  }
}

export interface PushSubscription {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export interface PushMessage {
  title: string;
  body: string;
  url?: string;
  icon?: string;
  badge?: string;
}

export interface BroadcastRequest {
  title: string;
  body: string;
  url?: string;
  target: 'all' | string[];
}

export interface StoredPushSubscription {
  id: string;
  business_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  user_agent?: string | null;
  disabled: boolean;
  last_sent_at?: string | null;
  last_error?: string | null;
  created_at?: string;
  updated_at?: string;
}

const toWebPushSubscription = (subscription: StoredPushSubscription): PushSubscription => ({
  endpoint: subscription.endpoint,
  keys: {
    p256dh: subscription.p256dh,
    auth: subscription.auth,
  },
});

export const isPushConfigured = (): boolean => pushEnabled;

export const savePushSubscriptionForBusiness = async (
  businessId: string,
  subscription: PushSubscription,
  userAgent?: string
): Promise<StoredPushSubscription> => {
  try {
    const { data, error } = await supabase
      .from('push_subscriptions')
      .upsert(
        {
          business_id: businessId,
          endpoint: subscription.endpoint,
          p256dh: subscription.keys.p256dh,
          auth: subscription.keys.auth,
          user_agent: userAgent,
          disabled: false,
          last_error: null,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'business_id,endpoint',
        }
      )
      .select('*')
      .single();

    if (error) throw error;

    logger.info('Suscripción push guardada para business', { businessId, endpoint: subscription.endpoint });
    return data as StoredPushSubscription;
  } catch (error: any) {
    logger.error('Error guardando suscripción push para business', { businessId, error: error.message });
    throw error;
  }
};

export const removePushSubscriptionForBusiness = async (
  businessId: string,
  endpoint?: string
): Promise<number> => {
  try {
    let query = supabase
      .from('push_subscriptions')
      .delete()
      .eq('business_id', businessId);

    if (endpoint) {
      query = query.eq('endpoint', endpoint);
    }

    const { data, error } = await query.select('id');

    if (error) throw error;

    const removedCount = (data || []).length;
    logger.info('Suscripción push eliminada para business', { businessId, endpoint: endpoint || null, removedCount });
    return removedCount;
  } catch (error: any) {
    logger.error('Error eliminando suscripción push para business', { businessId, error: error.message });
    throw error;
  }
};

export const listActivePushSubscriptionsByBusiness = async (
  businessId: string
): Promise<StoredPushSubscription[]> => {
  try {
    const { data, error } = await supabase
      .from('push_subscriptions')
      .select('*')
      .eq('business_id', businessId)
      .eq('disabled', false)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []) as StoredPushSubscription[];
  } catch (error: any) {
    logger.error('Error obteniendo suscripciones push activas', { businessId, error: error.message });
    throw error;
  }
};

export const markPushSubscriptionResult = async (
  subscriptionId: string,
  payload: {
    disabled: boolean;
    last_error: string | null;
    last_sent_at?: string | null;
  }
): Promise<void> => {
  try {
    const updatePayload: Record<string, any> = {
      disabled: payload.disabled,
      last_error: payload.last_error,
      updated_at: new Date().toISOString(),
    };

    if (payload.last_sent_at !== undefined) {
      updatePayload.last_sent_at = payload.last_sent_at;
    }

    const { error } = await supabase
      .from('push_subscriptions')
      .update(updatePayload)
      .eq('id', subscriptionId);

    if (error) throw error;

    logger.info('Estado de suscripción push actualizado', { subscriptionId, disabled: payload.disabled });
  } catch (error: any) {
    logger.error('Error actualizando estado de suscripción push', { subscriptionId, error: error.message });
    throw error;
  }
};

export const sendPushNotification = async (
  subscription: StoredPushSubscription,
  message: PushMessage
): Promise<boolean> => {
  try {
    if (!pushEnabled) {
      logger.warn('Push deshabilitado: no se envía notificación');
      await markPushSubscriptionResult(subscription.id, {
        disabled: subscription.disabled,
        last_error: 'Push no configurado en backend',
      });
      return false;
    }

    const payload = JSON.stringify({
      title: message.title,
      body: message.body,
      url: message.url || '/',
      icon: message.icon || '/icon-192x192.png',
      badge: message.badge || '/badge-72x72.png'
    });

    await webpush.sendNotification(toWebPushSubscription(subscription), payload);
    await markPushSubscriptionResult(subscription.id, {
      disabled: false,
      last_error: null,
      last_sent_at: new Date().toISOString(),
    });

    logger.info('Push notification enviada exitosamente', { subscriptionId: subscription.id, endpoint: subscription.endpoint });
    return true;
  } catch (error: any) {
    const statusCode = error?.statusCode;
    const isExpired = statusCode === 404 || statusCode === 410;
    const errorMessage =
      typeof error?.body === 'string'
        ? error.body
        : error?.message || 'Error enviando push notification';

    await markPushSubscriptionResult(subscription.id, {
      disabled: isExpired,
      last_error: errorMessage,
    });

    logger.error('Error enviando push notification', {
      subscriptionId: subscription.id,
      endpoint: subscription.endpoint,
      statusCode,
      error: error?.message,
    });

    return false;
  }
};

export const sendPushTestToBusiness = async (
  businessId: string,
  message: PushMessage
): Promise<{ sent: number; failed: number; total: number }> => {
  const subscriptions = await listActivePushSubscriptionsByBusiness(businessId);
  const results = await Promise.allSettled(
    subscriptions.map((subscription) => sendPushNotification(subscription, message))
  );

  const sent = results.filter((result) => result.status === 'fulfilled' && result.value).length;
  const failed = results.length - sent;

  logger.info('Prueba push completada', { businessId, sent, failed, total: results.length });
  return { sent, failed, total: results.length };
};

interface PushLogData {
  title: string;
  body: string;
  targetType: string;
  targetIds: string[] | null;
  sentCount: number;
  adminId: string;
}

const savePushLog = async (data: PushLogData): Promise<void> => {
  try {
    const { error } = await supabase
      .from('push_logs')
      .insert({
        title: data.title,
        body: data.body,
        target_type: data.targetType,
        target_ids: data.targetIds,
        sent_count: data.sentCount,
        admin_id: data.adminId
      });

    if (error) throw error;

    logger.info('Log de push guardado', { title: data.title, sentCount: data.sentCount });
  } catch (error: any) {
    logger.error('Error guardando log de push', { error: error.message });
    throw error;
  }
};

export const broadcastMessage = async (
  request: BroadcastRequest,
  adminId: string
): Promise<{ sent: number; failed: number; total: number }> => {
  try {
    if (!pushEnabled) {
      logger.warn('Push deshabilitado: broadcast omitido');
      return { sent: 0, failed: 0, total: 0 };
    }

    let subscriptions: StoredPushSubscription[] = [];

    if (request.target === 'all') {
      const { data, error } = await supabase
        .from('push_subscriptions')
        .select('*')
        .eq('disabled', false);

      if (error) throw error;
      subscriptions = (data || []) as StoredPushSubscription[];
    } else {
      const { data, error } = await supabase
        .from('push_subscriptions')
        .select('*')
        .in('business_id', request.target as string[])
        .eq('disabled', false);

      if (error) throw error;
      subscriptions = (data || []) as StoredPushSubscription[];
    }

    const message: PushMessage = {
      title: request.title,
      body: request.body,
      url: request.url,
    };

    const results = await Promise.allSettled(
      subscriptions.map((subscription) => sendPushNotification(subscription, message))
    );

    const sent = results.filter((result) => result.status === 'fulfilled' && result.value).length;
    const failed = results.length - sent;

    await savePushLog({
      title: request.title,
      body: request.body,
      targetType: request.target === 'all' ? 'all' : 'specific',
      targetIds: request.target === 'all' ? null : request.target,
      sentCount: sent,
      adminId,
    });

    logger.info('Broadcast completado', { sent, failed, total: results.length });
    return { sent, failed, total: results.length };
  } catch (error: any) {
    logger.error('Error en broadcast', { error: error.message });
    throw error;
  }
};

export const savePushSubscription = async (
  userId: string,
  subscription: PushSubscription,
  userAgent?: string
): Promise<void> => {
  await savePushSubscriptionForBusiness(userId, subscription, userAgent);
};

export const removePushSubscription = async (endpoint: string): Promise<void> => {
  const { error } = await supabase
    .from('push_subscriptions')
    .delete()
    .eq('endpoint', endpoint);

  if (error) throw error;
};
