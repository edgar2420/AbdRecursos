import { env } from '../config/env';

/** Rangos privados de la RFC 1918 más loopback: solo redes locales. */
const PRIVATE_HOST = /^(localhost|127\.\d+\.\d+\.\d+|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)$/;

/**
 * Decide si un origen puede llamar a la API (sección 8.4: nunca "*").
 *
 * En producción solo pasan los dominios declarados en CORS_ORIGINS.
 *
 * En desarrollo se aceptan además los orígenes de la red local, para poder
 * abrir la aplicación desde un celular o desde otra máquina de la oficina sin
 * reconfigurar el servidor cada vez que el router entrega otra IP. La excepción
 * está limitada a direcciones privadas: una IP pública nunca pasa por aquí.
 */
export function isOriginAllowed(origin: string): boolean {
  if (env.corsOrigins.includes(origin)) return true;
  if (env.isProduction) return false;

  try {
    const { hostname, protocol } = new URL(origin);
    // Con HTTPS activo no se admite un origen que vuelva a HTTP: evitaria
    // exactamente el downgrade que el certificado esta ahi para impedir.
    const protocoloValido = env.useSecureCookies ? protocol === 'https:' : protocol === 'http:' || protocol === 'https:';
    if (!protocoloValido) return false;
    return PRIVATE_HOST.test(hostname);
  } catch {
    return false;
  }
}
