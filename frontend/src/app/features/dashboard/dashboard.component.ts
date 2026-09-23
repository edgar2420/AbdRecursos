import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import { apiErrorMessage } from '../../core/interceptors/auth.interceptor';
import { AttendanceReportRow, DashboardData, LactationPermit } from '../../core/models/api.models';
import { CardComponent, KpiComponent, PageHeaderComponent, StateComponent } from '../../shared/components/ui.components';
import { DateRange, DateRangePickerComponent } from '../../shared/components/date-range-picker.component';
import { TrendChartComponent, TrendPoint } from '../../shared/components/trend-chart.component';
import { SparklineComponent } from '../../shared/components/sparkline.component';
import { autoRefresh } from '../../shared/utils/auto-refresh';
import { BolivianosPipe, FechaPipe } from '../../shared/pipes/format.pipes';
import {
  Metrica,
  Variacion,
  diasDelRango,
  etiquetaCorta,
  etiquetaLarga,
  etiquetaRango,
  formatoMinutos,
  rangoPrevio,
  serieDiaria,
  totales,
  variacion,
} from './atrasos';

const TOP_ATRASOS = 8;
const MAX_FILAS = 500;

const ICONOS = {
  personal: [
    'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2',
    'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
    'M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
  ],
  vacaciones: [
    'M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
    'M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41',
  ],
  justificaciones: [
    'M9 3h6a1 1 0 0 1 1 1v1H8V4a1 1 0 0 1 1-1z',
    'M16 5h2a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2',
    'M9 14l2 2 4-4',
  ],
  tardanzas: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z', 'M12 7v5l3 2'],
  boletas: ['M4 3h16v18l-3-2-2.5 2-2.5-2-2.5 2L7 19l-3 2z', 'M8 8h8M8 12h8M8 16h4'],
  calendario: ['M8 2v4M16 2v4', 'M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z', 'M3 10h18'],
};

interface FilaRanking {
  fila: AttendanceReportRow;
  sparkline: number[];
  cambio: Variacion;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    PageHeaderComponent,
    CardComponent,
    KpiComponent,
    StateComponent,
    DateRangePickerComponent,
    TrendChartComponent,
    SparklineComponent,
    BolivianosPipe,
    FechaPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <app-page-header title="Panel de control" [subtitle]="subtitle()">
        <div class="row">
          <app-date-range-picker [from]="from()" [to]="to()" (rangeChange)="onRangeChange($event)" />
          <button class="btn btn-ghost btn-sm" title="Actualizar" aria-label="Actualizar indicadores" (click)="load()">
            <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 2v6h-6M3 22v-6h6" />
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L21 8M3 16l2.64 2.36A9 9 0 0 0 20.49 15" />
            </svg>
          </button>
        </div>
      </app-page-header>

      @if (loading()) {
        <app-state mode="loading" title="Cargando indicadores"></app-state>
      } @else if (error()) {
        <app-state mode="error" title="No se pudieron cargar los indicadores" [message]="error()!">
          <button class="btn btn-secondary btn-sm" (click)="load()">Reintentar</button>
        </app-state>
      } @else {
        @if (data(); as kpi) {
          @if (esEmpleado()) {
            <div class="grid cols-3">
              <app-kpi
                label="Vacaciones pendientes"
                [value]="kpi.pendingVacations"
                hint="Solicitudes esperando aprobacion"
                [icon]="iconos.vacaciones"
                link="/vacaciones"
                linkLabel="Ver mis vacaciones"
              />
              <app-kpi
                label="Dias de vacacion aprobados"
                [value]="kpi.approvedVacationDays"
                hint="En el periodo seleccionado"
                [icon]="iconos.calendario"
                link="/vacaciones"
                linkLabel="Ver mis vacaciones"
              />
              <app-kpi
                label="Boletas del mes"
                [value]="kpi.payslipsThisMonth"
                [hint]="'Liquido: ' + (kpi.payslipsNetTotal | bs)"
                [icon]="iconos.boletas"
                link="/boletas"
                linkLabel="Ver mis boletas"
              />
            </div>
          } @else {
            <div class="grid cols-4">
              <app-kpi
                label="Personal activo"
                [value]="kpi.headcount"
                [hint]="kpi.scope === 'TEAM' ? 'Personas a su cargo' : 'Empleados con contrato vigente'"
                [icon]="iconos.personal"
                link="/empleados"
                linkLabel="Ver empleados"
              />
              <app-kpi
                label="Vacaciones pendientes"
                [value]="kpi.pendingVacations"
                [tone]="kpi.pendingVacations > 0 ? 'warn' : 'ok'"
                [status]="kpi.pendingVacations > 0 ? 'Requiere revision' : 'Al dia'"
                hint="Solicitudes esperando aprobacion"
                [icon]="iconos.vacaciones"
                link="/vacaciones"
                linkLabel="Revisar solicitudes"
              />
              <app-kpi
                label="Justificaciones"
                [value]="kpi.openJustifications"
                [tone]="kpi.openJustifications > 0 ? 'warn' : 'ok'"
                [status]="kpi.openJustifications > 0 ? 'Requiere revision' : 'Al dia'"
                hint="Faltas y tardanzas por revisar"
                [icon]="iconos.justificaciones"
                link="/asistencia"
                linkLabel="Revisar asistencia"
              />
              <app-kpi
                label="Tardanzas"
                [value]="kpi.attendanceLateCount"
                hint="Dias con llegada tarde en el periodo"
                [icon]="iconos.tardanzas"
                link="/asistencia"
                linkLabel="Ver reporte"
              />
            </div>

            <div class="dash-grid" [class.con-lateral]="auth.isHr()">
              <app-card heading="Tendencia de atrasos">
                <div actions class="segmentado" role="group" aria-label="Medida del grafico">
                  <button type="button" [attr.aria-pressed]="metrica() === 'tardanzas'" (click)="metrica.set('tardanzas')">
                    Tardanzas
                  </button>
                  <button type="button" [attr.aria-pressed]="metrica() === 'minutos'" (click)="metrica.set('minutos')">
                    Minutos
                  </button>
                </div>

                @if (!atrasosListo()) {
                  <div class="cargando-atrasos" aria-hidden="true">
                    <div class="skeleton skeleton-titulo"></div>
                    <div class="skeleton skeleton-grafico"></div>
                  </div>
                } @else if (atrasosError()) {
                  <app-state mode="error" title="No se pudo calcular la tendencia" [message]="atrasosError()!"></app-state>
                } @else {
                  <div class="atrasos" [class.recargando]="atrasosCargando()">
                    <div class="ticker">
                      <div class="ticker-principal">
                        <span class="ticker-etiqueta">
                          {{ metrica() === 'tardanzas' ? 'Tardanzas en el periodo' : 'Tiempo total de atraso' }}
                        </span>
                        <div class="ticker-linea">
                          <strong class="ticker-valor">{{ formatear(totalActual()) }}</strong>
                          <span class="delta" [ngClass]="'delta-' + cambioTotal().tono">
                            <ng-container [ngTemplateOutlet]="flecha" [ngTemplateOutletContext]="{ tono: cambioTotal().tono }" />
                            {{ cambioTotal().texto }}
                          </span>
                        </div>
                        <span class="ticker-vs">frente a {{ etiquetaPrevia() }}</span>
                      </div>

                      <dl class="ticker-datos">
                        <div>
                          <dt>Personas con atrasos</dt>
                          <dd>
                            {{ resumenActual().personas }}
                            <span class="delta delta-mini" [ngClass]="'delta-' + cambioPersonas().tono">
                              <ng-container [ngTemplateOutlet]="flecha" [ngTemplateOutletContext]="{ tono: cambioPersonas().tono }" />
                              {{ cambioPersonas().tono === 'igual' ? '=' : cambioPersonas().tono === 'nuevo' ? 'nuevo' : textoCorto(resumenActual().personas, resumenPrevio().personas) }}
                            </span>
                          </dd>
                        </div>
                        <div>
                          <dt>Promedio por tardanza</dt>
                          <dd>{{ promedio() }}</dd>
                        </div>
                        <div>
                          <dt>Peor dia</dt>
                          <dd>{{ peorDia() }}</dd>
                        </div>
                      </dl>
                    </div>

                    <app-trend-chart
                      [points]="puntos()"
                      [format]="formatear"
                      currentLabel="Este periodo"
                      [previousLabel]="'Periodo anterior (' + etiquetaPrevia() + ')'"
                      [ariaDescription]="'Comparado con ' + etiquetaPrevia() + ': ' + cambioTotal().texto + '.'"
                    />

                    <div class="tabla-toggle">
                      <button type="button" class="btn btn-ghost btn-sm" [attr.aria-expanded]="vistaTabla()" (click)="vistaTabla.set(!vistaTabla())">
                        {{ vistaTabla() ? 'Ocultar tabla' : 'Ver como tabla' }}
                      </button>
                    </div>
                    @if (vistaTabla()) {
                      <div class="table-wrap tabla-dias">
                        <table class="data">
                          <caption class="visually-hidden">Atrasos por dia, este periodo y el anterior</caption>
                          <thead>
                            <tr>
                              <th>Dia</th>
                              <th class="num">Tardanzas</th>
                              <th class="num">Minutos</th>
                              <th>Dia anterior</th>
                              <th class="num">Tardanzas</th>
                              <th class="num">Minutos</th>
                            </tr>
                          </thead>
                          <tbody>
                            @for (fila of tablaDias(); track fila.dia) {
                              <tr>
                                <td class="nowrap">{{ fila.dia }}</td>
                                <td class="num">{{ fila.tardanzas }}</td>
                                <td class="num">{{ fila.minutos }}</td>
                                <td class="nowrap muted">{{ fila.diaPrevio }}</td>
                                <td class="num muted">{{ fila.tardanzasPrevio }}</td>
                                <td class="num muted">{{ fila.minutosPrevio }}</td>
                              </tr>
                            }
                          </tbody>
                        </table>
                      </div>
                    }

                    <div class="ranking-cabecera">
                      <h3>Quien llega tarde</h3>
                      <a class="btn btn-ghost btn-sm" routerLink="/asistencia">Ver reporte completo</a>
                    </div>

                    @if (ranking().length === 0) {
                      <app-state title="Sin atrasos en el periodo" message="Nadie marco su entrada despues de la hora de tolerancia."></app-state>
                    } @else {
                      <ol class="ranking">
                        @for (item of ranking(); track item.fila.employeeId; let i = $index) {
                          <li>
                            <span class="pos">{{ i + 1 }}</span>
                            <div class="quien">
                              <strong>{{ item.fila.employeeName }}</strong>
                              <span>{{ item.fila.departmentName ?? 'Sin departamento' }} · {{ item.fila.employeeCode }}</span>
                            </div>
                            <app-sparkline class="spark" [values]="item.sparkline" />
                            <div class="cifras">
                              <strong>{{ item.fila.daysLate }} {{ item.fila.daysLate === 1 ? 'tardanza' : 'tardanzas' }}</strong>
                              <span>{{ minutosTexto(item.fila.totalLateMinutes) }}</span>
                            </div>
                            <span class="delta delta-mini" [ngClass]="'delta-' + item.cambio.tono" [attr.title]="'Frente al periodo anterior: ' + item.cambio.texto">
                              <ng-container [ngTemplateOutlet]="flecha" [ngTemplateOutletContext]="{ tono: item.cambio.tono }" />
                              {{ item.cambio.tono === 'igual' ? '=' : item.cambio.tono === 'nuevo' ? 'nuevo' : textoCorto(item.fila.daysLate, previoDe(item.fila.employeeId)) }}
                            </span>
                          </li>
                        }
                      </ol>
                      @if (resumenActual().personas > ranking().length) {
                        <p class="ranking-pie">
                          Se muestran {{ ranking().length }} de {{ resumenActual().personas }} personas con atrasos.
                        </p>
                      }
                    }
                  </div>
                }
              </app-card>

              @if (auth.isHr()) {
                <app-card heading="Lactancia (Ley 3460)">
                  <a actions class="btn btn-ghost btn-sm" routerLink="/lactancia">Ver permisos</a>
                  <div class="lact-nums">
                    <div>
                      <strong>{{ kpi.lactationActive }}</strong>
                      <span>permisos vigentes</span>
                    </div>
                    <div [class.alerta]="kpi.lactationExpiringSoon > 0">
                      <strong>{{ kpi.lactationExpiringSoon }}</strong>
                      <span>por vencer en 30 dias</span>
                    </div>
                  </div>

                  @if (expiring().length) {
                    <ul class="expiring">
                      @for (permit of expiring(); track permit.id) {
                        <li>
                          <span class="strong">{{ permit.employeeName }}</span>
                          <span class="muted">vence {{ permit.endDate | fecha }} · {{ permit.daysRemaining }} dias</span>
                        </li>
                      }
                    </ul>
                  } @else {
                    <p class="muted vacio">No hay permisos proximos a vencer.</p>
                  }
                </app-card>
              }
            </div>
          }
        }
      }
    </div>

    <ng-template #flecha let-tono="tono">
      @if (tono === 'peor') {
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7" /></svg>
      } @else if (tono === 'mejor') {
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 5v14M19 12l-7 7-7-7" /></svg>
      } @else if (tono === 'nuevo') {
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
      }
    </ng-template>
  `,
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent implements OnInit, OnDestroy {
  private readonly api = inject(ApiService);
  readonly auth = inject(AuthService);
  readonly iconos = ICONOS;

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly data = signal<DashboardData | null>(null);
  readonly expiring = signal<LactationPermit[]>([]);

  readonly from = signal(firstDayOfMonth());
  readonly to = signal(today());

  readonly metrica = signal<Metrica>('tardanzas');
  readonly vistaTabla = signal(false);
  readonly atrasosListo = signal(false);
  readonly atrasosCargando = signal(false);
  readonly atrasosError = signal<string | null>(null);
  private readonly filasActual = signal<AttendanceReportRow[]>([]);
  private readonly filasPrevio = signal<AttendanceReportRow[]>([]);

  private readonly rango = computed(() => ({ from: this.from(), to: this.to() }));
  private readonly previo = computed(() => rangoPrevio(this.rango()));
  private readonly dias = computed(() => diasDelRango(this.rango()));
  private readonly diasPrevio = computed(() => diasDelRango(this.previo()));
  private readonly serieActual = computed(() => serieDiaria(this.filasActual(), this.dias().length));
  private readonly seriePrevia = computed(() => serieDiaria(this.filasPrevio(), this.dias().length));
  private readonly mapaPrevio = computed(() => new Map(this.filasPrevio().map((f) => [f.employeeId, f.daysLate])));

  readonly resumenActual = computed(() => totales(this.filasActual()));
  readonly resumenPrevio = computed(() => totales(this.filasPrevio()));
  readonly etiquetaPrevia = computed(() => etiquetaRango(this.previo()));

  readonly formatear = (valor: number): string =>
    this.metrica() === 'minutos' ? formatoMinutos(valor) : String(Math.round(valor));

  readonly totalActual = computed(() => this.resumenActual()[this.metrica()]);
  readonly cambioTotal = computed(() =>
    variacion(this.totalActual(), this.resumenPrevio()[this.metrica()], this.formatear),
  );
  readonly cambioPersonas = computed(() =>
    variacion(this.resumenActual().personas, this.resumenPrevio().personas, String),
  );

  readonly promedio = computed(() => {
    const { tardanzas, minutos } = this.resumenActual();
    return tardanzas ? formatoMinutos(minutos / tardanzas) : '—';
  });

  readonly peorDia = computed(() => {
    const serie = this.serieActual()[this.metrica()];
    const max = Math.max(0, ...serie);
    if (max === 0) return '—';
    const i = serie.indexOf(max);
    return `${etiquetaLarga(this.dias()[i])} · ${this.formatear(max)}`;
  });

  readonly puntos = computed<TrendPoint[]>(() => {
    const actual = this.serieActual()[this.metrica()];
    const anterior = this.seriePrevia()[this.metrica()];
    const previos = this.diasPrevio();
    return this.dias().map((dia, i) => ({
      label: etiquetaCorta(dia),
      detail: etiquetaLarga(dia),
      current: actual[i],
      previous: anterior[i] ?? 0,
      previousDetail: previos[i] ? `Periodo anterior (${etiquetaLarga(previos[i])})` : undefined,
    }));
  });

  readonly tablaDias = computed(() => {
    const actual = this.serieActual();
    const anterior = this.seriePrevia();
    const previos = this.diasPrevio();
    return this.dias().map((dia, i) => ({
      dia: etiquetaLarga(dia),
      tardanzas: actual.tardanzas[i],
      minutos: formatoMinutos(actual.minutos[i]),
      diaPrevio: previos[i] ? etiquetaLarga(previos[i]) : '—',
      tardanzasPrevio: anterior.tardanzas[i] ?? 0,
      minutosPrevio: formatoMinutos(anterior.minutos[i] ?? 0),
    }));
  });

  readonly ranking = computed<FilaRanking[]>(() =>
    this.filasActual()
      .slice(0, TOP_ATRASOS)
      .map((fila) => ({
        fila,
        sparkline: (fila.days ?? []).map((d) => d.lateMinutes),
        cambio: variacion(fila.daysLate, this.previoDe(fila.employeeId), String),
      })),
  );

  private detenerRefresco?: () => void;

  ngOnInit(): void {
    this.load();
    this.detenerRefresco = autoRefresh(() => this.load(true));
  }

  ngOnDestroy(): void {
    this.detenerRefresco?.();
  }

  esEmpleado(): boolean {
    return this.auth.role() === 'EMPLOYEE';
  }

  subtitle(): string {
    const scope = this.data()?.scope;
    if (scope === 'TEAM') return 'Indicadores de su equipo a cargo';
    if (scope === 'SELF') return 'Sus indicadores personales';
    return 'Indicadores de la empresa';
  }

  onRangeChange(range: DateRange): void {
    this.from.set(range.from);
    this.to.set(range.to);
    this.load();
  }

  previoDe(employeeId: string): number {
    return this.mapaPrevio().get(employeeId) ?? 0;
  }

  textoCorto(actual: number, previo: number): string {
    const diferencia = actual - previo;
    return diferencia > 0 ? `+${diferencia}` : `−${Math.abs(diferencia)}`;
  }

  minutosTexto(total: number): string {
    return `${formatoMinutos(total)} en total`;
  }

  load(silent = false): void {
    if (!silent) {
      this.loading.set(true);
      this.error.set(null);
    }

    this.api.get<DashboardData>('/reports/dashboard', { from: this.from(), to: this.to() }).subscribe({
      next: (response) => {
        this.data.set(response.data);
        this.loading.set(false);
      },
      error: () => {
        if (!silent) this.error.set('Verifique su conexion con el servidor e intente nuevamente.');
        this.loading.set(false);
      },
    });

    if (this.auth.isSupervisor()) this.cargarAtrasos(silent);

    if (this.auth.isHr()) {
      this.api.get<LactationPermit[]>('/lactation/expiring').subscribe({
        next: (response) => this.expiring.set(response.data.slice(0, 5)),
        error: () => this.expiring.set([]),
      });
    }
  }

  private cargarAtrasos(silent: boolean): void {
    this.atrasosCargando.set(true);
    const consulta = (rango: { from: string; to: string }) =>
      this.api.list<AttendanceReportRow>('/attendance/report', {
        ...rango,
        sortBy: 'late',
        includeDays: 'true',
        page: 1,
        limit: MAX_FILAS,
      });

    forkJoin([consulta(this.rango()), consulta(this.previo())]).subscribe({
      next: ([actual, anterior]) => {
        this.filasActual.set(actual.data);
        this.filasPrevio.set(anterior.data);
        this.atrasosError.set(null);
        this.atrasosCargando.set(false);
        this.atrasosListo.set(true);
      },
      error: (err) => {
        this.atrasosCargando.set(false);
        this.atrasosListo.set(true);
        if (!silent) this.atrasosError.set(apiErrorMessage(err, 'Intente nuevamente en unos segundos.'));
      },
    });
  }
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function firstDayOfMonth(): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
}
