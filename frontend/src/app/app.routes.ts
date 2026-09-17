import { Routes } from '@angular/router';
import { authGuard, loginGuard, roleGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    canActivate: [loginGuard],
    loadComponent: () => import('./features/auth/login.component').then((m) => m.LoginComponent),
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./layout/shell.component').then((m) => m.ShellComponent),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/dashboard/dashboard.component').then((m) => m.DashboardComponent),
      },
      {
        path: 'mi-perfil',
        loadComponent: () =>
          import('./features/employees/my-profile.component').then((m) => m.MyProfileComponent),
      },
      {
        path: 'empleados',
        canActivate: [roleGuard('SUPERVISOR', 'HR', 'ADMIN')],
        loadComponent: () =>
          import('./features/employees/employee-list.component').then((m) => m.EmployeeListComponent),
      },
      {
        path: 'empleados/:id',
        canActivate: [roleGuard('SUPERVISOR', 'HR', 'ADMIN')],
        loadComponent: () =>
          import('./features/employees/employee-detail.component').then((m) => m.EmployeeDetailComponent),
      },
      {
        path: 'vacaciones',
        loadComponent: () =>
          import('./features/vacations/vacation-list.component').then((m) => m.VacationListComponent),
      },
      {
        path: 'vacaciones/calendario',
        canActivate: [roleGuard('SUPERVISOR', 'HR', 'ADMIN')],
        loadComponent: () =>
          import('./features/vacations/vacation-calendar.component').then((m) => m.VacationCalendarComponent),
      },
      {
        path: 'papeletas',
        loadComponent: () =>
          import('./features/papeletas/papeleta-list.component').then((m) => m.PapeletaListComponent),
      },
      {
        path: 'boletas',
        loadComponent: () =>
          import('./features/payslips/payslip-list.component').then((m) => m.PayslipListComponent),
      },
      {
        path: 'boletas/:id',
        loadComponent: () =>
          import('./features/payslips/payslip-detail.component').then((m) => m.PayslipDetailComponent),
      },
      {
        path: 'asistencia/marcar',
        loadComponent: () =>
          import('./features/attendance/attendance-clock.component').then((m) => m.AttendanceClockComponent),
      },
      {
        path: 'asistencia',
        canActivate: [roleGuard('SUPERVISOR', 'HR', 'ADMIN')],
        loadComponent: () =>
          import('./features/attendance/attendance-report.component').then((m) => m.AttendanceReportComponent),
      },
      {
        path: 'horarios',
        canActivate: [roleGuard('HR', 'ADMIN')],
        loadComponent: () =>
          import('./features/schedules/schedule-list.component').then((m) => m.ScheduleListComponent),
      },
      {
        path: 'lactancia',
        canActivate: [roleGuard('HR', 'ADMIN')],
        loadComponent: () =>
          import('./features/lactation/lactation-list.component').then((m) => m.LactationListComponent),
      },
      {
        path: 'importaciones',
        canActivate: [roleGuard('HR', 'ADMIN')],
        loadComponent: () =>
          import('./features/imports/import-wizard.component').then((m) => m.ImportWizardComponent),
      },
      {
        path: 'parametros',
        canActivate: [roleGuard('HR', 'ADMIN')],
        loadComponent: () =>
          import('./features/legal-parameters/legal-parameters.component').then(
            (m) => m.LegalParametersComponent,
          ),
      },
      {
        path: 'usuarios',
        canActivate: [roleGuard('ADMIN')],
        loadComponent: () => import('./features/users/user-list.component').then((m) => m.UserListComponent),
      },
      {
        path: 'auditoria',
        canActivate: [roleGuard('ADMIN')],
        loadComponent: () => import('./features/audit/audit-log.component').then((m) => m.AuditLogComponent),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
