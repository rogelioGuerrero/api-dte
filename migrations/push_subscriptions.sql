-- Para suscripciones push por negocio/dispositivo
CREATE TABLE push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  disabled BOOLEAN NOT NULL DEFAULT FALSE,
  last_sent_at TIMESTAMP NULL,
  last_error TEXT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(business_id, endpoint)
);

-- Para logs de mensajes enviados (auditoría)
CREATE TABLE push_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  target_type TEXT NOT NULL, -- 'all' o 'specific'
  target_ids JSONB, -- array de user_ids si es específico
  sent_count INTEGER DEFAULT 0,
  sent_at TIMESTAMP DEFAULT NOW(),
  admin_id UUID REFERENCES business_users(id)
);

-- Índices para mejor rendimiento
CREATE INDEX idx_push_subscriptions_business_id ON push_subscriptions(business_id);
CREATE INDEX idx_push_subscriptions_disabled ON push_subscriptions(disabled);
CREATE INDEX idx_push_logs_sent_at ON push_logs(sent_at);
CREATE INDEX idx_push_logs_admin_id ON push_logs(admin_id);
