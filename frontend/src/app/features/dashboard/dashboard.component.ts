import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import { DashboardData, HeadcountReport, LactationPermit } from '../../core/models/api.models';
import { CardComponent, KpiComponent, PageHeaderComponent, StateComponent } from '../../shared/components/ui.components';
import { DonutChartComponent, DonutSlice } from '../../shared/components/charts.components';
import { DateRange, DateRangePickerComponent } from '../../shared/components/date-range-picker.component';
import { autoRefresh } from '../../shared/utils/auto-refresh';
import { BolivianosPipe, FechaPipe } from '../../shared/pipes/format.pipes';

const ETIQUETA_CONTRATO: Record<string, string> = {
  INDEFINIDO: 'Indefinido',
  PLAZO_FIJO: 'Plazo fijo',
  EVENTUAL: 'Eventual',
  CONSULTORIA: 'Consultoria',
};

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    PageHeaderComponent,
    CardComponent,
    KpiComponent,
    StateComponent,
    DonutChartComponent,
    DateRangePickerComponent,
    BolivianosPipe,
    FechaPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <app-page-header
        title="Panel de control"
        [subtitle]="subtitle()"
      >
        <div class="row">
          <app-date-range-picker [from]="from()" [to]="to()" (rangeChange)="onRangeChange($event)" />
          <button class="btn btn-ghost btn-sm" title="Actualizar" (click)="load()">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
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
            />
            <app-kpi
              label="Dias de vacacion aprobados"
              [value]="kpi.approvedVacationDays"
              hint="En el periodo seleccionado"
            />
            <app-kpi
              label="Boletas del mes"
              [value]="kpi.payslipsThisMonth"
              [hint]="'Liquido: ' + (kpi.payslipsNetTotal | bs)"
            />
          </div>
        } @else {
          <div class="grid cols-4">
            <app-kpi label="Personal activo" [value]="kpi.headcount" hint="Empleados con contrato vigente" />
            <app-kpi
              label="Altas del periodo"
              [value]="kpi.hiresInPeriod"
              hint="Nuevas incorporaciones"
            />
            <app-kpi
              label="Vacaciones pendientes"
              [value]="kpi.pendingVacations"
              hint="Solicitudes esperando aprobacion"
            />
            <app-kpi
              label="Boletas del mes"
              [value]="kpi.payslipsThisMonth"
              [hint]="'Liquido: ' + (kpi.payslipsNetTotal | bs)"
            />
          </div>

          <app-card heading="Distribucion de personal">
            <div class="grid cols-2">
              <div>
                <h3 class="subheading">Por departamento</h3>
                @if (headcount()?.byDepartment?.length) {
                  <app-donut-chart [data]="headcountSlices()" centerLabel="Empleados" />
                } @else {
                  <app-state title="Sin datos" message="Registre empleados para ver la distribucion."></app-state>
                }
              </div>
              <div>
                <h3 class="subheading">Por tipo de contrato</h3>
                @if (contractSlices().length) {
                  <app-donut-chart [data]="contractSlices()" centerLabel="Empleados" />
                } @else {
                  <app-state title="Sin datos" message="Registre empleados para ver la distribucion."></app-state>
                }
              </div>
            </div>
          </app-card>

          @if (auth.isHr()) {
            <app-card heading="Lactancia (Ley 3460)">
              <div class="row" style="gap:22px;margin-bottom:12px">
                <div>
                  <strong style="font-size:22px">{{ kpi.lactationActive }}</strong>
                  <div class="muted" style="font-size:12px">permisos vigentes</div>
                </div>
                <div>
                  <strong style="font-size:22px;color:var(--warn-700)">{{ kpi.lactationExpiringSoon }}</strong>
                  <div class="muted" style="font-size:12px">por vencer en 30 dias</div>
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
                <p class="muted" style="font-size:12.5px;margin:0">
                  No hay permisos proximos a vencer.
                </p>
              }
            </app-card>
          }
        }
      }
      }
    </div>
  `,
  styles: [
    `
      .expiring {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: 8px;
        font-size: 12.5px;
      }
      .expiring li {
        display: flex;
        justify-content: space-between;
        gap: 10px;
        padding-bottom: 8px;
        border-bottom: 1px solid var(--ink-100);
      }
      .subheading {
        font-size: 11.5px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        color: var(--ink-500);
        margin: 0 0 10px;
      }
    `,
  ],
})
export class DashboardComponent implements OnInit, OnDestroy {
  private readonly api = inject(ApiService);
  readonly auth = inject(AuthService);

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly data = signal<DashboardData | null>(null);
  readonly headcount = signal<HeadcountReport | null>(null);
  readonly expiring = signal<LactationPermit[]>([]);

  readonly from = signal(firstDayOfMonth());
  readonly to = signal(today());

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

  headcountSlices(): DonutSlice[] {
    return (this.headcount()?.byDepartment ?? []).map((d) => ({ label: d.groupName, value: d.total }));
  }

  contractSlices(): DonutSlice[] {
    return (this.headcount()?.byContractType ?? []).map((g) => ({
      label: ETIQUETA_CONTRATO[g.groupName] ?? g.groupName,
      value: g.total,
    }));
  }

  load(silent = false): void {
    if (!silent) {
      this.loading.set(true);
      this.error.set(null);
    }

    this.api
      .get<DashboardData>('/reports/dashboard', { from: this.from(), to: this.to() })
      .subscribe({
        next: (response) => {
          this.data.set(response.data);
          this.loading.set(false);
        },
        error: () => {
          if (!silent) this.error.set('Verifique su conexion con el servidor e intente nuevamente.');
          this.loading.set(false);
        },
      });

    if (this.auth.isSupervisor()) {
      this.api.get<HeadcountReport>('/reports/headcount').subscribe({
        next: (response) => this.headcount.set(response.data),
        error: () => this.headcount.set(null),
      });
    }

    if (this.auth.isHr()) {
      this.api.get<LactationPermit[]>('/lactation/expiring').subscribe({
        next: (response) => this.expiring.set(response.data.slice(0, 5)),
        error: () => this.expiring.set([]),
      });
    }
  }
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function firstDayOfMonth(): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
}
