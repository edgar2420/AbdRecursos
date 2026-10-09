import { AuditEvent, AuditLoggerPort } from './AuditLogger';
import { PublicadorEventos, TipoEvento } from './Eventos';

/** Que pantallas deben actualizarse cuando cambia cada tipo de registro. */
const EVENTO_POR_ENTIDAD: Record<string, TipoEvento> = {
  AttendanceRecord: 'marcaciones',
  AttendanceJustification: 'marcaciones',
  ScheduleAssignment: 'marcaciones',
  Employee: 'empleados',
  VacationRequest: 'vacaciones',
  Papeleta: 'papeletas',
};

/**
 * Todo cambio importante ya pasa por la auditoria: este decorador aprovecha eso para avisar
 * en tiempo real, sin que cada caso de uso tenga que acordarse de publicar.
 */
export class AuditoriaConEventos implements AuditLoggerPort {
  constructor(
    private readonly auditoria: AuditLoggerPort,
    private readonly eventos: PublicadorEventos,
  ) {}

  async log(event: AuditEvent): Promise<void> {
    await this.auditoria.log(event);
    const tipo = EVENTO_POR_ENTIDAD[event.entity];
    if (tipo) this.eventos.publicar(tipo);
  }
}
