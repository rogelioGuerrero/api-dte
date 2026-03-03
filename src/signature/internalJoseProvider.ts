import { CompactSign, importPKCS8, JWSHeaderParameters } from 'jose';
import forge from 'node-forge';
import { SignatureProvider, SignatureRequest } from './provider';
import { createLogger } from '../utils/logger';

const logger = createLogger('SignatureProvider:internal');

const textEncoder = new TextEncoder();

interface ExtractedKeyMaterial {
  privateKeyPem: string;
  certChainBase64: string[];
}

const extractFromPkcs12 = (certificadoB64: string, passwordPri: string): ExtractedKeyMaterial => {
  try {
    const p12Der = forge.util.decode64(certificadoB64);
    const p12Asn1 = forge.asn1.fromDer(p12Der);
    const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, passwordPri || '');

    let privateKeyPem: string | null = null;
    const certChainBase64: string[] = [];

    for (const safeContent of p12.safeContents) {
      for (const safeBag of safeContent.safeBags) {
        if (safeBag.type === forge.pki.oids.pkcs8ShroudedKeyBag || safeBag.type === forge.pki.oids.keyBag) {
          const forgeKey = safeBag.key as forge.pki.PrivateKey;
          const privateKeyInfo = forge.pki.wrapRsaPrivateKey(forgeKey);
          privateKeyPem = forge.pki.privateKeyInfoToPem(privateKeyInfo);
        }
        if (safeBag.cert) {
          const derBytes = forge.asn1.toDer(forge.pki.certificateToAsn1(safeBag.cert)).getBytes();
          const b64 = forge.util.encode64(derBytes);
          certChainBase64.push(b64);
        }
      }
    }

    if (!privateKeyPem) {
      throw new Error('No se encontró clave privada en el .p12/.pfx');
    }
    if (certChainBase64.length === 0) {
      logger.warn('No se encontraron certificados en el .p12/.pfx, continuando sin x5c');
    }

    return { privateKeyPem, certChainBase64 };
  } catch (error: any) {
    logger.error('Error extrayendo clave de PKCS12', { error: error.message });
    throw new Error('Certificado inválido o contraseña incorrecta');
  }
};

const normalizePayload = (dteJson: SignatureRequest['dteJson']): string => {
  if (typeof dteJson === 'string') return dteJson;
  try {
    return JSON.stringify(dteJson);
  } catch (error: any) {
    throw new Error(`No se pudo serializar el DTE para firma: ${error.message}`);
  }
};

export const NodeJoseSignatureProvider: SignatureProvider = {
  name: 'internal',
  async sign({ certificadoB64, passwordPri, dteJson }: SignatureRequest): Promise<string> {
    const { privateKeyPem, certChainBase64 } = extractFromPkcs12(certificadoB64, passwordPri);
    const payload = normalizePayload(dteJson);

    const privateKey = await importPKCS8(privateKeyPem, 'RS256');
    const header: JWSHeaderParameters = {
      alg: 'RS256',
      x5c: certChainBase64.length > 0 ? certChainBase64 : undefined,
    };

    const jws = await new CompactSign(textEncoder.encode(payload))
      .setProtectedHeader(header)
      .sign(privateKey);

    return jws;
  },
};
