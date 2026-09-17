import 'reflect-metadata';
import fs from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import path from 'node:path';
import { Router } from 'express';
import { env } from './shared/infrastructure/config/env';
import { logger } from './shared/infrastructure/logger/logger';
import { disconnectPrisma, prisma } from './shared/infrastructure/database/prisma';
import { createApp } from './shared/infrastructure/http/app';
import { authenticate } from './shared/infrastructure/http/middlewares/authenticate';
import { JwtService } from './shared/infrastructure/security/JwtService';
import { BcryptPasswordHasher } from './shared/infrastructure/security/PasswordHasher';
import { PrismaAuditLogger } from './shared/infrastructure/persistence/PrismaAuditLogger';
import { ExcelService } from './shared/infrastructure/excel/ExcelService';
import { PayslipPdfGenerator } from './shared/infrastructure/pdf/PayslipPdfGenerator';
import { ReportPdfGenerator } from './shared/infrastructure/pdf/ReportPdfGenerator';
import { ZipService } from './shared/infrastructure/storage/ZipService';

import { PrismaUserRepository } from './modules/auth/infrastructure/persistence/PrismaUserRepository';
import { PrismaRefreshTokenRepository } from './modules/auth/infrastructure/persistence/PrismaRefreshTokenRepository';
import { Login } from './modules/auth/application/use-cases/Login';
import { RefreshSession } from './modules/auth/application/use-cases/RefreshSession';
import { Logout } from './modules/auth/application/use-cases/Logout';
import { ChangePassword } from './modules/auth/application/use-cases/ChangePassword';
import {
  CreateUser,
  ListUsers,
  ResetUserPassword,
  SetUserActive,
  UpdateUserRole,
} from './modules/auth/application/use-cases/ManageUsers';
import { AuthController } from './modules/auth/infrastructure/http/auth.controller';
import { authRoutes } from './modules/auth/infrastructure/http/auth.routes';

import { PrismaLegalParameterRepository } from './modules/legal-parameters/infrastructure/persistence/PrismaLegalParameterRepository';
import { GetLegalParameters } from './modules/legal-parameters/application/use-cases/GetLegalParameters';
import {
  CreateLegalParameterVersion,
  ListLegalParameters,
  UpdateLegalParameter,
} from './modules/legal-parameters/application/use-cases/ManageLegalParameters';
import { LegalParameterController } from './modules/legal-parameters/infrastructure/http/legal-parameter.controller';
import { legalParameterRoutes } from './modules/legal-parameters/infrastructure/http/legal-parameter.routes';

import { PrismaEmployeeRepository } from './modules/employees/infrastructure/persistence/PrismaEmployeeRepository';
import { PrismaCatalogRepository } from './modules/employees/infrastructure/persistence/PrismaCatalogRepository';
import { EmployeeAccessPolicy } from './modules/employees/domain/services/EmployeeAccessPolicy';
import { ListEmployees } from './modules/employees/application/use-cases/ListEmployees';
import { GetEmployee } from './modules/employees/application/use-cases/GetEmployee';
import { CreateEmployee } from './modules/employees/application/use-cases/CreateEmployee';
import { UpdateEmployee } from './modules/employees/application/use-cases/UpdateEmployee';
import {
  DeactivateEmployee,
  ReactivateEmployee,
} from './modules/employees/application/use-cases/DeactivateEmployee';
import { GetEmployeeHistory } from './modules/employees/application/use-cases/GetEmployeeHistory';
import { EmployeeController } from './modules/employees/infrastructure/http/employee.controller';
import { employeeRoutes } from './modules/employees/infrastructure/http/employee.routes';
import { EmployeeImportProcessor } from './modules/employees/infrastructure/import/EmployeeImportProcessor';

import {
  PrismaHolidayRepository,
  PrismaVacationRepository,
} from './modules/vacations/infrastructure/persistence/PrismaVacationRepository';
import { LogNotifier } from './modules/vacations/infrastructure/LogNotifier';
import { GetVacationBalance } from './modules/vacations/application/use-cases/GetVacationBalance';
import { RequestVacation } from './modules/vacations/application/use-cases/RequestVacation';
import { ApproveVacation } from './modules/vacations/application/use-cases/ApproveVacation';
import { CancelVacation, RejectVacation } from './modules/vacations/application/use-cases/RejectVacation';
import {
  GetVacationRequest,
  ListVacationRequests,
} from './modules/vacations/application/use-cases/ListVacationRequests';
import { GetTeamCalendar } from './modules/vacations/application/use-cases/GetTeamCalendar';
import { VacationController } from './modules/vacations/infrastructure/http/vacation.controller';
import { vacationRoutes } from './modules/vacations/infrastructure/http/vacation.routes';

import { PrismaPayslipRepository } from './modules/payslips/infrastructure/persistence/PrismaPayslipRepository';
import { GeneratePayslips } from './modules/payslips/application/use-cases/GeneratePayslips';
import { GetPayslip, ListPayslips } from './modules/payslips/application/use-cases/GetPayslip';
import { DownloadPayslipPdf } from './modules/payslips/application/use-cases/DownloadPayslipPdf';
import { BulkPayslipsZip } from './modules/payslips/application/use-cases/BulkPayslipsZip';
import { CancelPayslip, IssuePayslips } from './modules/payslips/application/use-cases/IssuePayslips';
import { CalculateAguinaldo } from './modules/payslips/application/use-cases/CalculateAguinaldo';
import { PayslipController } from './modules/payslips/infrastructure/http/payslip.controller';
import { payslipRoutes } from './modules/payslips/infrastructure/http/payslip.routes';

import { PrismaLactationRepository } from './modules/lactation/infrastructure/persistence/PrismaLactationRepository';
import {
  GetExpiringLactationPermits,
  ListLactationPermits,
  RegisterLactationPermit,
  UpdateLactationPermit,
} from './modules/lactation/application/use-cases/ManageLactationPermits';
import { LactationController } from './modules/lactation/infrastructure/http/lactation.controller';
import { lactationRoutes } from './modules/lactation/infrastructure/http/lactation.routes';

import { PrismaAttendanceRepository } from './modules/attendance/infrastructure/persistence/PrismaAttendanceRepository';
import { RegisterAttendance } from './modules/attendance/application/use-cases/RegisterAttendance';
import { ListAttendance } from './modules/attendance/application/use-cases/ListAttendance';
import {
  JustifyAbsence,
  ListJustifications,
  ReviewJustification,
} from './modules/attendance/application/use-cases/JustifyAbsence';
import { GetAttendanceReport } from './modules/attendance/application/use-cases/GetAttendanceReport';
import { AttendanceController } from './modules/attendance/infrastructure/http/attendance.controller';
import { attendanceRoutes } from './modules/attendance/infrastructure/http/attendance.routes';
import { AttendanceImportProcessor } from './modules/attendance/infrastructure/import/AttendanceImportProcessor';

import { PrismaScheduleRepository } from './modules/schedules/infrastructure/persistence/PrismaScheduleRepository';
import {
  AssignSchedule,
  CreateSchedule,
  EndScheduleAssignment,
  ListScheduleAssignments,
  ListSchedules,
  UpdateSchedule,
} from './modules/schedules/application/use-cases/ManageSchedules';
import { ScheduleController } from './modules/schedules/infrastructure/http/schedule.controller';
import { scheduleRoutes } from './modules/schedules/infrastructure/http/schedule.routes';
import { ScheduleImportProcessor } from './modules/schedules/infrastructure/import/ScheduleImportProcessor';

import { PrismaImportRepository } from './modules/imports/infrastructure/persistence/PrismaImportRepository';
import { ImportProcessor } from './modules/imports/domain/ports/ImportProcessor';
import { ImportType } from './modules/imports/domain/entities/ImportLog';
import { UploadImportFile } from './modules/imports/application/use-cases/UploadImportFile';
import { ConfirmImport } from './modules/imports/application/use-cases/ConfirmImport';
import {
  DownloadImportLog,
  DownloadImportTemplate,
  GetImportPreview,
  ListImports,
} from './modules/imports/application/use-cases/ListImports';
import { ImportController } from './modules/imports/infrastructure/http/import.controller';
import { importRoutes } from './modules/imports/infrastructure/http/import.routes';

import { PrismaPapeletaRepository } from './modules/papeletas/infrastructure/persistence/PrismaPapeletaRepository';
import { HmacSelloDeFirma } from './modules/papeletas/infrastructure/HmacSelloDeFirma';
import { CrearPapeleta } from './modules/papeletas/application/use-cases/CrearPapeleta';
import { FirmarPapeleta, RechazarPapeleta } from './modules/papeletas/application/use-cases/FirmarPapeleta';
import {
  AnularPapeleta,
  ListarPapeletas,
  ObtenerPapeleta,
} from './modules/papeletas/application/use-cases/ConsultarPapeletas';
import { PapeletaController } from './modules/papeletas/infrastructure/http/papeleta.controller';
import { papeletaRoutes } from './modules/papeletas/infrastructure/http/papeleta.routes';
import { PapeletaPdfGenerator } from './shared/infrastructure/pdf/PapeletaPdfGenerator';
import { LocalFileStorage } from './shared/infrastructure/storage/LocalFileStorage';
import { UploadController } from './shared/infrastructure/http/upload.controller';
import { uploadRoutes } from './shared/infrastructure/http/upload.routes';

import { PrismaReportRepository } from './modules/reports/infrastructure/persistence/PrismaReportRepository';
import { GetDashboard } from './modules/reports/application/use-cases/GetDashboard';
import { GetHeadcountReport, GetPayrollReport } from './modules/reports/application/use-cases/GetReports';
import { ReportController } from './modules/reports/infrastructure/http/report.controller';
import { reportRoutes } from './modules/reports/infrastructure/http/report.routes';

export function buildApiRouter(): Router {
  const tokens = new JwtService();
  const hasher = new BcryptPasswordHasher();
  const audit = new PrismaAuditLogger();
  const excel = new ExcelService();
  const payslipPdf = new PayslipPdfGenerator();
  const reportPdf = new ReportPdfGenerator();
  const zip = new ZipService();
  const auth = authenticate(tokens);

  const users = new PrismaUserRepository();
  const refreshTokens = new PrismaRefreshTokenRepository();
  const legalParameters = new PrismaLegalParameterRepository();
  const employees = new PrismaEmployeeRepository();
  const catalogs = new PrismaCatalogRepository();
  const vacations = new PrismaVacationRepository();
  const holidays = new PrismaHolidayRepository();
  const payslips = new PrismaPayslipRepository();
  const lactation = new PrismaLactationRepository();
  const attendance = new PrismaAttendanceRepository();
  const schedules = new PrismaScheduleRepository();
  const imports = new PrismaImportRepository();
  const reports = new PrismaReportRepository();
  const papeletas = new PrismaPapeletaRepository();

  const policy = new EmployeeAccessPolicy(employees);
  const parameters = new GetLegalParameters(legalParameters);
  const notifier = new LogNotifier();

  const authController = new AuthController(
    new Login(users, refreshTokens, hasher, tokens, audit),
    new RefreshSession(users, refreshTokens, tokens),
    new Logout(refreshTokens, tokens),
    new ChangePassword(users, refreshTokens, hasher, audit),
    new ListUsers(users),
    new CreateUser(users, hasher, audit),
    new UpdateUserRole(users, refreshTokens, audit),
    new SetUserActive(users, refreshTokens, audit),
    new ResetUserPassword(users, refreshTokens, hasher, audit),
    users,
  );

  const employeeController = new EmployeeController(
    new ListEmployees(employees, policy),
    new GetEmployee(employees, policy),
    new CreateEmployee(employees, policy, audit),
    new UpdateEmployee(employees, policy, audit),
    new DeactivateEmployee(employees, policy, audit),
    new ReactivateEmployee(employees, policy, audit),
    new GetEmployeeHistory(employees, policy),
    employees,
    catalogs,
    excel,
    reportPdf,
  );

  const balance = new GetVacationBalance(employees, vacations, parameters, policy);
  const vacationController = new VacationController(
    new RequestVacation(employees, vacations, holidays, parameters, policy, balance, audit, notifier),
    new ApproveVacation(vacations, employees, users, parameters, policy, audit, notifier),
    new RejectVacation(vacations, employees, policy, audit, notifier),
    new CancelVacation(vacations, policy, audit),
    new ListVacationRequests(vacations, policy),
    new GetVacationRequest(vacations, policy),
    balance,
    new GetTeamCalendar(vacations, policy),
  );

  const getPayslip = new GetPayslip(payslips, policy);
  const downloadPayslipPdf = new DownloadPayslipPdf(getPayslip, employees, payslipPdf, audit);
  const payslipController = new PayslipController(
    new GeneratePayslips(payslips, employees, parameters, policy, audit),
    getPayslip,
    new ListPayslips(payslips, policy),
    downloadPayslipPdf,
    new BulkPayslipsZip(payslips, downloadPayslipPdf, payslipPdf, zip, policy, audit),
    new IssuePayslips(payslips, policy, audit),
    new CancelPayslip(payslips, policy, audit),
    new CalculateAguinaldo(employees, parameters, policy),
  );

  const lactationController = new LactationController(
    new ListLactationPermits(lactation, policy),
    new RegisterLactationPermit(lactation, employees, parameters, policy, audit),
    new UpdateLactationPermit(lactation, parameters, policy, audit),
    new GetExpiringLactationPermits(lactation, parameters, policy),
  );

  const attendanceController = new AttendanceController(
    new RegisterAttendance(attendance, schedules, parameters, policy, audit),
    new ListAttendance(attendance, policy),
    new GetAttendanceReport(attendance, employees, schedules, parameters, policy),
    new JustifyAbsence(attendance, policy, audit),
    new ListJustifications(attendance, policy),
    new ReviewJustification(attendance, policy, audit),
    excel,
    reportPdf,
  );

  const scheduleController = new ScheduleController(
    new ListSchedules(schedules),
    new CreateSchedule(schedules, policy, audit),
    new UpdateSchedule(schedules, policy, audit),
    new AssignSchedule(schedules, policy, audit),
    new ListScheduleAssignments(schedules, policy),
    new EndScheduleAssignment(schedules, policy, audit),
  );

  const processors = new Map<ImportType, ImportProcessor>([
    ['EMPLOYEES', new EmployeeImportProcessor(employees, catalogs)],
    ['ATTENDANCE', new AttendanceImportProcessor(attendance, employees)],
    ['SCHEDULES', new ScheduleImportProcessor(schedules, employees)],
  ]);
  const importController = new ImportController(
    new UploadImportFile(imports, processors, excel, policy, audit),
    new ConfirmImport(imports, processors, policy, audit),
    new ListImports(imports, policy),
    new GetImportPreview(imports, policy),
    new DownloadImportLog(imports, processors, excel, policy),
    new DownloadImportTemplate(processors, excel, policy),
  );

  const fileStorage = new LocalFileStorage();
  const uploadController = new UploadController(fileStorage);

  const papeletaPdf = new PapeletaPdfGenerator();
  const sello = new HmacSelloDeFirma();
  const papeletaController = new PapeletaController(
    new CrearPapeleta(papeletas, employees, parameters, policy, audit, notifier),
    new FirmarPapeleta(papeletas, employees, parameters, policy, sello, audit, notifier),
    new RechazarPapeleta(papeletas, employees, policy, audit, notifier),
    new ListarPapeletas(papeletas, policy),
    new ObtenerPapeleta(papeletas, policy),
    new AnularPapeleta(papeletas, policy),
    papeletaPdf,
    fileStorage,
  );

  const reportController = new ReportController(
    new GetDashboard(reports, policy),
    new GetHeadcountReport(reports, policy),
    new GetPayrollReport(reports, policy),
  );

  const router = Router();
  router.use('/auth', authRoutes(authController, auth));
  router.use('/employees', auth, employeeRoutes(employeeController));
  router.use('/vacations', auth, vacationRoutes(vacationController));
  router.use('/payslips', auth, payslipRoutes(payslipController));
  router.use('/lactation', auth, lactationRoutes(lactationController));
  router.use('/attendance', auth, attendanceRoutes(attendanceController));
  router.use('/schedules', auth, scheduleRoutes(scheduleController));
  router.use('/imports', auth, importRoutes(importController));
  router.use('/papeletas', auth, papeletaRoutes(papeletaController));
  router.use('/uploads', auth, uploadRoutes(uploadController));
  router.use('/reports', auth, reportRoutes(reportController));
  router.use('/legal-parameters', auth, legalParameterRoutes(
    new LegalParameterController(
      new ListLegalParameters(legalParameters),
      new CreateLegalParameterVersion(legalParameters, parameters, audit),
      new UpdateLegalParameter(legalParameters, parameters, audit),
      parameters,
    ),
  ));

  return router;
}

function crearServidor(app: ReturnType<typeof createApp>) {
  if (!env.HTTPS_ENABLED) return http.createServer(app);

  const key = fs.readFileSync(path.resolve(env.HTTPS_KEY_PATH));
  const cert = fs.readFileSync(path.resolve(env.HTTPS_CERT_PATH));
  return https.createServer({ key, cert }, app);
}

async function bootstrap(): Promise<void> {
  await prisma.$connect();
  const app = createApp(buildApiRouter());
  const server = crearServidor(app);
  const protocolo = env.HTTPS_ENABLED ? 'https' : 'http';

  server.listen(env.PORT, () => {
    logger.info(
      { port: env.PORT, env: env.NODE_ENV, docs: `${protocolo}://localhost:${env.PORT}/docs` },
      `SGRH API iniciada por ${protocolo.toUpperCase()}`,
    );
  });

  const shutdown = async (signal: string): Promise<void> => {
    logger.info({ signal }, 'Cerrando la API');
    server.close(async () => {
      await disconnectPrisma();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

if (require.main === module) {
  bootstrap().catch((error) => {
    logger.error({ err: error }, 'No se pudo iniciar la API');
    process.exit(1);
  });
}
