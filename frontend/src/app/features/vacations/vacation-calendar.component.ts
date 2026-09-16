import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/services/api.service';
import { CalendarEntry } from '../../core/models/api.models';
import { CardComponent, PageHeaderComponent, StateComponent } from '../../shared/components/ui.components';
import { BadgeClasePipe, EtiquetaPipe, FechaPipe } from '../../shared/pipes/format.pipes';

interface CalendarRow {
  employeeId: string;
  employeeName: string;
  departmentName: string | null;
  cells: { day: number; active: boolean; status: string }[];
}

const MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

/** Calendario del equipo para detectar solapamientos (2.2). */
@Component({
  selector: 'app-vacation-calendar',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    PageHeaderComponent,
    CardComponent,
    StateComponent,
    FechaPipe,
    EtiquetaPipe,
    BadgeClasePipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <app-page-header title="Calendario de vacaciones" subtitle="Vista mensual del equipo para evitar solapamientos">
        <button class="btn btn-ghost btn-sm" (click)="shiftMonth(-1)">Mes anterior</button>
        <span class="badge badge-brand">{{ monthLabel() }}</span>
        <button class="btn btn-ghost btn-sm" (click)="shiftMonth(1)">Mes siguiente</button>
        <a class="btn btn-secondary btn-sm" routerLink="/vacaciones">Ver solicitudes</a>
      </app-page-header>

      <app-card [padded]="false">
        @if (loading()) {
          <app-state mode="loading" title="Cargando calendario"></app-state>
        } @else if (rows().length === 0) {
          <app-state
            title="Sin vacaciones programadas"
            [message]="'No hay solicitudes vigentes para ' + monthLabel() + '.'"
          ></app-state>
        } @else {
          <div class="table-wrap">
            <table class="calendar">
              <thead>
                <tr>
                  <th class="sticky">Empleado</th>
                  @for (day of days(); track day) {
                    <th [class.weekend]="isWeekend(day)">{{ day }}</th>
                  }
                </tr>
              </thead>
              <tbody>
                @for (row of rows(); track row.employeeId) {
                  <tr>
                    <td class="sticky">
                      <span class="strong">{{ row.employeeName }}</span>
                      <div class="muted" style="font-size:11px">{{ row.departmentName ?? '-' }}</div>
                    </td>
                    @for (cell of row.cells; track cell.day) {
                      <td
                        [class.weekend]="isWeekend(cell.day)"
                        [class.on]="cell.active"
                        [class.pending]="cell.active && cell.status !== 'APPROVED'"
                        [title]="cell.active ? cell.status : ''"
                      ></td>
                    }
                  </tr>
                }
              </tbody>
            </table>
          </div>

          <div class="legend">
            <span><i class="dot on"></i> Aprobada</span>
            <span><i class="dot pending"></i> En tramite</span>
            <span><i class="dot weekend"></i> Fin de semana</span>
          </div>
        }
      </app-card>

      @if (entries().length) {
        <app-card heading="Detalle del mes" [padded]="false">
          <div class="table-wrap">
            <table class="data">
              <thead>
                <tr>
                  <th>Empleado</th>
                  <th>Departamento</th>
                  <th>Desde</th>
                  <th>Hasta</th>
                  <th class="num">Dias</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                @for (entry of entries(); track entry.requestId) {
                  <tr>
                    <td class="strong">{{ entry.employeeName }}</td>
                    <td>{{ entry.departmentName ?? '-' }}</td>
                    <td class="nowrap">{{ entry.startDate | fecha }}</td>
                    <td class="nowrap">{{ entry.endDate | fecha }}</td>
                    <td class="num">{{ entry.workingDays }}</td>
                    <td><span [class]="entry.status | badgeClase">{{ entry.status | etiqueta }}</span></td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </app-card>
      }
    </div>
  `,
  styles: [
    `
      table.calendar {
        border-collapse: collapse;
        font-size: 11px;
        width: 100%;
      }
      table.calendar th,
      table.calendar td {
        border: 1px solid var(--ink-100);
        text-align: center;
        min-width: 24px;
        height: 30px;
      }
      table.calendar thead th {
        background: var(--brand-50);
        color: var(--brand-800);
        font-weight: 700;
      }
      .sticky {
        position: sticky;
        left: 0;
        background: var(--surface);
        text-align: left !important;
        min-width: 190px;
        padding: 6px 10px;
        z-index: 2;
      }
      thead .sticky {
        background: var(--brand-50);
      }
      .weekend {
        background: var(--ink-50);
      }
      td.on {
        background: var(--brand-600);
      }
      td.on.pending {
        background: repeating-linear-gradient(
          45deg,
          var(--brand-300),
          var(--brand-300) 4px,
          var(--brand-100) 4px,
          var(--brand-100) 8px
        );
      }
      .legend {
        display: flex;
        gap: 18px;
        padding: 12px 16px;
        font-size: 12px;
        color: var(--ink-500);
        border-top: 1px solid var(--ink-200);
      }
      .dot {
        display: inline-block;
        width: 12px;
        height: 12px;
        border-radius: 3px;
        margin-right: 5px;
        vertical-align: -2px;
      }
      .dot.on {
        background: var(--brand-600);
      }
      .dot.pending {
        background: var(--brand-300);
      }
      .dot.weekend {
        background: var(--ink-100);
        border: 1px solid var(--ink-200);
      }
    `,
  ],
})
export class VacationCalendarComponent implements OnInit {
  private readonly api = inject(ApiService);

  readonly loading = signal(true);
  readonly entries = signal<CalendarEntry[]>([]);
  readonly cursor = signal(new Date());

  readonly days = computed(() => {
    const date = this.cursor();
    const total = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    return Array.from({ length: total }, (_, index) => index + 1);
  });

  readonly monthLabel = computed(() => {
    const date = this.cursor();
    return `${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
  });

  readonly rows = computed<CalendarRow[]>(() => {
    const date = this.cursor();
    const days = this.days();
    const grouped = new Map<string, CalendarRow>();

    for (const entry of this.entries()) {
      if (!grouped.has(entry.employeeId)) {
        grouped.set(entry.employeeId, {
          employeeId: entry.employeeId,
          employeeName: entry.employeeName,
          departmentName: entry.departmentName,
          cells: days.map((day) => ({ day, active: false, status: '' })),
        });
      }
      const row = grouped.get(entry.employeeId)!;
      const start = new Date(entry.startDate);
      const end = new Date(entry.endDate);

      days.forEach((day, index) => {
        const current = new Date(date.getFullYear(), date.getMonth(), day);
        if (current >= stripTime(start) && current <= stripTime(end)) {
          row.cells[index] = { day, active: true, status: entry.status };
        }
      });
    }

    return [...grouped.values()].sort((a, b) => a.employeeName.localeCompare(b.employeeName));
  });

  ngOnInit(): void {
    this.load();
  }

  isWeekend(day: number): boolean {
    const date = this.cursor();
    const weekDay = new Date(date.getFullYear(), date.getMonth(), day).getDay();
    return weekDay === 0 || weekDay === 6;
  }

  shiftMonth(delta: number): void {
    const date = this.cursor();
    this.cursor.set(new Date(date.getFullYear(), date.getMonth() + delta, 1));
    this.load();
  }

  load(): void {
    this.loading.set(true);
    const date = this.cursor();
    const from = new Date(date.getFullYear(), date.getMonth(), 1).toISOString().slice(0, 10);
    const to = new Date(date.getFullYear(), date.getMonth() + 1, 0).toISOString().slice(0, 10);

    this.api.get<CalendarEntry[]>('/vacations/calendar', { from, to }).subscribe({
      next: (response) => {
        this.entries.set(response.data);
        this.loading.set(false);
      },
      error: () => {
        this.entries.set([]);
        this.loading.set(false);
      },
    });
  }
}

function stripTime(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}
