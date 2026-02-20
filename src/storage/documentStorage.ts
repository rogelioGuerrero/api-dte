import { supabase } from '../database/supabase';
import { createLogger } from '../utils/logger';

const logger = createLogger('documentStorage');

export interface DocumentUploadResult {
  url: string;
  path: string;
}

export const uploadDTEPDF = async (
  businessNit: string,
  codigoGeneracion: string,
  pdfBuffer: ArrayBuffer
): Promise<DocumentUploadResult> => {
  try {
    const fileName = `${codigoGeneracion}.pdf`;
    const path = `${businessNit}/${new Date().getFullYear()}/${(new Date().getMonth() + 1).toString().padStart(2, '0')}/${fileName}`;

    const { data, error } = await supabase.storage
      .from('dte-docs')
      .upload(path, pdfBuffer, {
        contentType: 'application/pdf',
        upsert: true
      });

    if (error) throw error;

    const { data: { publicUrl } } = supabase.storage
      .from('dte-docs')
      .getPublicUrl(path);

    logger.info('PDF uploaded successfully', { path, codigoGeneracion });
    
    return {
      url: publicUrl,
      path
    };
  } catch (error: any) {
    logger.error('Error uploading PDF', { error: error.message });
    throw error;
  }
};

export const uploadDTExml = async (
  businessNit: string,
  codigoGeneracion: string,
  xmlContent: string
): Promise<DocumentUploadResult> => {
  try {
    const fileName = `${codigoGeneracion}.xml`;
    const path = `${businessNit}/${new Date().getFullYear()}/${(new Date().getMonth() + 1).toString().padStart(2, '0')}/${fileName}`;

    const { data, error } = await supabase.storage
      .from('dte-docs')
      .upload(path, xmlContent, {
        contentType: 'application/xml',
        upsert: true
      });

    if (error) throw error;

    const { data: { publicUrl } } = supabase.storage
      .from('dte-docs')
      .getPublicUrl(path);

    logger.info('XML uploaded successfully', { path, codigoGeneracion });
    
    return {
      url: publicUrl,
      path
    };
  } catch (error: any) {
    logger.error('Error uploading XML', { error: error.message });
    throw error;
  }
};

export const uploadDTEJson = async (
  businessNit: string,
  codigoGeneracion: string,
  jsonContent: object
): Promise<DocumentUploadResult> => {
  try {
    const fileName = `${codigoGeneracion}.json`;
    const path = `${businessNit}/${new Date().getFullYear()}/${(new Date().getMonth() + 1).toString().padStart(2, '0')}/${fileName}`;

    const { data, error } = await supabase.storage
      .from('dte-docs')
      .upload(path, JSON.stringify(jsonContent, null, 2), {
        contentType: 'application/json',
        upsert: true
      });

    if (error) throw error;

    const { data: { publicUrl } } = supabase.storage
      .from('dte-docs')
      .getPublicUrl(path);

    logger.info('JSON uploaded successfully', { path, codigoGeneracion });
    
    return {
      url: publicUrl,
      path
    };
  } catch (error: any) {
    logger.error('Error uploading JSON', { error: error.message });
    throw error;
  }
};

export const deleteDocument = async (path: string): Promise<void> => {
  try {
    const { error } = await supabase.storage
      .from('dte-docs')
      .remove([path]);

    if (error) throw error;

    logger.info('Document deleted successfully', { path });
  } catch (error: any) {
    logger.error('Error deleting document', { path, error: error.message });
    throw error;
  }
};

export const getDocumentUrl = async (path: string): Promise<string> => {
  try {
    const { data } = await supabase.storage
      .from('dte-docs')
      .getPublicUrl(path);

    return data.publicUrl;
  } catch (error: any) {
    logger.error('Error getting document URL', { path, error: error.message });
    throw error;
  }
};

export const createSignedUrl = async (path: string, expiresIn: number = 60): Promise<string> => {
  try {
    const { data, error } = await supabase.storage
      .from('dte-docs')
      .createSignedUrl(path, expiresIn);

    if (error) throw error;

    return data.signedUrl;
  } catch (error: any) {
    logger.error('Error creating signed URL', { path, error: error.message });
    throw error;
  }
};

// Helper function to generate document path
export const generateDocumentPath = (
  businessNit: string, 
  codigoGeneracion: string, 
  extension: 'pdf' | 'xml' | 'json'
): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  
  return `${businessNit}/${year}/${month}/${codigoGeneracion}.${extension}`;
};
