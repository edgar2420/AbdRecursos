import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';
import { ToastService } from '../../core/services/toast.service';
import { apiErrorMessage } from '../../core/interceptors/auth.interceptor';
import { EmployeeOption, PageMeta, Schedule, ScheduleAssignment } from '../../core/models/api.models';
import {
  CardComponent,
  ModalComponent,
  PageHeaderComponent,
  PaginatorComponent,
  StateComponent,
} from '../../shared/components/ui.components';
import { FechaPipe } from '../../shared/pipes/format.pipes';

const WEEK_DAYS = [
  { value: 1, label: 'Lun' },
  { value: 2, label: 'Mar' },
  { value: 3, label: 'Mie' },
  { value: 4, label: 'Jue' },
  { value: 5, label: 'Vie' },
  { value: 6, label: 'Sab' },
  { value: 7, label: 'Dom' },
];

@Component({
  selector: 'app-schedule-list',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    PageHeaderComponent,
    CardComponent,
    PaginatorComponent,
    StateComponent,
    ModalComponent,
    FechaPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <app-page-header title="Horarios y turnos" subtitle="Definicion de jornadas y asignacion por empleado">
        <button class="btn btn-ghost btn-sm" (click)="openAssign()">Asignar horario</button>
        <button class="btn btn-primary btn-sm" (click)="openForm()">Nuevo horario</button>
      </app-page-header>

      <app-card heading="Horarios definidos" [padded]="false">
        @if (loading()) {
          <app-state mode="loading" title="Cargando horarios"></app-state>
        } @else if (schedules().length === 0) {
          <app-state title="Sin horarios definidos" message="Cree un horario para poder asignarlo a los empleados.">
            <button class="btn btn-primary btn-sm" (click)="openForm()">Nuevo horario</button>
          </app-state>
        } @else {
          <div class="table-wrap">
            <table class="data">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Jornada</th>
                  <th>Dias</th>
                  <th class="num">Tolerancia</th>
                  <th class="num">Descanso</th>
                  <th class="num">Asignados</th>
                  <th>Estado</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                @for (schedule of schedules(); track schedule.id) {
                  <tr>
                    <td class="strong">{{ schedule.name }}</td>
                    <td class="nowrap">{{ schedule.startTime }} - {{ schedule.endTime }}</td>
                    <td>
                      <div class="days">
                        @for (day of weekDays; track day.value) {
                          <span class="day" [class.on]="schedule.weekDays.includes(day.value)">{{ day.label }}</span>
                        }
                      </div>
                    </td>
                    <td class="num">{{ schedule.toleranceMinutes }} min</td>
                    <td class="num">{{ schedule.breakMinutes }} min</td>
                    <td class="num">{{ schedule.assignedCount ?? 0 }}</td>
                    <td>
                      <span class="badge" [class.badge-ok]="schedule.isActive" [class.badge-neutral]="!schedule.isActive">
                        {{ schedule.isActive ? 'Activo' : 'Inactivo' }}
                      </span>
                    </td>
                    <td class="nowrap text-right">
                      <button class="btn btn-ghost btn-sm" (click)="openForm(schedule)">Editar</button>
                      <button class="btn btn-ghost btn-sm" (click)="toggleActive(schedule)">
                        {{ schedule.isActive ? 'Desactivar' : 'Activar' }}
                      </button>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </app-card>

      <app-card heading="Asignaciones vigentes" [padded]="false">
        @if (assignments().length === 0) {
          <app-state title="Sin asignaciones" message="Asigne un horario a uno o varios empleados."></app-state>
        } @else {
          <div class="table-wrap">
            <table class="data">
              <thead>
                <tr>
                  <th>Empleado</th>
                  <th>Departamento</th>
                  <th>Horario</th>
                  <th>Jornada</th>
                  <th>Vigente desde</th>
                  <th>Hasta</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                @for (assignment of assignments(); track assignment.id) {
                  <tr>
                    <td class="strong">{{ assignment.employeeName }}</td>
                    <td>{{ assignment.departmentName ?? '-' }}</td>
                    <td>{{ assignment.scheduleName }}</td>
                    <td class="nowrap muted">{{ assignment.startTime }} - {{ assignment.endTime }}</td>
                    <td class="nowrap">{{ assignment.validFrom | fecha }}</td>
                    <td class="nowrap">{{ assignment.validUntil ? (assignment.validUntil | fecha) : 'Indefinido' }}</td>
                    <td class="text-right">
                      @if (assignment.isActive) {
                        <button class="btn btn-ghost btn-sm" (click)="endAssignment(assignment)">Finalizar</button>
                      }
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
          <app-paginator [meta]="assignmentsMeta()" (pageChange)="goToAssignmentsPage($event)" />
        }
      </app-card>
    </div>

    @if (formOpen()) {
      <app-modal [title]="editing() ? 'Editar horario' : 'Nuevo horario'" (closed)="formOpen.set(false)">
        <form [formGroup]="form" class="stack">
          <div class="field">
            <label>Nombre *</label>
            <input formControlName="name" placeholder="Administrativo 08:30-17:00" />
          </div>
          <div class="row" style="gap:14px">
            <div class="field flex-1">
              <label>Hora de entrada *</label>
              <input type="time" formControlName="startTime" />
            </div>
            <div class="field flex-1">
              <label>Hora de salida *</label>
              <input type="time" formControlName="endTime" />
            </div>
          </div>
          <div class="row" style="gap:14px">
            <div class="field flex-1">
              <label>Tolerancia (min)</label>
              <input type="number" min="0" max="120" formControlName="toleranceMinutes" />
            </div>
            <div class="field flex-1">
              <label>Descanso (min)</label>
              <input type="number" min="0" max="240" formControlName="breakMinutes" />
            </div>
          </div>
          <div class="field">
            <label>Dias de la semana *</label>
            <div class="days selectable">
              @for (day of weekDays; track day.value) {
                <button
                  type="button"
                  class="day"
                  [class.on]="selectedDays().includes(day.value)"
                  (click)="toggleDay(day.value)"
                >
                  {{ day.label }}
                </button>
              }
            </div>
          </div>
          <label class="row" style="gap:8px">
            <input type="checkbox" formControlName="isNightShift" />
            <span>Turno nocturno (la salida cae al dia siguiente)</span>
          </label>
        </form>
        <div footer>
          <button class="btn btn-ghost" (click)="formOpen.set(false)">Cancelar</button>
          <button class="btn btn-primary" [disabled]="saving()" (click)="save()">Guardar</button>
        </div>
      </app-modal>
    }

    @if (assignOpen()) {
      <app-modal title="Asignar horario" (closed)="assignOpen.set(false)">
        <div class="field">
          <label>Horario *</label>
          <select [value]="assignScheduleId()" (change)="assignScheduleId.set($any($event.target).value)">
            <option value="">Seleccione...</option>
            @for (schedule of schedules(); track schedule.id) {
              <option [value]="schedule.id">{{ schedule.name }}</option>
            }
          </select>
        </div>
        <div class="field">
          <label>Empleados *</label>
          <select multiple size="8" (change)="pickEmployees($event)">
            @for (option of options(); track option.id) {
              <option [value]="option.id">{{ option.label }}</option>
            }
          </select>
          <span class="hint">Use Ctrl (o Cmd) para seleccionar varios empleados.</span>
        </div>
        <div class="row" style="gap:14px">
          <div class="field flex-1">
            <label>Vigente desde *</label>
            <input type="date" [value]="assignFrom()" (change)="assignFrom.set($any($event.target).value)" />
          </div>
          <div class="field flex-1">
            <label>Hasta (opcional)</label>
            <input type="date" [value]="assignUntil()" (change)="assignUntil.set($any($event.target).value)" />
          </div>
        </div>
        <div footer>
          <button class="btn btn-ghost" (click)="assignOpen.set(false)">Cancelar</button>
          <button class="btn btn-primary" (click)="assign()">Asignar</button>
        </div>
      </app-modal>
    }
  `,
  styles: [
    `
      .days {
        display: flex;
        gap: 4px;
      }
      .day {
        padding: 3px 7px;
        border-radius: 6px;
        background: var(--ink-100);
        color: var(--ink-500);
        font-size: 11px;
        font-weight: 600;
        border: 1px solid transparent;
      }
      .day.on {
        background: var(--brand-100);
        color: var(--brand-800);
      }
      .days.selectable .day {
        cursor: pointer;
        padding: 7px 12px;
        font-size: 12px;
      }
      .stack {
        display: flex;
        flex-direction: column;
        gap: 14px;
      }
      select[multiple] {
        height: auto;
        padding: 8px;
      }
    `,
  ],
})
export class ScheduleListComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(ToastService);

  readonly weekDays = WEEK_DAYS;

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly schedules = signal<Schedule[]>([]);
  readonly assignments = signal<ScheduleAssignment[]>([]);
  readonly assignmentsMeta = signal<PageMeta | null>(null);
  readonly options = signal<EmployeeOption[]>([]);
  readonly formOpen = signal(false);
  readonly assignOpen = signal(false);
  readonly editing = signal<Schedule | null>(null);
  readonly selectedDays = signal<number[]>([1, 2, 3, 4, 5]);

  readonly assignScheduleId = signal('');
  readonly assignEmployeeIds = signal<string[]>([]);
  readonly assignFrom = signal(new Date().toISOString().slice(0, 10));
  readonly assignUntil = signal('');
  readonly assignmentsPage = signal(1);

  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(3)]],
    startTime: ['08:30', Validators.required],
    endTime: ['17:00', Validators.required],
    toleranceMinutes: [5],
    breakMinutes: [60],
    isNightShift: [false],
  });

  ngOnInit(): void {
    this.load();
    this.loadAssignments();
    this.api.get<EmployeeOption[]>('/employees/options').subscribe({
      next: (response) => this.options.set(response.data),
      error: () => this.options.set([]),
    });
  }

  load(): void {
    this.loading.set(true);
    this.api.list<Schedule>('/schedules', { limit: 50 }).subscribe({
      next: (page) => {
        this.schedules.set(page.data);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  loadAssignments(): void {
    this.api
      .list<ScheduleAssignment>('/schedules/assignments', { page: this.assignmentsPage(), limit: 10 })
      .subscribe({
        next: (page) => {
          this.assignments.set(page.data);
          this.assignmentsMeta.set(page.meta);
        },
        error: () => this.assignments.set([]),
      });
  }

  goToAssignmentsPage(page: number): void {
    this.assignmentsPage.set(page);
    this.loadAssignments();
  }

  toggleDay(day: number): void {
    this.selectedDays.update((days) =>
      days.includes(day) ? days.filter((d) => d !== day) : [...days, day].sort(),
    );
  }

  openForm(schedule?: Schedule): void {
    this.editing.set(schedule ?? null);
    if (schedule) {
      this.form.reset({
        name: schedule.name,
        startTime: schedule.startTime,
        endTime: schedule.endTime,
        toleranceMinutes: schedule.toleranceMinutes,
        breakMinutes: schedule.breakMinutes,
        isNightShift: schedule.isNightShift,
      });
      this.selectedDays.set([...schedule.weekDays]);
    } else {
      this.form.reset({
        name: '',
        startTime: '08:30',
        endTime: '17:00',
        toleranceMinutes: 5,
        breakMinutes: 60,
        isNightShift: false,
      });
      this.selectedDays.set([1, 2, 3, 4, 5]);
    }
    this.formOpen.set(true);
  }

  save(): void {
    if (this.form.invalid || this.selectedDays().length === 0) {
      this.form.markAllAsTouched();
      this.toast.warn('Revise el formulario', 'Complete el nombre, las horas y al menos un dia');
      return;
    }
    this.saving.set(true);
    const payload = { ...this.form.getRawValue(), weekDays: this.selectedDays() };
    const editing = this.editing();
    const request = editing
      ? this.api.patch<Schedule>(`/schedules/${editing.id}`, payload)
      : this.api.post<Schedule>('/schedules', payload);

    request.subscribe({
      next: () => {
        this.saving.set(false);
        this.formOpen.set(false);
        this.toast.success(editing ? 'Horario actualizado' : 'Horario creado');
        this.load();
      },
      error: (error) => {
        this.saving.set(false);
        this.toast.error('No se pudo guardar', apiErrorMessage(error));
      },
    });
  }

  toggleActive(schedule: Schedule): void {
    this.api.patch(`/schedules/${schedule.id}`, { isActive: !schedule.isActive }).subscribe({
      next: () => {
        this.toast.success(schedule.isActive ? 'Horario desactivado' : 'Horario activado');
        this.load();
      },
      error: (error) => this.toast.error('No se pudo actualizar', apiErrorMessage(error)),
    });
  }

  openAssign(): void {
    this.assignScheduleId.set('');
    this.assignEmployeeIds.set([]);
    this.assignOpen.set(true);
  }

  pickEmployees(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.assignEmployeeIds.set(Array.from(select.selectedOptions).map((option) => option.value));
  }

  assign(): void {
    if (!this.assignScheduleId() || this.assignEmployeeIds().length === 0) {
      this.toast.warn('Datos incompletos', 'Seleccione un horario y al menos un empleado');
      return;
    }
    this.api
      .post('/schedules/assignments', {
        scheduleId: this.assignScheduleId(),
        employeeIds: this.assignEmployeeIds(),
        validFrom: this.assignFrom(),
        validUntil: this.assignUntil() || undefined,
      })
      .subscribe({
        next: () => {
          this.assignOpen.set(false);
          this.toast.success('Horario asignado');
          this.loadAssignments();
          this.load();
        },
        error: (error) => this.toast.error('No se pudo asignar', apiErrorMessage(error)),
      });
  }

  endAssignment(assignment: ScheduleAssignment): void {
    this.api
      .patch(`/schedules/assignments/${assignment.id}/end`, {
        validUntil: new Date().toISOString().slice(0, 10),
      })
      .subscribe({
        next: () => {
          this.toast.success('Asignacion finalizada');
          this.loadAssignments();
        },
        error: (error) => this.toast.error('No se pudo finalizar', apiErrorMessage(error)),
      });
  }
}
