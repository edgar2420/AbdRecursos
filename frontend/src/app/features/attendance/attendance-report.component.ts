import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { ZkSyncButtonComponent } from '../../shared/components/zk-sync-button.component';
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
  PageHeaderComponent,
  PaginatorComponent,
  StateComponent,
} from '../../shared/components/ui.components';
import { BadgeClasePipe, EtiquetaPipe, FechaPipe } from '../../shared/pipes/format.pipes';
import { MarcacionesEmpleadoComponent } from './marcaciones-empleado.component';
import { formatoHoras, formatoMinutos } from './asistencia-formato';
import { duracionConSigno } from '../../shared/components/banco-horas.component';

@Component({
  selector: 'app-attendance-report',
  standalone: true,
  imports: [
    ZkSyncButtonComponent,
    CommonModule,
    PageHeaderComponent,
    PaginatorComponent,
    MarcacionesEmpleadoComponent,
    StateComponent,
    FechaPipe,
    EtiquetaPipe,
    BadgeClasePipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <app-page-header title="Asistencia" subtitle="Tardanzas, horas trabajadas y justificaciones del equipo">
        @if (auth.isHr()) {
          <app-zk-sync modo="marcaciones" etiqueta="Traer marcaciones del reloj" (completado)="load()" />
        }
        <button class="btn btn-export btn-excel" (click)="export('excel')">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
            <path d="M14 2v6h6" />
            <path d="m9.5 12.5 5 5M14.5 12.5l-5 5" />
          </svg>
          Exportar Excel
        </button>
        <button class="btn btn-export btn-pdf" (click)="export('pdf')">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
            <path d="M14 2v6h6" />
            <path d="M9 13h1.5a1.5 1.5 0 0 1 0 3H9v-3Zm0 3v2" />
            <path d="M13.5 18v-5h2M13.5 15.5h1.7" />
            <path d="M18 13v5h1.2a1 1 0 0 0 1-1v-3a1 1 0 0 0-1-1H18Z" />
          </svg>
          Exportar PDF
        </button>
      </app-page-header>

      <section class="card">
        <div class="pestanas" role="tablist" aria-label="Secciones de asistencia">
          <button type="button" role="tab" [attr.aria-selected]="pestana() === 'resumen'" (click)="pestana.set('resumen')">
            Resumen por empleado
          </button>
          <button type="button" role="tab" [attr.aria-selected]="pestana() === 'justificaciones'" (click)="pestana.set('justificaciones')">
            Justificaciones
            @if (pendientes() > 0) {
              <span class="contador" [attr.aria-label]="pendientes() + ' pendientes'">{{ pendientes() }}</span>
            }
          </button>
        </div>

        @if (pestana() === 'resumen') {
          <div class="filters">
            <div class="field">
              <label for="desde">Desde</label>
              <input id="desde" type="date" [value]="from()" (change)="from.set($any($event.target).value); page.set(1); load()" />
            </div>
            <div class="field">
              <label for="hasta">Hasta</label>
              <input id="hasta" type="date" [value]="to()" (change)="to.set($any($event.target).value); page.set(1); load()" />
            </div>
            <div class="field">
              <label for="departamento">Departamento</label>
              <select id="departamento" (change)="departmentId.set($any($event.target).value); page.set(1); load()">
                <option value="">Todos</option>
                @for (dep of departments(); track dep.id) {
                  <option [value]="dep.id" [selected]="dep.id === departmentId()">{{ dep.name }}</option>
                }
              </select>
            </div>
            <div class="field flex-1">
              <label for="buscar">Buscar</label>
              <input id="buscar" type="search" placeholder="Nombre, apellido o codigo" [value]="search()" (input)="setSearch($any($event.target).value)" />
            </div>
          </div>
          <p class="ayuda">
            Haga clic en un empleado para ver sus entradas y salidas dia por dia{{ auth.isHr() ? ' y corregirlas' : '' }}.
          </p>

          @if (loading()) {
            <app-state mode="loading" title="Calculando asistencia"></app-state>
          } @else if (rows().length === 0) {
            <app-state title="Sin datos en el rango" message="Ajuste las fechas, el departamento o la busqueda."></app-state>
          } @else {
            <div class="table-wrap">
              <table class="data resumen">
                <thead>
                  <tr>
                    <th>Empleado</th>
                    <th>Horario</th>
                    <th class="num">Dias trabajados</th>
                    <th class="num">Llegadas tarde</th>
                    <th class="num">Faltas</th>
                    <th class="num">Horas trabajadas</th>
                    <th class="num" title="Detectadas por el reloj. Solo suman al banco si tienen papeleta aprobada.">Extra (reloj)</th>
                    <th class="num">Banco de horas</th>
                    <th><span class="visually-hidden">Detalle</span></th>
                  </tr>
                </thead>
                <tbody>
                  @for (row of rows(); track row.employeeId) {
                    <tr class="fila" tabindex="0" (click)="seleccionado.set(row)" (keydown.enter)="seleccionado.set(row)">
                      <td>
                        <span class="strong">{{ row.employeeName }}</span>
                        <div class="muted text-sm">{{ row.employeeCode }} · {{ row.departmentName ?? 'Sin departamento' }}</div>
                      </td>
                      <td>
                        @if (row.scheduleName) {
                          <span class="horario">{{ row.scheduleName }}</span>
                        } @else {
                          <span class="sin-horario" title="Sin horario no se calculan tardanzas. Asignelo en Horarios y turnos.">Sin horario</span>
                        }
                      </td>
                      <td class="num">
                        {{ row.daysPresent || '—' }}
                        @if (row.daysIncomplete > 0) {
                          <div class="incompletos" title="Dias con entrada sin salida, o salida sin entrada">
                            {{ row.daysIncomplete }} incompleto{{ row.daysIncomplete === 1 ? '' : 's' }}
                          </div>
                        }
                      </td>
                      <td class="num">
                        @if (row.daysLate > 0) {
                          <span class="warn">{{ row.daysLate }}</span>
                          <div class="muted text-sm">{{ minutos(row.totalLateMinutes) }}</div>
                        } @else {
                          <span class="muted">—</span>
                        }
                      </td>
                      <td class="num">
                        @if (row.daysAbsent > 0) {
                          <span class="danger">{{ row.daysAbsent }}</span>
                        } @else {
                          <span class="muted">—</span>
                        }
                        @if (row.daysJustified > 0) {
                          <div class="muted text-sm">{{ row.daysJustified }} justificada{{ row.daysJustified === 1 ? '' : 's' }}</div>
                        }
                      </td>
                      <td class="num">{{ horas(row.workedHours) }}</td>
                      <td class="num" [class.strong]="row.overtimeHours > 0">{{ horas(row.overtimeHours) }}</td>
                      <td class="num">
                        @if (saldos().get(row.employeeId); as s) {
                          <span [class.saldo-favor]="s > 0" [class.saldo-debe]="s < 0">{{ s < 0 ? 'Debe ' + duracion(-s) : duracion(s) }}</span>
                        } @else {
                          <span class="muted">—</span>
                        }
                      </td>
                      <td class="ver" aria-hidden="true">
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6" /></svg>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
            <app-paginator [meta]="meta()" (pageChange)="goToPage($event)" (limitChange)="setLimit($event)" />
          }
        } @else {
          @if (justifications().length === 0) {
            <app-state title="No hay justificaciones" message="Las solicitudes del equipo apareceran aqui."></app-state>
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
        }
      </section>

      @if (seleccionado(); as fila) {
        <app-marcaciones-empleado
          [fila]="fila"
          [desde]="from()"
          [hasta]="to()"
          [puedeEditar]="auth.isHr()"
          (cerrado)="seleccionado.set(null)"
          (cambiado)="load()"
        />
      }
    </div>
  `,
  styleUrl: './attendance-report.component.scss',
})
export class AttendanceReportComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);
  readonly auth = inject(AuthService);

  readonly loading = signal(true);
  readonly rows = signal<AttendanceReportRow[]>([]);
  readonly meta = signal<PageMeta | null>(null);
  readonly departments = signal<CatalogItem[]>([]);
  readonly justifications = signal<AttendanceJustification[]>([]);
  readonly justificationsMeta = signal<PageMeta | null>(null);

  readonly from = signal(firstDayOfMonth());
  readonly to = signal(new Date().toISOString().slice(0, 10));
  readonly departmentId = signal('');
  readonly search = signal('');
  readonly page = signal(1);
  readonly limit = signal(20);
  readonly justificationsPage = signal(1);
  readonly pestana = signal<'resumen' | 'justificaciones'>('resumen');
  readonly pendientes = signal(0);
  readonly seleccionado = signal<AttendanceReportRow | null>(null);
  readonly horas = formatoHoras;
  readonly minutos = formatoMinutos;
  readonly duracion = duracionConSigno;
  readonly saldos = signal(new Map<string, number>());

  private searchTimer?: ReturnType<typeof setTimeout>;

  ngOnInit(): void {
    this.api.list<CatalogItem>('/employees/departments', { limit: 100 }).subscribe({
      next: (page) => this.departments.set(page.data),
    });
    this.load();
    this.loadJustifications();
  }

  setSearch(value: string): void {
    this.search.set(value);
    this.page.set(1);
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => this.load(), 320);
  }

  goToPage(page: number): void {
    this.page.set(page);
    this.load();
  }

  setLimit(limit: number): void {
    this.limit.set(limit);
    this.page.set(1);
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.api
      .list<AttendanceReportRow>('/attendance/report', {
        from: this.from(),
        to: this.to(),
        departmentId: this.departmentId() || undefined,
        search: this.search() || undefined,
        page: this.page(),
        limit: this.limit(),
      })
      .subscribe({
        next: (response) => {
          this.rows.set(response.data);
          this.meta.set(response.meta);
          this.loading.set(false);
          this.cargarSaldos(response.data.map((r) => r.employeeId));
        },
        error: (error) => {
          this.rows.set([]);
          this.loading.set(false);
          this.toast.error('No se pudo generar el reporte', apiErrorMessage(error));
        },
      });
  }

  private cargarSaldos(ids: string[]): void {
    if (ids.length === 0) return;
    this.api.get<Array<{ employeeId: string; saldoMinutos: number }>>('/banco-horas/saldos', { ids: ids.join(',') }).subscribe({
      next: (r) => this.saldos.set(new Map(r.data.filter((s) => s.saldoMinutos !== 0).map((s) => [s.employeeId, s.saldoMinutos]))),
      error: () => this.saldos.set(new Map()),
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
    this.api
      .list<AttendanceJustification>('/attendance/justifications', { status: 'PENDING', page: 1, limit: 1 })
      .subscribe({
        next: (page) => this.pendientes.set(page.meta.total),
        error: () => this.pendientes.set(0),
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
        search: this.search() || undefined,
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
