import { getMHMode } from './config';

interface MHAuthResponse {
  status?: string;
  body?: {
    token?: string;
    tokenType?: string;
  };
  [k: string]: unknown;
}

interface TokenCacheEntry {
  token: string;
  expiresAt: number;
}

const tokenCache = new Map<string, TokenCacheEntry>();

const getMHBaseUrl = (ambiente: '00' | '01'): string => {
  const mode = getMHMode();
  const isProd = mode === 'prod' || ambiente === '01';
  if (isProd) {
    return process.env.MH_BASE_URL_PROD || 'https://api.dtes.mh.gob.sv';
  }
  return process.env.MH_BASE_URL_TEST || 'https://apitest.dtes.mh.gob.sv';
};

export const normalizeBearerToken = (rawToken?: string): string => {
  if (!rawToken) return '';
  const trimmed = rawToken.trim();
  if (!trimmed) return '';
  if (/^Bearer\s+/i.test(trimmed)) {
    return `Bearer ${trimmed.replace(/^Bearer\s+/i, '').trim()}`;
  }
  return `Bearer ${trimmed}`;
};

export const isLikelyJwt = (rawToken?: string): boolean => {
  if (!rawToken) return false;
  const token = rawToken.trim().replace(/^Bearer\s+/i, '');
  if (!token.includes('.')) return false;
  return /^eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+$/.test(token);
};

const isTokenExpired = (updatedAt: string | undefined, ambiente: '00' | '01'): boolean => {
  if (!updatedAt) return true;
  const updated = new Date(updatedAt);
  if (Number.isNaN(updated.getTime())) return true;
  const ttlHours = ambiente === '00' ? 48 : 24;
  const bufferHours = 1;
  const expiresAt = new Date(updated.getTime() + (ttlHours - bufferHours) * 60 * 60 * 1000);
  return new Date() >= expiresAt;
};

const getCacheKey = (nit: string, ambiente: '00' | '01'): string => `${nit}:${ambiente}`;

const getCachedToken = (nit: string, ambiente: '00' | '01'): string => {
  const entry = tokenCache.get(getCacheKey(nit, ambiente));
  if (!entry) return '';
  if (Date.now() >= entry.expiresAt) {
    tokenCache.delete(getCacheKey(nit, ambiente));
    return '';
  }
  return entry.token;
};

const cacheToken = (nit: string, ambiente: '00' | '01', token: string): void => {
  const ttlHours = ambiente === '00' ? 48 : 24;
  const bufferHours = 1;
  const expiresAt = Date.now() + (ttlHours - bufferHours) * 60 * 60 * 1000;
  tokenCache.set(getCacheKey(nit, ambiente), { token, expiresAt });
};

export const requestMHAuthToken = async (
  nit: string,
  apiPassword: string,
  ambiente: '00' | '01'
): Promise<string> => {
  const baseUrl = getMHBaseUrl(ambiente);
  const url = `${baseUrl}/seguridad/auth`;

  const body = new URLSearchParams({
    user: nit,
    pwd: apiPassword,
  });

  console.log(`🔐 Solicitando token MH para NIT ${nit} ambiente ${ambiente}`);
  
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });

  const data = (await res.json().catch(() => ({}))) as MHAuthResponse;
  
  console.log(`🔍 Respuesta MH (${res.status}):`, JSON.stringify(data, null, 2));
  
  if (!res.ok) {
    throw new Error(`Auth MH falló (${res.status}): ${JSON.stringify(data)}`);
  }

  const token = data.body?.token || '';
  if (!token) {
    console.error('❌ Estructura inesperada en respuesta MH:', data);
    throw new Error('Auth MH no devolvió token');
  }

  console.log('✅ Token obtenido:', token.substring(0, 50) + '...');
  return normalizeBearerToken(token);
};

export const getCachedMHAuthToken = async (
  nit: string,
  apiPassword: string,
  ambiente: '00' | '01'
): Promise<string> => {
  const cached = getCachedToken(nit, ambiente);
  if (cached) return cached;
  const token = await requestMHAuthToken(nit, apiPassword, ambiente);
  cacheToken(nit, ambiente, token);
  return token;
};

export const shouldRefreshToken = (
  apiToken: string | undefined,
  updatedAt: string | undefined,
  ambiente: '00' | '01'
): boolean => {
  if (!apiToken) return true;
  if (!normalizeBearerToken(apiToken)) return true;
  return isTokenExpired(updatedAt, ambiente);
};
