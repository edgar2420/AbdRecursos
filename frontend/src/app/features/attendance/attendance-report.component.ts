import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService, saveBlob } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { apiErrorMessage } from '../../core/interceptors/auth.interceptor';
import {
  AttendanceJustification,
  AttendanceReportRow,
  CatalogItem,
  PageMeta,
} from '../../core/models/api.models';
import {
  CardComponent,
  PageHeaderComponent,
  PaginatorComponent,
  StateComponent,
} from '../../shared/components/ui.components';
import { BadgeClasePipe, EtiquetaPipe, FechaPipe } from '../../shared/pipes/format.pipes';

@Component({
  selector: 'app-attendance-report',
  standalone: true,
  imports: [
    CommonModule,
    PageHeaderComponent,
    CardComponent,
    PaginatorComponent,
    StateComponent,
    FechaPipe,
    EtiquetaPipe,
    BadgeClasePipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <app-page-header title="Asistencia" subtitle="Tardanzas, horas trabajadas y justificaciones del equipo">
        <button class="btn btn-ghost btn-sm" (click)="export('excel')">Exportar Excel</button>
        <button class="btn btn-ghost btn-sm" (click)="export('pdf')">Exportar PDF</button>
      </app-page-header>

      <app-card>
        <div class="filters">
          <div class="field">
            <label>Desde</label>
            <input type="date" [value]="from()" (change)="from.set($any($event.target).value)" />
          </div>
          <div class="field">
            <label>Hasta</label>
            <input type="date" [value]="to()" (change)="to.set($any($event.target).value)" />
          </div>
          <div class="field">
            <label>Departamento</label>
            <select [value]="departmentId()" (change)="departmentId.set($any($event.target).value)">
              <option value="">Todos</option>
              @for (dep of departments(); track dep.id) {
                <option [value]="dep.id">{{ dep.name }}</option>
              }
            </select>
          </div>
          <button class="btn btn-primary btn-sm" (click)="load()">Aplicar</button>
        </div>
      </app-card>

      <app-card heading="Resumen por empleado" [padded]="false">
        @if (loading()) {
          <app-state mode="loading" title="Calculando asistencia"></app-state>
        } @else if (rows().length === 0) {
          <app-state title="Sin datos en el rango" message="Seleccione otro rango de fechas o departamento."></app-state>
        } @else {
          <div class="table-wrap">
            <table class="data">
              <thead>
                <tr>
                  <th>Empleado</th>
                  <th>Departamento</th>
                  <th>Horario</th>
                  <th class="num">Asistidos</th>
                  <th class="num">Tardanzas</th>
                  <th class="num">Min. tarde</th>
                  <th class="num">Faltas</th>
                  <th class="num">Justificadas</th>
                  <th class="num">Horas</th>
                  <th class="num">H. extra</th>
                </tr>
              </thead>
              <tbody>
                @for (row of rows(); track row.employeeId) {
                  <tr>
                    <td>
                      <span class="strong">{{ row.employeeName }}</span>
                      <div class="muted" style="font-size:11.5px">{{ row.employeeCode }}</div>
                    </td>
                    <td>{{ row.departmentName ?? '-' }}</td>
                    <td class="muted">{{ row.scheduleName ?? 'Sin horario' }}</td>
                    <td class="num">{{ row.daysPresent }}</td>
                    <td class="num" [class.warn]="row.daysLate > 0">{{ row.daysLate }}</td>
                    <td class="num">{{ row.totalLateMinutes }}</td>
                    <td class="num" [class.danger]="row.daysAbsent > 0">{{ row.daysAbsent }}</td>
                    <td class="num">{{ row.daysJustified }}</td>
                    <td class="num">{{ row.workedHours }}</td>
                    <td class="num strong">{{ row.overtimeHours }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </app-card>

      <app-card heading="Justificaciones por revisar" [padded]="false">
        @if (justifications().length === 0) {
          <app-state title="No hay justificaciones pendientes" message="Las solicitudes del equipo apareceran aqui."></app-state>
        } @else {
          <div class="table-wrap">
            <table class="data">
              <thead>
                <tr>
                  <th>Empleado</th>
                  <th>Fecha</th>
                  <th>Motivo</th>
                  <th>Respaldo</th>
                  <th>Estado</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                @for (item of justifications(); track item.id) {
                  <tr>
                    <td class="strong">{{ item.employeeName }}</td>
                    <td class="nowrap">{{ item.date | fecha }}</td>
                    <td>{{ item.reason }}</td>
                    <td>
                      @if (item.attachmentUrl) {
                        <a [href]="item.attachmentUrl" target="_blank" rel="noopener">Ver adjunto</a>
                      } @else {
                        <span class="muted">-</span>
                      }
                    </td>
                    <td><span [class]="item.status | badgeClase">{{ item.status | etiqueta }}</span></td>
                    <td class="nowrap text-right">
                      @if (item.status === 'PENDING') {
                        <button class="btn btn-secondary btn-sm" (click)="review(item, 'APPROVED')">Aprobar</button>
                        <button class="btn btn-ghost btn-sm" (click)="review(item, 'REJECTED')">Rechazar</button>
                      }
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
          <app-paginator [meta]="justificationsMeta()" (pageChange)="goToJustificationsPage($event)" />
        }
      </app-card>
    </div>
  `,
  styles: [
    `
      .filters {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        align-items: flex-end;
      }
      .filters .field {
        min-width: 160px;
      }
      .warn {
        color: var(--warn-700);
        font-weight: 600;
      }
      .danger {
        color: var(--danger-700);
        font-weight: 600;
      }
    `,
  ],
})
export class AttendanceReportComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);
  readonly auth = inject(AuthService);

  readonly loading = signal(true);
  readonly rows = signal<AttendanceReportRow[]>([]);
  readonly departments = signal<CatalogItem[]>([]);
  readonly justifications = signal<AttendanceJustification[]>([]);
  readonly justificationsMeta = signal<PageMeta | null>(null);

  readonly from = signal(firstDayOfMonth());
  readonly to = signal(new Date().toISOString().slice(0, 10));
  readonly departmentId = signal('');
  readonly justificationsPage = signal(1);

  ngOnInit(): void {
    this.api.list<CatalogItem>('/employees/departments', { limit: 100 }).subscribe({
      next: (page) => this.departments.set(page.data),
    });
    this.load();
    this.loadJustifications();
  }

  load(): void {
    this.loading.set(true);
    this.api
      .get<AttendanceReportRow[]>('/attendance/report', {
        from: this.from(),
        to: this.to(),
        departmentId: this.departmentId() || undefined,
      })
      .subscribe({
        next: (response) => {
          this.rows.set(response.data);
          this.loading.set(false);
        },
        error: (error) => {
          this.rows.set([]);
          this.loading.set(false);
          this.toast.error('No se pudo generar el reporte', apiErrorMessage(error));
        },
      });
  }

  loadJustifications(): void {
    this.api
      .list<AttendanceJustification>('/attendance/justifications', {
        page: this.justificationsPage(),
        limit: 10,
      })
      .subscribe({
        next: (page) => {
          this.justifications.set(page.data);
          this.justificationsMeta.set(page.meta);
        },
        error: () => this.justifications.set([]),
      });
  }

  goToJustificationsPage(page: number): void {
    this.justificationsPage.set(page);
    this.loadJustifications();
  }

  review(item: AttendanceJustification, status: 'APPROVED' | 'REJECTED'): void {
    this.api.patch(`/attendance/justifications/${item.id}/review`, { status }).subscribe({
      next: () => {
        this.toast.success(status === 'APPROVED' ? 'Justificacion aprobada' : 'Justificacion rechazada');
        this.loadJustifications();
        this.load();
      },
      error: (error) => this.toast.error('No se pudo procesar', apiErrorMessage(error)),
    });
  }

  export(format: 'excel' | 'pdf'): void {
    this.api
      .download('/attendance/report', {
        from: this.from(),
        to: this.to(),
        departmentId: this.departmentId() || undefined,
        format,
      })
      .subscribe({
        next: (response) => saveBlob(response, `reporte-asistencia.${format === 'pdf' ? 'pdf' : 'xlsx'}`),
        error: () => this.toast.error('No se pudo exportar'),
      });
  }
}

function firstDayOfMonth(): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
}
