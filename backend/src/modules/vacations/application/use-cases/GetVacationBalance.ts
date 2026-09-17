import { NotFoundError } from '../../../../shared/domain/errors';
import { yearsOfService } from '../../../../shared/domain/dates';
import { round2 } from '../../../../shared/domain/money';
import { EmployeeRepository } from '../../../employees/domain/repositories/EmployeeRepository';
import { AccessActor, EmployeeAccessPolicy } from '../../../employees/domain/services/EmployeeAccessPolicy';
import { GetLegalParameters } from '../../../legal-parameters/application/use-cases/GetLegalParameters';
import { VacationBalance, GestionBalance } from '../../domain/entities/VacationRequest';
import { VacationRepository } from '../../domain/repositories/VacationRepository';
import { VacationCalculator } from '../../domain/services/VacationCalculator';

export class GetVacationBalance {
  constructor(
    private readonly employees: EmployeeRepository,
    private readonly vacations: VacationRepository,
    private readonly parameters: GetLegalParameters,
    private readonly policy: EmployeeAccessPolicy,
  ) {}

  async execute(actor: AccessActor, employeeId: string, year?: number): Promise<VacationBalance> {
    await this.policy.assertCanView(actor, employeeId);
    const employee = await this.employees.findById(employeeId);
    if (!employee) throw new NotFoundError('Empleado');

    const at = new Date();
    const calculator = new VacationCalculator(await this.parameters.execute(at));
    const gestiones = calculator.gestiones(employee.hireDate, at);
    const acreditaAlInicio = calculator.acreditaAlIniciarGestion();
    const solicitudes = await this.vacations.listConsuming(employeeId);
    const historico = new Map(
      (await this.vacations.historicalGestiones(employeeId)).map((h) => [h.periodYear, h.takenDays]),
    );

    const detalle: GestionBalance[] = gestiones.map((g) => {
      const delPeriodo = solicitudes.filter((s) => s.startDate >= g.inicio && s.startDate <= g.fin);
      const tomados =
        (historico.get(g.inicio.getFullYear()) ?? 0) +
        delPeriodo
          .filter((s) => s.status === 'APPROVED')
          .reduce((acc, s) => acc + s.workingDays, 0);
      const enTramite = delPeriodo
        .filter((s) => s.status !== 'APPROVED')
        .reduce((acc, s) => acc + s.workingDays, 0);

      const otorgados = g.cumplida || acreditaAlInicio ? g.diasOtorgados : 0;
      return {
        numero: g.numero,
        etiqueta: g.etiqueta,
        inicio: g.inicio,
        fin: g.fin,
        cumplida: g.cumplida,
        diasOtorgados: g.diasOtorgados,
        diasAcreditados: otorgados,
        takenDays: round2(tomados),
        pendingDays: round2(enTramite),
        saldoGestion: round2(Math.max(0, otorgados - tomados - enTramite)),
      };
    });

    const computables = acreditaAlInicio ? detalle : detalle.filter((g) => g.cumplida);
    const totalOtorgado = round2(computables.reduce((acc, g) => acc + g.diasAcreditados, 0));
    const totalTomados = round2(detalle.reduce((acc, g) => acc + g.takenDays, 0));
    const totalTramite = round2(detalle.reduce((acc, g) => acc + g.pendingDays, 0));
    const saldoAcumulado = round2(Math.max(0, totalOtorgado - totalTomados - totalTramite));
    const enCurso = detalle.find((g) => !g.cumplida) ?? null;

    return {
      employeeId,
      periodYear: year ?? at.getFullYear(),
      entitledDays: calculator.entitledDays(employee.hireDate, at),
      takenDays: totalTomados,
      pendingDays: totalTramite,
      availableDays: saldoAcumulado,
      yearsOfService: yearsOfService(employee.hireDate, at),
      gestiones: detalle,
      gestionEnCurso: enCurso
        ? { etiqueta: enCurso.etiqueta, fin: enCurso.fin, diasQueOtorgara: enCurso.diasOtorgados }
        : null,
    };
  }
}
