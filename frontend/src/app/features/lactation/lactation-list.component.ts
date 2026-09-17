import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';
import { ToastService } from '../../core/services/toast.service';
import { apiErrorMessage } from '../../core/interceptors/auth.interceptor';
import { EmployeeOption, LactationPermit, PageMeta } from '../../core/models/api.models';
import {
  CardComponent,
  KpiComponent,
  ModalComponent,
  PageHeaderComponent,
  PaginatorComponent,
  StateComponent,
} from '../../shared/components/ui.components';
import { FechaPipe } from '../../shared/pipes/format.pipes';

@Component({
  selector: 'app-lactation-list',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    PageHeaderComponent,
    CardComponent,
    KpiComponent,
    PaginatorComponent,
    StateComponent,
    ModalComponent,
    FechaPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <app-page-header
        title="Permisos de lactancia"
        subtitle="Ley 3460 · una hora diaria hasta que el hijo o hija cumple un año"
      >
        <button class="btn btn-primary btn-sm" (click)="openForm()">Registrar permiso</button>
      </app-page-header>

      <div class="grid cols-3">
        <app-kpi label="Permisos vigentes" [value]="activeCount()" hint="Con beneficio en curso" />
        <app-kpi label="Por vencer" [value]="expiring().length" hint="En los proximos 30 dias" />
        <app-kpi label="Permiso diario" [value]="dailyMinutes() + ' min'" hint="Fraccionable en dos tramos" />
      </div>

      @if (expiring().length) {
        <app-card heading="Alertas de vencimiento">
          <ul class="alerts">
            @for (permit of expiring(); track permit.id) {
              <li>
                <span class="strong">{{ permit.employeeName }}</span>
                <span class="badge badge-warn">Vence el {{ permit.endDate | fecha }}</span>
                <span class="muted">{{ permit.daysRemaining }} dias restantes</span>
              </li>
            }
          </ul>
        </app-card>
      }

      <app-card [padded]="false">
        @if (loading()) {
          <app-state mode="loading" title="Cargando permisos"></app-state>
        } @else if (permits().length === 0) {
          <app-state
            title="Sin permisos registrados"
            message="Registre el permiso al reintegro post parto para activar el control diario y la inamovilidad."
          >
            <button class="btn btn-primary btn-sm" (click)="openForm()">Registrar permiso</button>
          </app-state>
        } @else {
          <div class="table-wrap">
            <table class="data">
              <thead>
                <tr>
                  <th>Empleada</th>
                  <th>Hijo/a</th>
                  <th>Fecha de parto</th>
                  <th>Vigencia</th>
                  <th>Tramos horarios</th>
                  <th class="num">Restantes</th>
                  <th>Estado</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                @for (permit of permits(); track permit.id) {
                  <tr>
                    <td>
                      <span class="strong">{{ permit.employeeName }}</span>
                      <div class="muted" style="font-size:11.5px">{{ permit.departmentName ?? '-' }}</div>
                    </td>
                    <td>{{ permit.childName ?? '-' }}</td>
                    <td class="nowrap">{{ permit.birthDate | fecha }}</td>
                    <td class="nowrap">{{ permit.startDate | fecha }} → {{ permit.endDate | fecha }}</td>
                    <td class="nowrap muted">
                      @if (permit.slot1Start) {
                        {{ permit.slot1Start }}-{{ permit.slot1End }}
                      }
                      @if (permit.slot2Start) {
                        · {{ permit.slot2Start }}-{{ permit.slot2End }}
                      }
                      @if (!permit.slot1Start && !permit.slot2Start) {
                        Sin definir
                      }
                    </td>
                    <td class="num" [class.warn]="permit.daysRemaining <= 30">{{ permit.daysRemaining }} d</td>
                    <td>
                      <span class="badge" [class.badge-ok]="permit.isActive" [class.badge-neutral]="!permit.isActive">
                        {{ permit.isActive ? 'Vigente' : 'Finalizado' }}
                      </span>
                    </td>
                    <td class="text-right nowrap">
                      <button class="btn btn-ghost btn-sm" (click)="openEdit(permit)">Editar</button>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
          <app-paginator [meta]="meta()" (pageChange)="goToPage($event)" (limitChange)="setLimit($event)" />
        }
      </app-card>
    </div>

    @if (formOpen()) {
      <app-modal [title]="editing() ? 'Editar permiso' : 'Registrar permiso de lactancia'" (closed)="formOpen.set(false)">
        <form [formGroup]="form" class="stack">
          @if (!editing()) {
            <div class="field">
              <label>Empleada *</label>
              <select formControlName="employeeId">
                <option value="">Seleccione...</option>
                @for (option of options(); track option.id) {
                  <option [value]="option.id">{{ option.label }}</option>
                }
              </select>
            </div>
            <div class="row" style="gap:14px">
              <div class="field flex-1">
                <label>Fecha de parto *</label>
                <input type="date" formControlName="birthDate" />
                <span class="hint">La vigencia se calcula automaticamente (un año).</span>
              </div>
              <div class="field flex-1">
                <label>Reintegro post parto</label>
                <input type="date" formControlName="startDate" />
              </div>
            </div>
          }
          <div class="field">
            <label>Nombre del hijo/a</label>
            <input formControlName="childName" />
          </div>
          <div class="row" style="gap:14px">
            <div class="field flex-1">
              <label>Tramo 1 desde</label>
              <input type="time" formControlName="slot1Start" />
            </div>
            <div class="field flex-1">
              <label>Tramo 1 hasta</label>
              <input type="time" formControlName="slot1End" />
            </div>
          </div>
          <div class="row" style="gap:14px">
            <div class="field flex-1">
              <label>Tramo 2 desde</label>
              <input type="time" formControlName="slot2Start" />
            </div>
            <div class="field flex-1">
              <label>Tramo 2 hasta</label>
              <input type="time" formControlName="slot2End" />
            </div>
          </div>
          <div class="field">
            <label>Notas</label>
            <textarea formControlName="notes"></textarea>
          </div>
          <p class="muted" style="font-size:12px;margin:0">
            Al registrar el permiso se marca la inamovilidad laboral en el perfil de la empleada. Es un
            dato informativo para RRHH: no bloquea acciones por si solo.
          </p>
        </form>
        <div footer>
          <button class="btn btn-ghost" (click)="formOpen.set(false)">Cancelar</button>
          <button class="btn btn-primary" [disabled]="saving()" (click)="save()">Guardar</button>
        </div>
      </app-modal>
    }
  `,
  styles: [
    `
      .stack {
        display: flex;
        flex-direction: column;
        gap: 14px;
      }
      .alerts {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: 10px;
        font-size: 13px;
      }
      .alerts li {
        display: flex;
        align-items: center;
        gap: 12px;
        flex-wrap: wrap;
      }
      .warn {
        color: var(--warn-700);
        font-weight: 600;
      }
    `,
  ],
})
export class LactationListComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(ToastService);

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly permits = signal<LactationPermit[]>([]);
  readonly meta = signal<PageMeta | null>(null);
  readonly expiring = signal<LactationPermit[]>([]);
  readonly options = signal<EmployeeOption[]>([]);
  readonly formOpen = signal(false);
  readonly editing = signal<LactationPermit | null>(null);
  readonly page = signal(1);
  readonly limit = signal(10);

  readonly form = this.fb.nonNullable.group({
    employeeId: ['', Validators.required],
    birthDate: ['', Validators.required],
    startDate: [''],
    childName: [''],
    slot1Start: [''],
    slot1End: [''],
    slot2Start: [''],
    slot2End: [''],
    notes: [''],
  });

  ngOnInit(): void {
    this.load();
    this.api.get<LactationPermit[]>('/lactation/expiring').subscribe({
      next: (response) => this.expiring.set(response.data),
      error: () => this.expiring.set([]),
    });
    this.api.get<EmployeeOption[]>('/employees/options').subscribe({
      next: (response) => this.options.set(response.data),
      error: () => this.options.set([]),
    });
  }

  activeCount(): number {
    return this.permits().filter((p) => p.isActive).length;
  }

  dailyMinutes(): number {
    return this.permits()[0]?.dailyMinutes ?? 60;
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
    this.api.list<LactationPermit>('/lactation', { page: this.page(), limit: this.limit() }).subscribe({
      next: (page) => {
        this.permits.set(page.data);
        this.meta.set(page.meta);
        this.loading.set(false);
      },
      error: () => {
        this.permits.set([]);
        this.loading.set(false);
      },
    });
  }

  openForm(): void {
    this.editing.set(null);
    this.form.reset();
    this.form.controls.employeeId.enable();
    this.formOpen.set(true);
  }

  openEdit(permit: LactationPermit): void {
    this.editing.set(permit);
    this.form.reset({
      employeeId: permit.employeeId,
      birthDate: permit.birthDate.slice(0, 10),
      startDate: permit.startDate.slice(0, 10),
      childName: permit.childName ?? '',
      slot1Start: permit.slot1Start ?? '',
      slot1End: permit.slot1End ?? '',
      slot2Start: permit.slot2Start ?? '',
      slot2End: permit.slot2End ?? '',
      notes: permit.notes ?? '',
    });
    this.formOpen.set(true);
  }

  save(): void {
    const editing = this.editing();
    const raw = this.form.getRawValue();

    if (!editing && (!raw.employeeId || !raw.birthDate)) {
      this.toast.warn('Datos incompletos', 'Seleccione la empleada y la fecha de parto');
      return;
    }

    const payload: Record<string, unknown> = {};
    Object.entries(raw).forEach(([key, value]) => {
      if (value !== '' && value !== null) payload[key] = value;
    });

    this.saving.set(true);
    const request = editing
      ? this.api.patch<LactationPermit>(`/lactation/${editing.id}`, {
          childName: payload['childName'],
          slot1Start: payload['slot1Start'],
          slot1End: payload['slot1End'],
          slot2Start: payload['slot2Start'],
          slot2End: payload['slot2End'],
          notes: payload['notes'],
        })
      : this.api.post<LactationPermit>('/lactation', payload);

    request.subscribe({
      next: () => {
        this.saving.set(false);
        this.formOpen.set(false);
        this.toast.success(editing ? 'Permiso actualizado' : 'Permiso registrado');
        this.load();
      },
      error: (error) => {
        this.saving.set(false);
        this.toast.error('No se pudo guardar', apiErrorMessage(error));
      },
    });
  }
}
