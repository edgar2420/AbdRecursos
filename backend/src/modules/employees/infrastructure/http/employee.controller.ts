import { Response } from 'express';
import { z } from 'zod';
import { AuthenticatedRequest, requireActor } from '../../../../shared/infrastructure/http/types';
import { validated } from '../../../../shared/infrastructure/http/middlewares/validate';
import { ExcelService } from '../../../../shared/infrastructure/excel/ExcelService';
import { ReportPdfGenerator } from '../../../../shared/infrastructure/pdf/ReportPdfGenerator';
import { ListEmployees } from '../../application/use-cases/ListEmployees';
import { GetEmployee } from '../../application/use-cases/GetEmployee';
import { CreateEmployee } from '../../application/use-cases/CreateEmployee';
import { UpdateEmployee } from '../../application/use-cases/UpdateEmployee';
import { DeactivateEmployee, ReactivateEmployee } from '../../application/use-cases/DeactivateEmployee';
import { GetEmployeeHistory } from '../../application/use-cases/GetEmployeeHistory';
import { EmployeeRepository } from '../../domain/repositories/EmployeeRepository';
import { CatalogRepository } from '../../domain/repositories/CatalogRepository';
import { EMPLOYEE_IMPORT_COLUMNS } from '../import/employee-import.columns';
import { listEmployeesSchema } from './employee.validators';

const EXPORT_COLUMNS = [
  { key: 'employeeCode', header: 'Codigo', width: 60 },
  { key: 'fullName', header: 'Empleado', width: 150 },
  { key: 'ci', header: 'C.I.', width: 80 },
  { key: 'departmentName', header: 'Departamento', width: 120 },
  { key: 'positionName', header: 'Cargo', width: 120 },
  { key: 'contractType', header: 'Contrato', width: 90 },
  { key: 'hireDateLabel', header: 'Ingreso', width: 80 },
  { key: 'baseSalary', header: 'Haber basico', width: 90, align: 'right' as const },
  { key: 'status', header: 'Estado', width: 80 },
];

export class EmployeeController {
  constructor(
    private readonly listUseCase: ListEmployees,
    private readonly getUseCase: GetEmployee,
    private readonly createUseCase: CreateEmployee,
    private readonly updateUseCase: UpdateEmployee,
    private readonly deactivateUseCase: DeactivateEmployee,
    private readonly reactivateUseCase: ReactivateEmployee,
    private readonly historyUseCase: GetEmployeeHistory,
    private readonly employees: EmployeeRepository,
    private readonly catalogs: CatalogRepository,
    private readonly excel: ExcelService,
    private readonly reportPdf: ReportPdfGenerator,
  ) {}

  list = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const query = validated<z.infer<typeof listEmployeesSchema>>(req, 'query');
    res.json(await this.listUseCase.execute(requireActor(req), query));
  };

  get = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    res.json({ data: await this.getUseCase.execute(requireActor(req), req.params.id) });
  };

  create = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const created = await this.createUseCase.execute(requireActor(req), req.body);
    res.status(201).json({ data: created });
  };

  update = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    res.json({ data: await this.updateUseCase.execute(requireActor(req), req.params.id, req.body) });
  };

  deactivate = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    await this.deactivateUseCase.execute(requireActor(req), req.params.id, req.body ?? {});
    res.status(204).send();
  };

  reactivate = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    res.json({ data: await this.reactivateUseCase.execute(requireActor(req), req.params.id) });
  };

  history = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const query = validated<{ page: number; limit: number }>(req, 'query');
    res.json(await this.historyUseCase.execute(requireActor(req), req.params.id, query as never));
  };

  /** Plantilla de carga masiva (2.1 / 2.8). */
  template = async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
    const buffer = await this.excel.buildTemplate('Empleados', EMPLOYEE_IMPORT_COLUMNS);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="plantilla-empleados.xlsx"');
    res.send(buffer);
  };

  export = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const query = validated<z.infer<typeof listEmployeesSchema>>(req, 'query');
    const page = await this.listUseCase.execute(actor, { ...query, page: 1, limit: 1000 });
    const rows = page.data.map((e) => ({
      ...e,
      hireDateLabel: e.hireDate.toISOString().slice(0, 10),
      baseSalary: e.baseSalary.toFixed(2),
    }));

    if (req.query.format === 'pdf') {
      const buffer = await this.reportPdf.render('Nomina de empleados', `${rows.length} registros`, EXPORT_COLUMNS, rows);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename="empleados.pdf"');
      res.send(buffer);
      return;
    }

    const buffer = await this.excel.export('Empleados', EXPORT_COLUMNS, rows);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="empleados.xlsx"');
    res.send(buffer);
  };

  // --- catalogos ---
  listDepartments = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    res.json(await this.catalogs.listDepartments(validated(req, 'query')));
  };

  createDepartment = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    res.status(201).json({ data: await this.catalogs.createDepartment(req.body) });
  };

  updateDepartment = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    res.json({ data: await this.catalogs.updateDepartment(req.params.id, req.body) });
  };

  listPositions = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    res.json(await this.catalogs.listPositions(validated(req, 'query')));
  };

  createPosition = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    res.status(201).json({ data: await this.catalogs.createPosition(req.body) });
  };

  updatePosition = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    res.json({ data: await this.catalogs.updatePosition(req.params.id, req.body) });
  };

  /** Lista compacta para selects (supervisores, asignaciones). */
  options = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const all = await this.employees.listAll({ isActive: true });
    res.json({
      data: all.map((e) => ({
        id: e.id,
        label: `${e.fullName} (${e.employeeCode})`,
        departmentId: e.departmentId,
      })),
    });
  };
}
