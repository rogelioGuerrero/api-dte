import { supabase } from '../database/supabase';
import { createLogger } from '../utils/logger';

const logger = createLogger('businessStorage');

export interface Business {
  id?: string;
  nit: string;
  nrc?: string;
  nombre_comercial: string;
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
  password_pri?: string;
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

export const getBusinessByNIT = async (nit: string): Promise<Business | null> => {
  try {
    const { data, error } = await supabase
      .from('businesses')
      .select('*')
      .eq('nit', nit)
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

    logger.info('MH credentials saved successfully', { businessId: credentials.business_id, ambiente: credentials.ambiente });
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
    const { data, error } = await supabase
      .from('mh_credentials')
      .select('*')
      .eq('nit', nit)
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
