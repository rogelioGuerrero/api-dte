import webpush from 'web-push';
import { createLogger } from '../utils/logger';
import { supabase } from '../database/supabase';

const logger = createLogger('pushService');

// Configurar VAPID keys
const publicVapidKey = process.env.VAPID_PUBLIC_KEY;
const privateVapidKey = process.env.VAPID_PRIVATE_KEY;

if (!publicVapidKey || !privateVapidKey) {
  throw new Error('VAPID_PUBLIC_KEY y VAPID_PRIVATE_KEY son requeridos');
}

webpush.setVapidDetails(
  'mailto:soporte@rogelioguerrero.com',
  publicVapidKey,
  privateVapidKey
);

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
  target: 'all' | string[]; // 'all' o array de user_ids
}

export const sendPushNotification = async (
  subscription: PushSubscription,
  message: PushMessage
): Promise<boolean> => {
  try {
    const payload = JSON.stringify({
      title: message.title,
      body: message.body,
      url: message.url || '/',
      icon: message.icon || '/icon-192x192.png',
      badge: message.badge || '/badge-72x72.png'
    });

    await webpush.sendNotification(subscription, payload);
    logger.info('Push notification enviada exitosamente', { endpoint: subscription.endpoint });
    return true;
  } catch (error: any) {
    logger.error('Error enviando push notification', { 
      endpoint: subscription.endpoint, 
      error: error.message 
    });
    
    // Si es un error de suscripción inválida, podría necesitar limpieza
    if (error.statusCode === 410 || error.statusCode === 404) {
      logger.warn('Suscripción expirada o inválida', { endpoint: subscription.endpoint });
    }
    
    return false;
  }
};

export const broadcastMessage = async (
  request: BroadcastRequest,
  adminId: string
): Promise<{ sent: number; failed: number; total: number }> => {
  try {
    let subscriptions: any[] = [];
    
    // Obtener suscripciones según el target
    if (request.target === 'all') {
      const { data, error } = await supabase
        .from('push_subscriptions')
        .select('subscription');
      
      if (error) throw error;
      subscriptions = data || [];
    } else {
      // Target específico - array de user_ids
      const { data, error } = await supabase
        .from('push_subscriptions')
        .select('subscription')
        .in('user_id', request.target as string[]);
      
      if (error) throw error;
      subscriptions = data || [];
    }

    logger.info(`Enviando broadcast a ${subscriptions.length} suscriptores`, {
      target: request.target,
      adminId
    });

    // Enviar notificaciones en paralelo
    const message: PushMessage = {
      title: request.title,
      body: request.body,
      url: request.url
    };

    const promises = subscriptions.map(sub => 
      sendPushNotification(sub.subscription, message)
    );

    const results = await Promise.allSettled(promises);
    
    const sent = results.filter(r => r.status === 'fulfilled' && r.value).length;
    const failed = results.length - sent;

    // Guardar log del broadcast
    await savePushLog({
      title: request.title,
      body: request.body,
      targetType: request.target === 'all' ? 'all' : 'specific',
      targetIds: request.target === 'all' ? null : request.target,
      sentCount: sent,
      adminId
    });

    logger.info(`Broadcast completado`, { sent, failed, total: results.length });

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
  try {
    const { error } = await supabase
      .from('push_subscriptions')
      .upsert({
        user_id: userId,
        subscription: subscription,
        user_agent: userAgent,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id, (subscription->\'endpoint\')'
      });

    if (error) throw error;
    
    logger.info('Suscripción push guardada', { userId, endpoint: subscription.endpoint });
  } catch (error: any) {
    logger.error('Error guardando suscripción push', { error: error.message });
    throw error;
  }
};

export const removePushSubscription = async (endpoint: string): Promise<void> => {
  try {
    const { error } = await supabase
      .from('push_subscriptions')
      .delete()
      .eq('subscription->>endpoint', endpoint);

    if (error) throw error;
    
    logger.info('Suscripción push eliminada', { endpoint });
  } catch (error: any) {
    logger.error('Error eliminando suscripción push', { error: error.message });
    throw error;
  }
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
