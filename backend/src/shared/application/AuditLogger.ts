/** Puerto de auditoria: toda accion sensible queda registrada (8.4). */
export interface AuditEvent {
  userId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  changes?: Record<string, unknown> | null;
  ip?: string | null;
  userAgent?: string | null;
}

export interface AuditLoggerPort {
  log(event: AuditEvent): Promise<void>;
}
