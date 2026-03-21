import jwt, { JwtPayload } from 'jsonwebtoken';

export type DevAuthRole = 'admin' | 'operator';

export interface DevAuthTokenClaims extends JwtPayload {
  email: string;
  role: DevAuthRole;
  isPlatformAdmin: boolean;
  businessId?: string;
  purpose: 'swagger-dev-auth';
}

const getDevTokenSecret = (): string => {
  const secret = process.env.JWT_SECRET || process.env.API_KEY_SECRET || process.env.SUPABASE_SERVICE_KEY;
  if (!secret) {
    throw new Error('JWT_SECRET, API_KEY_SECRET o SUPABASE_SERVICE_KEY son requeridos para generar tokens de desarrollo');
  }
  return secret;
};

export const createDevAuthToken = (options: {
  email?: string;
  role?: DevAuthRole;
  isPlatformAdmin?: boolean;
  businessId?: string;
  expiresIn?: string;
} = {}): string => {
  const secret = getDevTokenSecret();
  const email = (options.email || process.env.SWAGGER_DEV_EMAIL || 'swagger.dev@local').trim().toLowerCase();
  const role = options.role || (process.env.SWAGGER_DEV_ROLE as DevAuthRole) || 'admin';
  const isPlatformAdmin = options.isPlatformAdmin ?? true;
  const payload: DevAuthTokenClaims = {
    sub: email,
    email,
    role,
    isPlatformAdmin,
    purpose: 'swagger-dev-auth',
    ...(options.businessId ? { businessId: options.businessId } : {}),
  };

  const signOptions: jwt.SignOptions = {
    issuer: 'api-dte-dev-auth',
    audience: 'api-dte-dev',
    expiresIn: (options.expiresIn || process.env.SWAGGER_DEV_TOKEN_TTL || '8h') as jwt.SignOptions['expiresIn'],
    subject: email,
  };

  return jwt.sign(payload as jwt.JwtPayload, secret as jwt.Secret, signOptions);
};

export const verifyDevAuthToken = (token: string): DevAuthTokenClaims | null => {
  try {
    const secret = getDevTokenSecret();
    const decoded = jwt.verify(token, secret, {
      issuer: 'api-dte-dev-auth',
      audience: 'api-dte-dev',
    });

    if (!decoded || typeof decoded === 'string') {
      return null;
    }

    const payload = decoded as DevAuthTokenClaims;
    if (payload.purpose !== 'swagger-dev-auth') {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
};
