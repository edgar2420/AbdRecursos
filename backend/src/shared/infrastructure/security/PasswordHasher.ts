import bcrypt from 'bcryptjs';
import { env } from '../config/env';

/** Puerto de hashing (el dominio depende de la interfaz, no de bcrypt). */
export interface PasswordHasherPort {
  hash(plain: string): Promise<string>;
  compare(plain: string, hash: string): Promise<boolean>;
}

export class BcryptPasswordHasher implements PasswordHasherPort {
  async hash(plain: string): Promise<string> {
    return bcrypt.hash(plain, env.BCRYPT_ROUNDS);
  }

  async compare(plain: string, hash: string): Promise<boolean> {
    return bcrypt.compare(plain, hash);
  }
}
