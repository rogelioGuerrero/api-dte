import { CompactSign, importPKCS8, CompactJWSHeaderParameters } from 'jose';
import forge from 'node-forge';
import { SignatureProvider, SignatureRequest } from './provider';
import { createLogger } from '../utils/logger';

const logger = createLogger('SignatureProvider:internal');

const textEncoder = new TextEncoder();

interface ExtractedKeyMaterial {
  privateKeyPem: string;
  certChainBase64: string[];
}

const wrapPem = (b64: string, header: string, footer: string): string => {
  const chunked = b64.match(/.{1,64}/g)?.join('\n') || b64;
  return `${header}\n${chunked}\n${footer}`;
};

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
          privateKeyPem = forge.pki.privateKeyToPem(forgeKey);
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
    throw new Error(`PKCS12 inválido o password incorrecta: ${error.message}`);
  }
};

const extractFromMhXml = (decodedXml: string): ExtractedKeyMaterial => {
  const pkMatch = decodedXml.match(/<privateKey>[\s\S]*?<encoded>([^<]+)<\/encoded>[\s\S]*?<\/privateKey>/i);
  if (!pkMatch) {
    throw new Error('XML sin privateKey');
  }
  const privateKeyPem = wrapPem(pkMatch[1].trim(), '-----BEGIN PRIVATE KEY-----', '-----END PRIVATE KEY-----');

  // Intentar extraer cert público para x5c (opcional)
  const certs: string[] = [];
  const pubMatch = decodedXml.match(/<publicKey>[\s\S]*?<encoded>([^<]+)<\/encoded>[\s\S]*?<\/publicKey>/i);
  if (pubMatch) {
    certs.push(pubMatch[1].trim());
  }

  return { privateKeyPem, certChainBase64: certs };
};

const extractFromPkcs8OrPem = (certificadoB64: string): ExtractedKeyMaterial => {
  const decoded = Buffer.from(certificadoB64, 'base64').toString('utf8');

  // Si ya viene en PEM
  if (decoded.includes('BEGIN PRIVATE KEY')) {
    return { privateKeyPem: decoded, certChainBase64: [] };
  }

  // Si el contenido parece XML del MH, extraer la clave privada
  if (decoded.trim().startsWith('<')) {
    return extractFromMhXml(decoded);
  }

  // Asumir base64 de PKCS8
  const privateKeyPem = wrapPem(decoded.trim(), '-----BEGIN PRIVATE KEY-----', '-----END PRIVATE KEY-----');
  return { privateKeyPem, certChainBase64: [] };
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
    let keyMaterial: ExtractedKeyMaterial;
    try {
      keyMaterial = extractFromPkcs12(certificadoB64, passwordPri);
    } catch (pkcs12Error: any) {
      logger.warn('PKCS12 no usable, intentando PKCS8/PEM', { error: pkcs12Error.message });
      keyMaterial = extractFromPkcs8OrPem(certificadoB64);
    }
    const { privateKeyPem, certChainBase64 } = keyMaterial;
    const payload = normalizePayload(dteJson);

    const privateKey = await importPKCS8(privateKeyPem, 'RS256');
    const header: CompactJWSHeaderParameters = {
      alg: 'RS256',
      x5c: certChainBase64.length > 0 ? certChainBase64 : undefined,
    };

    const jws = await new CompactSign(textEncoder.encode(payload))
      .setProtectedHeader(header)
      .sign(privateKey);

    return jws;
  },
};
