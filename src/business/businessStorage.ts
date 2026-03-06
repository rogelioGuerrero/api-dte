import { supabase } from '../database/supabase';
import { createLogger } from '../utils/logger';

const logger = createLogger('businessStorage');

export interface Business {
  id?: string;
  nit: string;
  nit_clean?: string;
  nrc?: string;
  nombre_comercial: string;
  nombre?: string;
  cod_actividad?: string;
  desc_actividad?: string;
  tipo_establecimiento?: string;
  cod_estable?: string | null;
  cod_punto_venta?: string | null;
  cod_estable_mh?: string | null;
  cod_punto_venta_mh?: string | null;
  dir_departamento?: string | null;
  dir_municipio?: string | null;
  dir_complemento?: string | null;
  telefono?: string | null;
  correo?: string | null;
  logo_url?: string | null;
  owner_email?: string;
  created_at?: string;
  updated_at?: string;
}

export interface BusinessUser {
  id?: string;
  business_id: string;
  user_id: string;
  role: 'owner' | 'admin' | 'operator';
  created_at?: string;
}

export interface MHCredentials {
  id?: string;
  business_id: string;
  nit: string;
  nrc: string;
  api_token?: string;
  api_token_expires_at?: string;
  api_password?: string;
  password_pri?: string;
  certificado_b64?: string;
  ambiente: '00' | '01';
  activo: boolean;
  created_at?: string;
  updated_at?: string;
}

// Business operations
export const createBusiness = async (business: Omit<Business, 'id' | 'created_at' | 'updated_at'>): Promise<Business> => {
  try {
    const { data, error } = await supabase
      .from('businesses')
      .insert(business)
      .select()
      .single();

    if (error) throw error;

    logger.info('Business created successfully', { nit: business.nit, nombre: business.nombre_comercial });
    return data as Business;
  } catch (error: any) {
    logger.error('Error creating business', { error: error.message });
    throw error;
  }
};

export const getBusinessesByUserAsNit = async (
  userId: string
): Promise<Array<{ business_id: string; nombre: string; role: BusinessUser['role'] }>> => {
  try {
    const { data, error } = await supabase
      .from('business_users')
      .select('role, businesses(nit, nit_clean, nombre, nombre_comercial)')
      .eq('user_id', userId);

    if (error) throw error;

    return (data || []).map((row: any) => {
      const business = row.businesses || {};
      const nit = (business.nit_clean || business.nit || '').toString();
      return {
        business_id: nit,
        nombre: (business.nombre_comercial || business.nombre || '').toString(),
        role: row.role,
      };
    });
  } catch (error: any) {
    logger.error('Error fetching businesses by user as nit', { userId, error: error.message });
    throw error;
  }
};

export const getBusinessById = async (businessId: string): Promise<Business | null> => {
  try {
    const { data, error } = await supabase
      .from('businesses')
      .select('*')
      .eq('id', businessId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }

    return data as Business;
  } catch (error: any) {
    logger.error('Error fetching business by id', { businessId, error: error.message });
    throw error;
  }
};

export const getBusinessesByUser = async (userId: string): Promise<Array<{ business_id: string; nombre: string | null; nombre_comercial: string; role: BusinessUser['role'] }>> => {
  try {
    const { data, error } = await supabase
      .from('business_users')
      .select('business_id, role, businesses(nombre, nombre_comercial)')
      .eq('user_id', userId);

    if (error) throw error;

    return (data || []).map((row: any) => ({
      business_id: row.business_id,
      role: row.role,
      nombre: row.businesses?.nombre ?? null,
      nombre_comercial: row.businesses?.nombre_comercial ?? row.businesses?.nombre ?? null,
    }));
  } catch (error: any) {
    logger.error('Error fetching businesses by user', { userId, error: error.message });
    throw error;
  }
};

export const updateBusinessProfileById = async (
  businessId: string,
  payload: Partial<Business>
): Promise<Business> => {
  try {
    const cleanPayload = Object.fromEntries(
      Object.entries(payload).filter(([, v]) => v !== undefined)
    );

    // Evitar escribir columnas generadas/no actualizables
    if ('nit_clean' in cleanPayload) {
      delete (cleanPayload as any).nit_clean;
    }

    if (Object.keys(cleanPayload).length === 0) {
      const { data, error } = await supabase
        .from('businesses')
        .select('*')
        .eq('id', businessId)
        .single();
      if (error) throw error;
      return data as Business;
    }

    const { data, error } = await supabase
      .from('businesses')
      .update({ ...cleanPayload, updated_at: new Date().toISOString() })
      .eq('id', businessId)
      .select()
      .single();

    if (error) throw error;

    logger.info('Business profile updated', { businessId });
    return data as Business;
  } catch (error: any) {
    logger.error('Error updating business profile', { businessId, error: error.message });
    throw error;
  }
};

export const updateMHTokenByNIT = async (
  nit: string,
  ambiente: '00' | '01',
  apiToken: string,
  apiTokenExpiresAt?: string
): Promise<void> => {
  try {
    const { error } = await supabase
      .from('mh_credentials')
      .update({
        api_token: apiToken,
        api_token_expires_at: apiTokenExpiresAt,
        updated_at: new Date().toISOString()
      })
      .eq('nit', nit)
      .eq('ambiente', ambiente);

    if (error) throw error;

    logger.info('MH token actualizado', { nit, ambiente });
  } catch (error: any) {
    logger.error('Error actualizando token MH', { nit, ambiente, error: error.message });
    throw error;
  }
};

export const getBusinessByNIT = async (nit: string): Promise<Business | null> => {
  try {
    const nitClean = (nit || '').replace(/[^0-9]/g, '');
    const { data, error } = await supabase
      .from('businesses')
      .select('*')
      .eq('nit_clean', nitClean)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }

    return data as Business;
  } catch (error: any) {
    logger.error('Error fetching business by NIT', { nit, error: error.message });
    throw error;
  }
};

export const getBusinessesForUser = async (userId: string): Promise<Business[]> => {
  try {
    const { data, error } = await supabase
      .from('business_users')
      .select(`
        business_id,
        businesses (
          id,
          nit,
          nrc,
          nombre_comercial,
          owner_email,
          created_at,
          updated_at
        )
      `)
      .eq('user_id', userId);

    if (error) throw error;

    return (data || []).map(item => (item as any).businesses).filter(Boolean);
  } catch (error: any) {
    logger.error('Error fetching businesses for user', { userId, error: error.message });
    throw error;
  }
};

// Business User operations
export const addUserToBusiness = async (businessUser: Omit<BusinessUser, 'id' | 'created_at'>): Promise<BusinessUser> => {
  try {
    const { data, error } = await supabase
      .from('business_users')
      .insert(businessUser)
      .select()
      .single();

    if (error) throw error;

    logger.info('User added to business', { businessId: businessUser.business_id, userId: businessUser.user_id, role: businessUser.role });
    return data as BusinessUser;
  } catch (error: any) {
    logger.error('Error adding user to business', { error: error.message });
    throw error;
  }
};

export const createBusinessUser = async (payload: BusinessUser): Promise<BusinessUser> => {
  try {
    const { data, error } = await supabase
      .from('business_users')
      .upsert(payload, { onConflict: 'business_id,user_id' })
      .select()
      .single();

    if (error) throw error;
    return data as BusinessUser;
  } catch (error: any) {
    logger.error('Error creating business user', { payload, error: error.message });
    throw error;
  }
};

export const getBusinessUsers = async (businessId: string): Promise<Array<{ email: string | null; role: string; user_id: string }>> => {
  try {
    const { data, error } = await supabase
      .from('business_users')
      .select('user_id, role, auth.users(email)')
      .eq('business_id', businessId);

    if (error) throw error;

    return (data || []).map((row: any) => ({
      user_id: row.user_id,
      role: row.role,
      email: row.users?.email ?? null,
    }));
  } catch (error: any) {
    logger.error('Error fetching business users', { businessId, error: error.message });
    throw error;
  }
};

export const getUserRoleInBusiness = async (businessId: string, userId: string): Promise<string | null> => {
  try {
    const { data, error } = await supabase
      .from('business_users')
      .select('role')
      .eq('business_id', businessId)
      .eq('user_id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }

    return (data as any).role;
  } catch (error: any) {
    logger.error('Error fetching user role in business', { businessId, userId, error: error.message });
    throw error;
  }
};

// MH Credentials operations
export const saveMHCredentials = async (credentials: Omit<MHCredentials, 'id' | 'created_at' | 'updated_at'>): Promise<MHCredentials> => {
  try {
    const { data, error } = await supabase
      .from('mh_credentials')
      .upsert(credentials, { onConflict: 'business_id,ambiente' })
      .select()
      .single();

    if (error) throw error;

    logger.info('MH credentials saved successfully', { nit: credentials.nit, ambiente: credentials.ambiente });
    return data as MHCredentials;
  } catch (error: any) {
    logger.error('Error saving MH credentials', { error: error.message });
    throw error;
  }
};

export const getMHCredentials = async (businessId: string, ambiente: '00' | '01'): Promise<MHCredentials | null> => {
  try {
    const { data, error } = await supabase
      .from('mh_credentials')
      .select('*')
      .eq('business_id', businessId)
      .eq('ambiente', ambiente)
      .eq('activo', true)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }

    return data as MHCredentials;
  } catch (error: any) {
    logger.error('Error fetching MH credentials', { businessId, ambiente, error: error.message });
    throw error;
  }
};

export const getMHCredentialsByNIT = async (nit: string, ambiente: '00' | '01'): Promise<MHCredentials | null> => {
  try {
    const nitClean = (nit || '').replace(/[^0-9]/g, '');
    const nitRaw = (nit || '').trim();

    const { data, error } = await supabase
      .from('mh_credentials')
      .select('*')
      .or(`nit.eq.${nitClean},nit.eq.${nitRaw}`)
      .eq('ambiente', ambiente)
      .eq('activo', true)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }

    return data as MHCredentials;
  } catch (error: any) {
    logger.error('Error fetching MH credentials by NIT', { nit, ambiente, error: error.message });
    throw error;
  }
};

export const updateMHCredentialsStatus = async (businessId: string, ambiente: '00' | '01', activo: boolean): Promise<void> => {
  try {
    const { error } = await supabase
      .from('mh_credentials')
      .update({ activo, updated_at: new Date().toISOString() })
      .eq('business_id', businessId)
      .eq('ambiente', ambiente);

    if (error) throw error;

    logger.info('MH credentials status updated', { businessId, ambiente, activo });
  } catch (error: any) {
    logger.error('Error updating MH credentials status', { error: error.message });
    throw error;
  }
};

// Helper functions
export const initializeBusinessForUser = async (
  userId: string, 
  businessData: Omit<Business, 'id' | 'created_at' | 'updated_at'>
): Promise<{ business: Business; businessUser: BusinessUser }> => {
  try {
    // Create business
    const business = await createBusiness(businessData);

    // Add user as owner
    const businessUser = await addUserToBusiness({
      business_id: business.id!,
      user_id: userId,
      role: 'owner'
    });

    return { business, businessUser };
  } catch (error: any) {
    logger.error('Error initializing business for user', { userId, error: error.message });
    throw error;
  }
};
