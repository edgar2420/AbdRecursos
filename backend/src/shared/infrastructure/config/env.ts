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
