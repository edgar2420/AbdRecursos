import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(3000),
  API_PREFIX: z.string().default('/api/v1'),

  DATABASE_URL: z.string().min(1),

  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  BCRYPT_ROUNDS: z.coerce.number().default(12),
  SESSION_IDLE_MINUTES: z.coerce.number().min(1).max(480).default(15),
  FIELD_ENCRYPTION_KEY: z.string().min(16),

  HTTPS_ENABLED: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
  HTTPS_KEY_PATH: z.string().default('./certs/sgrh-key.pem'),
  HTTPS_CERT_PATH: z.string().default('./certs/sgrh-cert.pem'),

  CORS_ORIGINS: z.string().default('http://localhost:4200'),

  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(900000),
  RATE_LIMIT_MAX: z.coerce.number().default(300),
  LOGIN_RATE_LIMIT_MAX: z.coerce.number().default(5),

  UPLOAD_MAX_MB: z.coerce.number().default(10),
  UPLOAD_DIR: z.string().default('./storage/uploads'),

  COMPANY_NAME: z.string().default('Empresa S.R.L.'),
  COMPANY_NIT: z.string().default('0000000000'),
  COMPANY_CITY: z.string().default('La Paz - Bolivia'),

  // Integracion con ZKBio Time (opcional: sin URL no se sincroniza nada)
  ZKBIO_URL: z.preprocess((v) => (v === '' ? undefined : v), z.string().url().optional()),
  ZKBIO_USER: z.preprocess((v) => (v === '' ? undefined : v), z.string().optional()),
  ZKBIO_PASSWORD: z.preprocess((v) => (v === '' ? undefined : v), z.string().optional()),
  ZKBIO_SYNC_MINUTES: z.coerce.number().int().min(1).max(1440).default(5),

  // Receptor directo del reloj (protocolo PUSH / iclock, HTTP plano). Sin puerto no se inicia.
  ICLOCK_PORT: z.preprocess((v) => (v === '' ? undefined : v), z.coerce.number().int().min(1).max(65535).optional()),
  ICLOCK_SERIALS: z.string().default(''),
  ICLOCK_RELAY_URL: z.preprocess((v) => (v === '' ? undefined : v), z.string().url().optional()),
  ICLOCK_TIMEZONE: z.coerce.number().default(-4),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('Configuracion invalida:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = {
  ...parsed.data,
  isProduction: parsed.data.NODE_ENV === 'production',
  useSecureCookies: parsed.data.HTTPS_ENABLED || parsed.data.NODE_ENV === 'production',
  corsOrigins: parsed.data.CORS_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean),
};

export type Env = typeof env;
