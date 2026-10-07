import { AuditLoggerPort } from '../../../shared/application/AuditLogger';
import { BusinessRuleError } from '../../../shared/domain/errors';
import { AccessActor, EmployeeAccessPolicy } from '../../employees/domain/services/EmployeeAccessPolicy';
import { MovimientoConSaldo, conSaldoAcumulado, saldoDe } from '../domain/banco';
import { BancoHorasRepository } from '../domain/BancoHorasRepository';
import { movimientosDe } from '../domain/movimientos';

export interface DetalleBanco {
  employeeId: string;
  saldoMinutos: number;
  aFavorMinutos: number;
  usadoMinutos: number;
  ajustesMinutos: number;
  movimientos: MovimientoConSaldo[];
}

export class ConsultarBancoHoras {
  constructor(
    private readonly repo: BancoHorasRepository,
    private readonly policy: EmployeeAccessPolicy,
  ) {}

  async detalle(actor: AccessActor, employeeId: string): Promise<DetalleBanco> {
    await this.policy.assertCanView(actor, employeeId);
    const [papeletas, ajustes] = await Promise.all([
      this.repo.papeletasQueCuentan([employeeId]),
      this.repo.ajustes([employeeId]),
    ]);
    const movimientos = conSaldoAcumulado(movimientosDe(papeletas, ajustes));
    const suma = (tipo: string) => movimientos.filter((m) => m.tipo === tipo).reduce((acc, m) => acc + m.minutos, 0);
    return {
      employeeId,
      saldoMinutos: saldoDe(movimientos),
      aFavorMinutos: suma('HORAS_EXTRAS'),
      usadoMinutos: -suma('SALIDA'),
      ajustesMinutos: suma('AJUSTE'),
      movimientos: movimientos.reverse(),
    };
  }

  /** Saldo de varios empleados a la vez (para la tabla de asistencia); solo devuelve los que el actor puede ver. */
  async saldos(actor: AccessActor, employeeIds: string[]): Promise<Array<{ employeeId: string; saldoMinutos: number }>> {
    const scope = await this.policy.scopeFor(actor);
    const visibles = scope.all ? employeeIds : employeeIds.filter((id) => scope.employeeIds.includes(id));
    if (visibles.length === 0) return [];
    const [papeletas, ajustes] = await Promise.all([this.repo.papeletasQueCuentan(visibles), this.repo.ajustes(visibles)]);
    return visibles.map((employeeId) => ({
      employeeId,
      saldoMinutos: saldoDe(
        movimientosDe(
          papeletas.filter((p) => p.employeeId === employeeId),
          ajustes.filter((a) => a.employeeId === employeeId),
        ),
      ),
    }));
  }
}

export class RegistrarAjusteBanco {
  constructor(
    private readonly repo: BancoHorasRepository,
    private readonly policy: EmployeeAccessPolicy,
    private readonly audit: AuditLoggerPort,
  ) {}

  async execute(actor: AccessActor, employeeId: string, minutos: number, motivo: string) {
    this.policy.assertCanManage(actor);
    if (!minutos) throw new BusinessRuleError('El ajuste debe tener minutos distintos de cero');
    if (!motivo?.trim() || motivo.trim().length < 5) throw new BusinessRuleError('Indique el motivo del ajuste');
    const ajuste = await this.repo.crearAjuste({ employeeId, minutos, motivo: motivo.trim(), creadoPor: actor.userId });
    await this.audit.log({
      userId: actor.userId,
      action: 'BANCO_HORAS_AJUSTE',
      entity: 'Employee',
      entityId: employeeId,
      changes: { minutos, motivo: motivo.trim() },
    });
    return ajuste;
  }
}
