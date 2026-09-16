/** Errores de dominio: no conocen HTTP, el adaptador los traduce a status codes. */
export class DomainError extends Error {
  constructor(message: string, public readonly code = 'DOMAIN_ERROR') {
    super(message);
    this.name = new.target.name;
  }
}

export class ValidationError extends DomainError {
  constructor(message: string, public readonly details?: unknown) {
    super(message, 'VALIDATION_ERROR');
  }
}

export class NotFoundError extends DomainError {
  constructor(resource: string) {
    super(`${resource} no encontrado`, 'NOT_FOUND');
  }
}

export class ConflictError extends DomainError {
  constructor(message: string) {
    super(message, 'CONFLICT');
  }
}

export class UnauthorizedError extends DomainError {
  constructor(message = 'No autenticado') {
    super(message, 'UNAUTHORIZED');
  }
}

/** Se lanza tanto por rol insuficiente como por acceso a un recurso ajeno (IDOR). */
export class ForbiddenError extends DomainError {
  constructor(message = 'No tiene permisos para acceder a este recurso') {
    super(message, 'FORBIDDEN');
  }
}

export class BusinessRuleError extends DomainError {
  constructor(message: string) {
    super(message, 'BUSINESS_RULE');
  }
}
