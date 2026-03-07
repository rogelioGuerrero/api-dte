CREATE TABLE business_settings (
  business_id UUID PRIMARY KEY REFERENCES businesses(id) ON DELETE CASCADE,
  default_tab TEXT,
  features JSONB NOT NULL DEFAULT '{}'::jsonb,
  push_enabled BOOLEAN NOT NULL DEFAULT false,
  fingerprint_enabled BOOLEAN NOT NULL DEFAULT false,
  advanced_config_enabled BOOLEAN NOT NULL DEFAULT false,
  plan_code TEXT,
  plan_label TEXT,
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_business_settings_plan_code ON business_settings(plan_code);
CREATE INDEX idx_business_settings_features ON business_settings USING GIN(features);
