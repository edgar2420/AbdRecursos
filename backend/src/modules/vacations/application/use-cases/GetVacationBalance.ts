import { NotFoundError } from '../../../../shared/domain/errors';
import { yearsOfService } from '../../../../shared/domain/dates';
import { round2 } from '../../../../shared/domain/money';
import { EmployeeRepository } from '../../../employees/domain/repositories/EmployeeRepository';
import { AccessActor, EmployeeAccessPolicy } from '../../../employees/domain/services/EmployeeAccessPolicy';
import { GetLegalParameters } from '../../../legal-parameters/application/use-cases/GetLegalParameters';
import { VacationBalance, GestionBalance } from '../../domain/entities/VacationRequest';
import { VacationRepository } from '../../domain/repositories/VacationRepository';
import { VacationCalculator } from '../../domain/services/VacationCalculator';

/**
 * Saldo de vacaciones tal como lo lleva Recursos Humanos: una fila por gestion
 * (el anio de servicio entre aniversarios de ingreso), con los dias que otorga
 * cada una, los que se tomaron y lo que quedo pendiente.
 *
 * Lo no tomado NO se pierde: se acumula. El saldo disponible es la suma de los
 * pendientes de todas las gestiones ya cumplidas.
 */
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
    // Lo que ya se habia tomado antes de migrar al sistema, por gestion.
    const historico = new Map(
      (await this.vacations.historicalGestiones(employeeId)).map((h) => [h.periodYear, h.takenDays]),
    );

    const detalle: GestionBalance[] = gestiones.map((g) => {
      // Cada solicitud se imputa a la gestion en la que empieza.
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
    // OJO: el saldo se resta de forma global (todo lo otorgado menos todo lo
    // tomado/en tramite, sin importar en que gestion cayo cada solicitud), no
    // sumando el saldo ya recortado por gestion. Sumar saldoGestion (que cada
    // fila trunca en 0) hacia perder el descuento cuando la solicitud caia en
    // la gestion en curso: esa fila daba otorgados=0, entonces "0 - tomado"
    // quedaba en 0 en vez de descontarse del saldo acumulado de gestiones
    // anteriores, y el empleado veia el mismo saldo disponible sin importar
    // cuanto pidiera.
    const saldoAcumulado = round2(Math.max(0, totalOtorgado - totalTomados - totalTramite));
    const enCurso = detalle.find((g) => !g.cumplida) ?? null;

    return {
      employeeId,
      periodYear: year ?? at.getFullYear(),
      // Lo que otorga su gestion vigente, para mostrar "le corresponden N dias por gestion".
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
