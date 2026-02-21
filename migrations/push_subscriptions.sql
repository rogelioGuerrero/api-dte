-- Para suscripciones push de usuarios
CREATE TABLE push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES business_users(id),
  subscription JSONB NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, (subscription->>'endpoint'))
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
CREATE INDEX idx_push_subscriptions_user_id ON push_subscriptions(user_id);
CREATE INDEX idx_push_logs_sent_at ON push_logs(sent_at);
CREATE INDEX idx_push_logs_admin_id ON push_logs(admin_id);
