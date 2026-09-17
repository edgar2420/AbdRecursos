import { ColumnSpec } from '../../../../shared/infrastructure/excel/ExcelService';
import { ImportRow, ImportType } from '../../../imports/domain/entities/ImportLog';
import { ImportProcessor, RowValidation } from '../../../imports/domain/ports/ImportProcessor';
import { CatalogRepository } from '../../domain/repositories/CatalogRepository';
import { EmployeeRepository } from '../../domain/repositories/EmployeeRepository';
import { ContractType } from '../../domain/entities/Employee';
import { CI } from '../../domain/value-objects/CI';
import { Salary } from '../../domain/value-objects/Salary';
import { EMPLOYEE_IMPORT_COLUMNS } from './employee-import.columns';

const CONTRACT_TYPES = ['INDEFINIDO', 'PLAZO_FIJO', 'EVENTUAL', 'CONSULTORIA'];

export function parseSheetDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  const raw = String(value).trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
  const local = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(raw);
  if (local) return new Date(Number(local[3]), Number(local[2]) - 1, Number(local[1]));
  return null;
}

export function text(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const trimmed = String(value).trim();
  return trimmed === '' ? null : trimmed;
}

export class EmployeeImportProcessor implements ImportProcessor {
  readonly type: ImportType = 'EMPLOYEES';
  readonly sheetName = 'Empleados';
  readonly columns: ColumnSpec[] = EMPLOYEE_IMPORT_COLUMNS;

  private departments = new Map<string, string>();
  private positions = new Map<string, string>();
  private supervisors = new Map<string, string>();
  private existingCi = new Set<string>();
  private ciInFile = new Set<string>();

  constructor(
    private readonly employees: EmployeeRepository,
    private readonly catalogs: CatalogRepository,
  ) {}

  async prepare(): Promise<void> {
    const [departments, positions, roster] = await Promise.all([
      this.catalogs.listDepartments({ page: 1, limit: 500, order: 'asc' }),
      this.catalogs.listPositions({ page: 1, limit: 500, order: 'asc' }),
      this.employees.listAll({}),
    ]);
    this.departments = new Map(departments.data.map((d) => [d.name.toLowerCase(), d.id]));
    this.positions = new Map(positions.data.map((p) => [p.name.toLowerCase(), p.id]));
    this.supervisors = new Map(roster.map((e) => [e.employeeCode.toLowerCase(), e.id]));
    this.existingCi = new Set(roster.map((e) => e.ci));
    this.ciInFile = new Set();
  }

  async validateRow(raw: Record<string, unknown>): Promise<RowValidation> {
    const errors: string[] = [];
    const data: Record<string, unknown> = {};

    const firstName = text(raw.firstName);
    const lastName = text(raw.lastName);
    if (!firstName) errors.push('Nombres es obligatorio');
    if (!lastName) errors.push('Apellidos es obligatorio');
    data.firstName = firstName;
    data.lastName = lastName;

    const rawCi = text(raw.ci);
    if (!rawCi) {
      errors.push('CI es obligatorio');
    } else {
      try {
        const ci = CI.create(rawCi).value;
        if (this.existingCi.has(ci)) errors.push(`Ya existe un empleado con C.I. ${ci}`);
        if (this.ciInFile.has(ci)) errors.push(`C.I. ${ci} repetido dentro del archivo`);
        this.ciInFile.add(ci);
        data.ci = ci;
      } catch (error) {
        errors.push((error as Error).message);
      }
    }
    data.ciExtension = text(raw.ciExtension);

    const hireDate = parseSheetDate(raw.hireDate);
    if (!hireDate) errors.push('Fecha de ingreso invalida (use AAAA-MM-DD)');
    data.hireDate = hireDate ? hireDate.toISOString() : null;

    const birthDate = parseSheetDate(raw.birthDate);
    data.birthDate = birthDate ? birthDate.toISOString() : null;

    try {
      data.baseSalary = Salary.create(String(raw.baseSalary ?? '')).amount;
    } catch {
      errors.push('Haber basico invalido');
    }

    const contractType = (text(raw.contractType) ?? 'INDEFINIDO').toUpperCase();
    if (!CONTRACT_TYPES.includes(contractType)) {
      errors.push(`Tipo de contrato invalido: ${contractType}`);
    }
    data.contractType = contractType;

    const departmentName = text(raw.department);
    if (departmentName) {
      const id = this.departments.get(departmentName.toLowerCase());
      if (!id) errors.push(`El departamento "${departmentName}" no existe en el catalogo`);
      data.departmentId = id ?? null;
    }
    const positionName = text(raw.position);
    if (positionName) {
      const id = this.positions.get(positionName.toLowerCase());
      if (!id) errors.push(`El cargo "${positionName}" no existe en el catalogo`);
      data.positionId = id ?? null;
    }
    const supervisorCode = text(raw.supervisorCode);
    if (supervisorCode) {
      const id = this.supervisors.get(supervisorCode.toLowerCase());
      if (!id) errors.push(`No existe un empleado con codigo ${supervisorCode}`);
      data.supervisorId = id ?? null;
    }

    const email = text(raw.email);
    if (email && !/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(email)) {
      errors.push(`Correo invalido: ${email}`);
    }
    data.email = email;

    data.gender = text(raw.gender);
    data.phone = text(raw.phone);
    data.address = text(raw.address);
    data.bankName = text(raw.bankName);
    data.bankAccount = text(raw.bankAccount);
    data.afpName = text(raw.afpName);
    data.afpNumber = text(raw.afpNumber);
    data.emergencyContactName = text(raw.emergencyContactName);
    data.emergencyContactPhone = text(raw.emergencyContactPhone);

    return { isValid: errors.length === 0, errors, data };
  }

  async processRows(rows: ImportRow[], actorId: string): Promise<{ processed: number; errors: string[] }> {
    let processed = 0;
    const errors: string[] = [];

    for (const row of rows) {
      const data = row.data;
      try {
        const employee = await this.employees.create({
          employeeCode: await this.employees.nextEmployeeCode(),
          firstName: String(data.firstName),
          lastName: String(data.lastName),
          ci: String(data.ci),
          ciExtension: (data.ciExtension as string) ?? null,
          birthDate: data.birthDate ? new Date(String(data.birthDate)) : null,
          gender: (data.gender as string) ?? null,
          email: (data.email as string) ?? null,
          phone: (data.phone as string) ?? null,
          address: (data.address as string) ?? null,
          hireDate: new Date(String(data.hireDate)),
          contractType: data.contractType as ContractType,
          baseSalary: Number(data.baseSalary),
          bankName: (data.bankName as string) ?? null,
          bankAccount: (data.bankAccount as string) ?? null,
          afpName: (data.afpName as string) ?? null,
          afpNumber: (data.afpNumber as string) ?? null,
          emergencyContactName: (data.emergencyContactName as string) ?? null,
          emergencyContactPhone: (data.emergencyContactPhone as string) ?? null,
          departmentId: (data.departmentId as string) ?? null,
          positionId: (data.positionId as string) ?? null,
          supervisorId: (data.supervisorId as string) ?? null,
        });
        await this.employees.addHistory({
          employeeId: employee.id,
          changeType: 'HIRE',
          effectiveDate: employee.hireDate,
          newValue: 'Alta por importacion masiva',
          changedBy: actorId,
        });
        processed++;
      } catch (error) {
        errors.push(`Fila ${row.rowNumber}: ${(error as Error).message}`);
      }
    }

    return { processed, errors };
  }
}
