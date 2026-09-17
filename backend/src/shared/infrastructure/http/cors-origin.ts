import { env } from '../config/env';

const PRIVATE_HOST = /^(localhost|127\.\d+\.\d+\.\d+|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)$/;

export function isOriginAllowed(origin: string): boolean {
  if (env.corsOrigins.includes(origin)) return true;
  if (env.isProduction) return false;

  try {
    const { hostname, protocol } = new URL(origin);
    const protocoloValido = env.useSecureCookies ? protocol === 'https:' : protocol === 'http:' || protocol === 'https:';
    if (!protocoloValido) return false;
    return PRIVATE_HOST.test(hostname);
  } catch {
    return false;
  }
}
