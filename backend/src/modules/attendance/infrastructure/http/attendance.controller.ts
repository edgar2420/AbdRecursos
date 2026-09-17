import { Response } from 'express';
import { z } from 'zod';
import { AuthenticatedRequest, requireActor } from '../../../../shared/infrastructure/http/types';
import { validated } from '../../../../shared/infrastructure/http/middlewares/validate';
import { buildMeta } from '../../../../shared/domain/pagination';
import { ExcelService } from '../../../../shared/infrastructure/excel/ExcelService';
import { ReportPdfGenerator } from '../../../../shared/infrastructure/pdf/ReportPdfGenerator';
import { RegisterAttendance } from '../../application/use-cases/RegisterAttendance';
import { ListAttendance } from '../../application/use-cases/ListAttendance';
import {
  JustifyAbsence,
  ListJustifications,
  ReviewJustification,
} from '../../application/use-cases/JustifyAbsence';
import { GetAttendanceReport } from '../../application/use-cases/GetAttendanceReport';
import { UpdateAttendanceRecord } from '../../application/use-cases/UpdateAttendanceRecord';
import {
  listAttendanceSchema,
  listJustificationsSchema,
  reportQuerySchema,
  updateAttendanceSchema,
} from './attendance.validators';

const REPORT_COLUMNS = [
  { key: 'employeeCode', header: 'Codigo', width: 70 },
  { key: 'employeeName', header: 'Empleado', width: 160 },
  { key: 'departmentName', header: 'Departamento', width: 120 },
  { key: 'scheduleName', header: 'Horario', width: 110 },
  { key: 'daysPresent', header: 'Asistidos', width: 70, align: 'right' as const },
  { key: 'daysLate', header: 'Tardanzas', width: 70, align: 'right' as const },
  { key: 'daysAbsent', header: 'Faltas', width: 60, align: 'right' as const },
  { key: 'daysJustified', header: 'Justificadas', width: 80, align: 'right' as const },
  { key: 'totalLateMinutes', header: 'Min. tarde', width: 75, align: 'right' as const },
  { key: 'workedHours', header: 'Horas', width: 65, align: 'right' as const },
  { key: 'overtimeHours', header: 'H. extra', width: 65, align: 'right' as const },
];

export class AttendanceController {
  constructor(
    private readonly registerUseCase: RegisterAttendance,
    private readonly listUseCase: ListAttendance,
    private readonly reportUseCase: GetAttendanceReport,
    private readonly updateUseCase: UpdateAttendanceRecord,
    private readonly justifyUseCase: JustifyAbsence,
    private readonly listJustificationsUseCase: ListJustifications,
    private readonly reviewUseCase: ReviewJustification,
    private readonly excel: ExcelService,
    private readonly reportPdf: ReportPdfGenerator,
  ) {}

  list = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const query = validated<z.infer<typeof listAttendanceSchema>>(req, 'query');
    res.json(await this.listUseCase.execute(requireActor(req), query));
  };

  checkIn = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const record = await this.registerUseCase.execute(requireActor(req), { ...req.body, type: 'CHECK_IN' });
    res.status(201).json({ data: record });
  };

  checkOut = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const record = await this.registerUseCase.execute(requireActor(req), { ...req.body, type: 'CHECK_OUT' });
    res.status(201).json({ data: record });
  };

  report = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const query = validated<z.infer<typeof reportQuerySchema>>(req, 'query');
    const isExport = query.format === 'excel' || query.format === 'pdf';
    const { rows, total } = await this.reportUseCase.execute(requireActor(req), {
      ...query,
      page: isExport ? undefined : query.page,
      limit: isExport ? undefined : query.limit,
    });
    const period = `${query.from.toISOString().slice(0, 10)} a ${query.to.toISOString().slice(0, 10)}`;

    if (query.format === 'excel') {
      const buffer = await this.excel.export('Asistencia', REPORT_COLUMNS, rows as never[]);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="reporte-asistencia.xlsx"');
      res.send(buffer);
      return;
    }
    if (query.format === 'pdf') {
      const buffer = await this.reportPdf.render('Reporte de asistencia', period, REPORT_COLUMNS, rows as never[]);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename="reporte-asistencia.pdf"');
      res.send(buffer);
      return;
    }
    res.json({ data: rows, meta: { ...buildMeta(total, query.page, query.limit), period } });
  };

  update = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const body = validated<z.infer<typeof updateAttendanceSchema>>(req, 'body');
    const record = await this.updateUseCase.execute(requireActor(req), req.params.id, body);
    res.json({ data: record });
  };

  createJustification = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    res.status(201).json({ data: await this.justifyUseCase.execute(requireActor(req), req.body) });
  };

  listJustifications = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const query = validated<z.infer<typeof listJustificationsSchema>>(req, 'query');
    res.json(await this.listJustificationsUseCase.execute(requireActor(req), query));
  };

  reviewJustification = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const data = await this.reviewUseCase.execute(
      requireActor(req),
      req.params.id,
      req.body.status,
      req.body.reviewNotes,
    );
    res.json({ data });
  };
}
