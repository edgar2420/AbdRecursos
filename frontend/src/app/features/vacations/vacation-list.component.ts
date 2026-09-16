import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { apiErrorMessage } from '../../core/interceptors/auth.interceptor';
import { PageMeta, VacationBalance, VacationRequest } from '../../core/models/api.models';
import { autoRefresh } from '../../shared/utils/auto-refresh';
import {
  CardComponent,
  KpiComponent,
  ModalComponent,
  PageHeaderComponent,
  PaginatorComponent,
  StateComponent,
} from '../../shared/components/ui.components';
import { FlameGaugeComponent } from '../../shared/components/flame-gauge.component';
import { BadgeClasePipe, EtiquetaPipe, FechaPipe } from '../../shared/pipes/format.pipes';

@Component({
  selector: 'app-vacation-list',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    PageHeaderComponent,
    CardComponent,
    KpiComponent,
    PaginatorComponent,
    StateComponent,
    ModalComponent,
    FlameGaugeComponent,
    FechaPipe,
    EtiquetaPipe,
    BadgeClasePipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <app-page-header title="Vacaciones" subtitle="Solicitudes, aprobaciones y saldo por antiguedad">
        @if (auth.isSupervisor()) {
          <a class="btn btn-ghost btn-sm" routerLink="/vacaciones/calendario">Calendario del equipo</a>
        }
        <button class="btn btn-primary btn-sm" (click)="openForm()">Solicitar vacaciones</button>
      </app-page-header>

      @if (balance(); as bal) {
        <div class="grid cols-4">
          <app-flame-gauge label="Dias disponibles" [value]="bal.availableDays" [max]="maxFlame(bal)" />
          <app-kpi label="Le corresponden" [value]="bal.entitledDays" [hint]="bal.yearsOfService + ' años de antiguedad'" />
          <app-kpi label="Tomados" [value]="bal.takenDays" hint="Aprobados en la gestion" />
          <app-kpi label="En tramite" [value]="bal.pendingDays" hint="Aun sin aprobar" />
        </div>
      }

      <app-card>
        <div class="filters">
          <div class="field">
            <label>Estado</label>
            <select [value]="filters().status" (change)="setStatus($any($event.target).value)">
              <option value="">Todos</option>
              <option value="PENDING_SUPERVISOR">Pendiente supervisor</option>
              <option value="PENDING_HR">Pendiente RRHH</option>
              <option value="APPROVED">Aprobadas</option>
              <option value="REJECTED">Rechazadas</option>
              <option value="CANCELLED">Canceladas</option>
            </select>
          </div>
          <div class="field">
            <label>Desde</label>
            <input type="date" [value]="filters().dateFrom" (change)="setDate('dateFrom', $any($event.target).value)" />
          </div>
          <div class="field">
            <label>Hasta</label>
            <input type="date" [value]="filters().dateTo" (change)="setDate('dateTo', $any($event.target).value)" />
          </div>
          <div class="field flex-1">
            <label>Buscar empleado</label>
            <input type="search" [value]="filters().search" (input)="setSearch($any($event.target).value)" />
          </div>
        </div>
      </app-card>

      <app-card [padded]="false">
        @if (loading()) {
          <app-state mode="loading" title="Cargando solicitudes"></app-state>
        } @else if (requests().length === 0) {
          <app-state title="Sin solicitudes" message="Cuando registre una solicitud aparecera en esta lista.">
            <button class="btn btn-primary btn-sm" (click)="openForm()">Solicitar vacaciones</button>
          </app-state>
        } @else {
          <div class="table-wrap">
            <table class="data">
              <thead>
                <tr>
                  <th>Empleado</th>
                  <th>Desde</th>
                  <th>Hasta</th>
                  <th class="num">Dias habiles</th>
                  <th>Estado</th>
                  <th>Motivo</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                @for (request of requests(); track request.id) {
                  <tr>
                    <td>
                      <span class="strong">{{ request.employeeName }}</span>
                      <div class="muted" style="font-size:11.5px">{{ request.departmentName ?? '-' }}</div>
                    </td>
                    <td class="nowrap">{{ request.startDate | fecha }}</td>
                    <td class="nowrap">{{ request.endDate | fecha }}</td>
                    <td class="num strong">{{ request.workingDays }}</td>
                    <td>
                      <span [class]="request.status | badgeClase">{{ request.status | etiqueta }}</span>
                      @if (request.supervisorApprovedByName) {
                        <div class="muted" style="font-size:11px">
                          Supervisor: {{ request.supervisorApprovedByName }}
                          @if (request.supervisorApprovalIsEmergency) {
                            <span class="badge badge-warn" style="margin-left:4px">Emergencia RRHH</span>
                          }
                        </div>
                        @if (request.emergencyReason) {
                          <div class="muted" style="font-size:11px">Motivo: {{ request.emergencyReason }}</div>
                        }
                      }
                      @if (request.hrApprovedByName) {
                        <div class="muted" style="font-size:11px">RRHH: {{ request.hrApprovedByName }}</div>
                      }
                      @if (request.rejectedByName) {
                        <div class="muted" style="font-size:11px">Rechazado por {{ request.rejectedByName }}</div>
                      }
                      @if (request.rejectionReason) {
                        <div class="muted" style="font-size:11px">{{ request.rejectionReason }}</div>
                      }
                    </td>
                    <td class="muted">{{ request.reason ?? '-' }}</td>
                    <td class="nowrap text-right">
                      @if (canApprove(request)) {
                        <button class="btn btn-secondary btn-sm" (click)="onApproveClick(request)">Aprobar</button>
                        <button class="btn btn-ghost btn-sm" (click)="openReject(request)">Rechazar</button>
                      }
                      @if (canCancel(request)) {
                        <button class="btn btn-ghost btn-sm" (click)="cancel(request)">Cancelar</button>
                      }
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
      <app-modal title="Solicitar vacaciones" (closed)="formOpen.set(false)">
        <form [formGroup]="form" class="stack">
          <div class="row" style="gap:14px">
            <div class="field flex-1">
              <label>Fecha de inicio *</label>
              <input type="date" formControlName="startDate" />
            </div>
            <div class="field flex-1">
              <label>Fecha de fin *</label>
              <input type="date" formControlName="endDate" />
            </div>
          </div>
          <div class="field">
            <label>Motivo (opcional)</label>
            <textarea formControlName="reason" placeholder="Vacaciones anuales, viaje familiar..."></textarea>
          </div>
          <p class="muted" style="font-size:12px;margin:0">
            Solo se descuentan dias habiles: no se cuentan domingos ni feriados nacionales.
            La solicitud pasa primero por su supervisor y luego por Recursos Humanos.
          </p>
        </form>
        <div footer>
          <button class="btn btn-ghost" (click)="formOpen.set(false)">Cancelar</button>
          <button class="btn btn-primary" [disabled]="saving()" (click)="submit()">Enviar solicitud</button>
        </div>
      </app-modal>
    }

    @if (approvingEmergency()) {
      <app-modal title="Aprobacion de emergencia" (closed)="approvingEmergency.set(null)">
        <p class="muted" style="font-size:12.5px;margin:0 0 4px">
          El supervisor del equipo no cerro este paso. Al aprobar en su lugar como Recursos Humanos,
          debe indicar el motivo: por que se aprueba de emergencia.
        </p>
        <div class="field">
          <label>Motivo de la emergencia *</label>
          <textarea
            [value]="emergencyReason()"
            (input)="emergencyReason.set($any($event.target).value)"
            placeholder="Ej: el supervisor esta de licencia medica"
          ></textarea>
          <span class="hint">Minimo 5 caracteres. Quedara registrado en la auditoria.</span>
        </div>
        <div footer>
          <button class="btn btn-ghost" (click)="approvingEmergency.set(null)">Cancelar</button>
          <button class="btn btn-primary" (click)="confirmEmergencyApproval()">Aprobar de emergencia</button>
        </div>
      </app-modal>
    }

    @if (rejecting()) {
      <app-modal title="Rechazar solicitud" (closed)="rejecting.set(null)">
        <div class="field">
          <label>Motivo del rechazo *</label>
          <textarea [value]="rejectReason()" (input)="rejectReason.set($any($event.target).value)"></textarea>
          <span class="hint">El empleado vera este mensaje en su solicitud.</span>
        </div>
        <div footer>
          <button class="btn btn-ghost" (click)="rejecting.set(null)">Cancelar</button>
          <button class="btn btn-danger" (click)="reject()">Rechazar</button>
        </div>
      </app-modal>
    }
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
      .stack {
        display: flex;
        flex-direction: column;
        gap: 14px;
      }
    `,
  ],
})
export class VacationListComponent implements OnInit, OnDestroy {
  private readonly api = inject(ApiService);
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(ToastService);
  readonly auth = inject(AuthService);

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly requests = signal<VacationRequest[]>([]);
  readonly meta = signal<PageMeta | null>(null);
  readonly balance = signal<VacationBalance | null>(null);
  readonly formOpen = signal(false);
  readonly rejecting = signal<VacationRequest | null>(null);
  readonly rejectReason = signal('');
  readonly approvingEmergency = signal<VacationRequest | null>(null);
  readonly emergencyReason = signal('');

  readonly filters = signal({ status: '', dateFrom: '', dateTo: '', search: '', page: 1, limit: 10 });

  readonly form = this.fb.nonNullable.group({
    startDate: ['', Validators.required],
    endDate: ['', Validators.required],
    reason: [''],
  });

  private searchTimer?: ReturnType<typeof setTimeout>;
  private detenerRefresco?: () => void;

  ngOnInit(): void {
    this.load();
    this.loadBalance();
    // Una solicitud nueva o una aprobacion la puede generar otra persona: sin
    // esto, el usuario ve la lista desactualizada hasta que recarga a mano.
    this.detenerRefresco = autoRefresh(() => this.load(true));
  }

  ngOnDestroy(): void {
    this.detenerRefresco?.();
  }

  setStatus(status: string): void {
    this.filters.update((f) => ({ ...f, status, page: 1 }));
    this.load();
  }

  setDate(key: 'dateFrom' | 'dateTo', value: string): void {
    this.filters.update((f) => ({ ...f, [key]: value, page: 1 }));
    this.load();
  }

  setSearch(search: string): void {
    this.filters.update((f) => ({ ...f, search, page: 1 }));
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => this.load(), 320);
  }

  goToPage(page: number): void {
    this.filters.update((f) => ({ ...f, page }));
    this.load();
  }

  setLimit(limit: number): void {
    this.filters.update((f) => ({ ...f, limit, page: 1 }));
    this.load();
  }

  /**
   * `silent`: refresco en segundo plano (autoRefresh) - no muestra el
   * spinner de carga ni borra la tabla si la peticion falla, para no hacer
   * parpadear la pantalla mientras el usuario esta mirando la lista.
   */
  load(silent = false): void {
    if (!silent) this.loading.set(true);
    this.api.list<VacationRequest>('/vacations/requests', { ...this.filters() }).subscribe({
      next: (page) => {
        this.requests.set(page.data);
        this.meta.set(page.meta);
        this.loading.set(false);
      },
      error: () => {
        if (!silent) this.requests.set([]);
        this.loading.set(false);
      },
    });
  }

  loadBalance(): void {
    this.api.get<VacationBalance>('/vacations/balance/me').subscribe({
      next: (response) => this.balance.set(response.data),
      error: () => this.balance.set(null),
    });
  }

  /**
   * Referencia del 100% de la llama: lo acreditado en gestiones ya cumplidas
   * (lo que de verdad se puede tomar), no solo lo que otorga la gestion en
   * curso. Si por algun motivo no llega el desglose, cae a entitledDays.
   */
  maxFlame(bal: VacationBalance): number {
    const total = bal.gestiones?.reduce((sum, g) => sum + g.diasAcreditados, 0) ?? 0;
    return total > 0 ? total : bal.entitledDays;
  }

  canApprove(request: VacationRequest): boolean {
    if (request.employeeId === this.auth.employeeId()) return false;
    if (request.status === 'PENDING_SUPERVISOR') {
      // El paso del supervisor lo cierra el supervisor del equipo o, en su
      // ausencia, Recursos Humanos con una aprobacion de emergencia. Un
      // Administrador puro no la ve: esa decision es de RRHH, no de sistemas.
      return this.auth.hasRole('SUPERVISOR', 'HR');
    }
    if (request.status === 'PENDING_HR') return this.auth.isHr();
    return false;
  }

  canCancel(request: VacationRequest): boolean {
    const isOwn = request.employeeId === this.auth.employeeId();
    const inProgress = request.status === 'PENDING_SUPERVISOR' || request.status === 'PENDING_HR';
    return (isOwn && inProgress) || (this.auth.isHr() && request.status !== 'CANCELLED');
  }

  openForm(): void {
    this.form.reset();
    this.formOpen.set(true);
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    this.api.post<VacationRequest>('/vacations/requests', this.form.getRawValue()).subscribe({
      next: () => {
        this.saving.set(false);
        this.formOpen.set(false);
        this.toast.success('Solicitud enviada', 'Su supervisor recibira la notificacion');
        this.load();
        this.loadBalance();
      },
      error: (error) => {
        this.saving.set(false);
        this.toast.error('No se pudo registrar la solicitud', apiErrorMessage(error));
      },
    });
  }

  /**
   * Si es RRHH cerrando el paso del supervisor, es siempre una aprobacion de
   * emergencia (el backend asi lo trata): pide el motivo antes de aprobar.
   * En cualquier otro caso (el supervisor real, o RRHH en su paso final) no
   * hace falta motivo y se aprueba directo.
   */
  onApproveClick(request: VacationRequest): void {
    if (request.status === 'PENDING_SUPERVISOR' && this.auth.role() === 'HR') {
      this.emergencyReason.set('');
      this.approvingEmergency.set(request);
      return;
    }
    this.doApprove(request);
  }

  confirmEmergencyApproval(): void {
    const request = this.approvingEmergency();
    if (!request) return;
    if (this.emergencyReason().trim().length < 5) {
      this.toast.warn('Indique el motivo', 'Escriba al menos 5 caracteres');
      return;
    }
    this.doApprove(request, this.emergencyReason().trim());
    this.approvingEmergency.set(null);
  }

  private doApprove(request: VacationRequest, reason?: string): void {
    this.api.post<VacationRequest>(`/vacations/requests/${request.id}/approve`, reason ? { reason } : undefined).subscribe({
      next: (response) => {
        const r = response.data;
        if (r.supervisorApprovalIsEmergency && r.status === 'PENDING_HR') {
          this.toast.success(
            'Aprobado de emergencia',
            `${r.supervisorApprovedByName} (RRHH) aprobo en ausencia del supervisor. Pasa a RRHH.`,
          );
        } else if (r.status === 'APPROVED') {
          this.toast.success('Vacaciones aprobadas', `Ultima firma: ${r.hrApprovedByName}`);
        } else {
          this.toast.success('Solicitud aprobada', `Firmo ${r.supervisorApprovedByName}`);
        }
        this.load();
      },
      error: (error) => this.toast.error('No se pudo aprobar', apiErrorMessage(error)),
    });
  }

  openReject(request: VacationRequest): void {
    this.rejectReason.set('');
    this.rejecting.set(request);
  }

  reject(): void {
    const request = this.rejecting();
    if (!request) return;
    if (this.rejectReason().trim().length < 5) {
      this.toast.warn('Indique el motivo', 'Escriba al menos 5 caracteres');
      return;
    }
    this.api.post(`/vacations/requests/${request.id}/reject`, { reason: this.rejectReason() }).subscribe({
      next: () => {
        this.rejecting.set(null);
        this.toast.success('Solicitud rechazada');
        this.load();
      },
      error: (error) => this.toast.error('No se pudo rechazar', apiErrorMessage(error)),
    });
  }

  cancel(request: VacationRequest): void {
    this.api.post(`/vacations/requests/${request.id}/cancel`).subscribe({
      next: () => {
        this.toast.info('Solicitud cancelada');
        this.load();
        this.loadBalance();
      },
      error: (error) => this.toast.error('No se pudo cancelar', apiErrorMessage(error)),
    });
  }
}
