import { NotFoundError } from '../../../../shared/domain/errors';
import { EmployeeRepository } from '../../../employees/domain/repositories/EmployeeRepository';
import { AccessActor, EmployeeAccessPolicy } from '../../../employees/domain/services/EmployeeAccessPolicy';
import { GetLegalParameters } from '../../../legal-parameters/application/use-cases/GetLegalParameters';
import { AguinaldoCalculator, AguinaldoResult } from '../../domain/services/AguinaldoCalculator';

export interface AguinaldoRow extends AguinaldoResult {
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  baseSalary: number;
}

/** Vista previa del aguinaldo de la gestion (6.3) antes de incluirlo en la boleta. */
export class CalculateAguinaldo {
  constructor(
    private readonly employees: EmployeeRepository,
    private readonly parameters: GetLegalParameters,
    private readonly policy: EmployeeAccessPolicy,
  ) {}

  async execute(actor: AccessActor, year: number, employeeId?: string): Promise<AguinaldoRow[]> {
    this.policy.assertCanManage(actor);
    const reference = new Date(year, 11, 20);
    const calculator = new AguinaldoCalculator(await this.parameters.execute(reference));

    const roster = employeeId
      ? [await this.employees.findById(employeeId)]
      : await this.employees.listAll({ isActive: true });

    return roster.filter(Boolean).map((employee) => {
      if (!employee) throw new NotFoundError('Empleado');
      return {
        employeeId: employee.id,
        employeeName: employee.fullName,
        employeeCode: employee.employeeCode,
        baseSalary: employee.baseSalary,
        ...calculator.calculate(employee.baseSalary, employee.hireDate, year),
      };
    });
  }
}
