export interface StoredRefreshToken {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
  /** Ultimo uso de la sesion: base del corte por inactividad. */
  lastUsedAt: Date;
}

export interface RefreshTokenRepository {
  save(data: {
    userId: string;
    tokenHash: string;
    expiresAt: Date;
    userAgent?: string | null;
    ip?: string | null;
  }): Promise<StoredRefreshToken>;
  findByHash(tokenHash: string): Promise<StoredRefreshToken | null>;
  revoke(id: string, replacedBy?: string | null): Promise<void>;
  /** Marca actividad en la sesion sin rotar el token. */
  touch(id: string, at: Date): Promise<void>;
  revokeAllForUser(userId: string): Promise<void>;
  deleteExpired(): Promise<number>;
}
