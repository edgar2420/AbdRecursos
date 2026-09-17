import { ChangeDetectionStrategy, Component, Input, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { apiErrorMessage } from '../../core/interceptors/auth.interceptor';
import { Employee, EmployeeHistoryEntry, VacationBalance } from '../../core/models/api.models';
import {
  CardComponent,
  ModalComponent,
  PageHeaderComponent,
  StateComponent,
} from '../../shared/components/ui.components';
import { BadgeClasePipe, BolivianosPipe, EtiquetaPipe, FechaPipe } from '../../shared/pipes/format.pipes';

@Component({
  selector: 'app-employee-detail',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    PageHeaderComponent,
    CardComponent,
    StateComponent,
    ModalComponent,
    BolivianosPipe,
    FechaPipe,
    EtiquetaPipe,
    BadgeClasePipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      @if (loading()) {
        <app-state mode="loading" title="Cargando ficha del empleado"></app-state>
      } @else if (!employee()) {
        <app-state mode="error" title="Empleado no disponible" message="No existe o no tiene permisos para verlo.">
          <a class="btn btn-secondary btn-sm" routerLink="/empleados">Volver al listado</a>
        </app-state>
      } @else {
      @if (employee(); as e) {
        <app-page-header [title]="e.fullName" [subtitle]="e.positionName + ' · ' + (e.departmentName ?? 'Sin departamento')">
          <a class="btn btn-ghost btn-sm" routerLink="/empleados">Volver</a>
          @if (auth.isHr() && e.isActive) {
            <button class="btn btn-danger btn-sm" (click)="confirmOpen.set(true)">Dar de baja</button>
          }
          @if (auth.isHr() && !e.isActive) {
            <button class="btn btn-secondary btn-sm" (click)="reactivate()">Reactivar</button>
          }
        </app-page-header>

        <div class="grid cols-3">
          <app-card heading="Datos personales">
            <dl>
              <div><dt>Codigo</dt><dd>{{ e.employeeCode }}</dd></div>
              <div><dt>C.I.</dt><dd>{{ e.ci }} {{ e.ciExtension }}</dd></div>
              <div><dt>Fecha de nacimiento</dt><dd>{{ e.birthDate | fecha }}</dd></div>
              <div><dt>Correo</dt><dd>{{ e.email ?? '-' }}</dd></div>
              <div><dt>Telefono</dt><dd>{{ e.phone ?? '-' }}</dd></div>
              <div><dt>Direccion</dt><dd>{{ e.address ?? '-' }}</dd></div>
            </dl>
          </app-card>

          <app-card heading="Datos laborales">
            <dl>
              <div><dt>Estado</dt><dd><span [class]="e.status | badgeClase">{{ e.status | etiqueta }}</span></dd></div>
              <div><dt>Ingreso</dt><dd>{{ e.hireDate | fecha }}</dd></div>
              <div><dt>Contrato</dt><dd>{{ e.contractType | etiqueta }}</dd></div>
              <div><dt>Haber basico</dt><dd class="strong">{{ e.baseSalary | bs }}</dd></div>
              <div><dt>Supervisor</dt><dd>{{ e.supervisorName ?? 'Sin supervisor' }}</dd></div>
              <div>
                <dt>Inamovilidad</dt>
                <dd>
                  @if (e.jobProtection) {
                    <span class="badge badge-info">Vigente hasta {{ e.jobProtectionUntil | fecha }}</span>
                  } @else {
                    <span class="muted">No aplica</span>
                  }
                </dd>
              </div>
            </dl>
          </app-card>

          <app-card heading="Pagos y beneficios">
            <dl>
              <div><dt>AFP</dt><dd>{{ e.afpName ?? '-' }}</dd></div>
              <div><dt>Numero AFP</dt><dd>{{ e.afpNumber ?? '-' }}</dd></div>
              <div><dt>Banco</dt><dd>{{ e.bankName ?? '-' }}</dd></div>
              <div><dt>Cuenta</dt><dd>{{ e.bankAccount ?? '-' }}</dd></div>
              <div><dt>Contacto emergencia</dt><dd>{{ e.emergencyContactName ?? '-' }}</dd></div>
              <div><dt>Telefono emergencia</dt><dd>{{ e.emergencyContactPhone ?? '-' }}</dd></div>
            </dl>
          </app-card>
        </div>

        @if (balance(); as bal) {
          <app-card heading="Saldo de vacaciones">
            <div class="row" style="gap:34px">
              <div><span class="muted">Antiguedad</span><strong>{{ bal.yearsOfService }} años</strong></div>
              <div><span class="muted">Le corresponden</span><strong>{{ bal.entitledDays }} dias</strong></div>
              <div><span class="muted">Tomados</span><strong>{{ bal.takenDays }} dias</strong></div>
              <div><span class="muted">En tramite</span><strong>{{ bal.pendingDays }} dias</strong></div>
              <div>
                <span class="muted">Disponibles</span>
                <strong style="color:var(--brand-700)">{{ bal.availableDays }} dias</strong>
              </div>
            </div>
          </app-card>
        }

        <app-card heading="Historial de cambios" [padded]="false">
          @if (history().length === 0) {
            <app-state title="Sin movimientos registrados" message="Los ascensos y cambios de salario apareceran aqui."></app-state>
          } @else {
            <div class="table-wrap">
              <table class="data">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Tipo</th>
                    <th>Campo</th>
                    <th>Anterior</th>
                    <th>Nuevo</th>
                    <th>Notas</th>
                  </tr>
                </thead>
                <tbody>
                  @for (entry of history(); track entry.id) {
                    <tr>
                      <td class="nowrap">{{ entry.effectiveDate | fecha }}</td>
                      <td><span class="badge badge-brand">{{ entry.changeType | etiqueta }}</span></td>
                      <td class="muted">{{ entry.field ?? '-' }}</td>
                      <td class="muted">{{ entry.oldValue ?? '-' }}</td>
                      <td class="strong">{{ entry.newValue ?? '-' }}</td>
                      <td class="muted">{{ entry.notes ?? '-' }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }
        </app-card>
      }
      }
    </div>

    @if (confirmOpen()) {
      <app-modal title="Dar de baja al empleado" (closed)="confirmOpen.set(false)">
        <p>
          El empleado quedara inactivo pero se conserva todo su historial y sus boletas (baja logica).
          Esta accion queda registrada en la auditoria.
        </p>
        <div class="field">
          <label>Fecha de desvinculacion</label>
          <input type="date" [value]="terminationDate()" (change)="terminationDate.set($any($event.target).value)" />
        </div>
        <div class="field">
          <label>Motivo / notas</label>
          <textarea [value]="terminationNotes()" (input)="terminationNotes.set($any($event.target).value)"></textarea>
        </div>
        <div footer>
          <button class="btn btn-ghost" (click)="confirmOpen.set(false)">Cancelar</button>
          <button class="btn btn-danger" (click)="deactivate()">Confirmar baja</button>
        </div>
      </app-modal>
    }
  `,
  styles: [
    `
      dl {
        margin: 0;
        display: flex;
        flex-direction: column;
        gap: 9px;
      }
      dl > div {
        display: flex;
        justify-content: space-between;
        gap: 14px;
        font-size: 13px;
      }
      dt {
        color: var(--ink-500);
      }
      dd {
        margin: 0;
        text-align: right;
      }
      .row > div {
        display: flex;
        flex-direction: column;
      }
      .row > div span {
        font-size: 11.5px;
      }
      .row > div strong {
        font-size: 17px;
      }
    `,
  ],
})
export class EmployeeDetailComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);
  readonly auth = inject(AuthService);

  @Input() id = '';

  readonly loading = signal(true);
  readonly employee = signal<Employee | null>(null);
  readonly history = signal<EmployeeHistoryEntry[]>([]);
  readonly balance = signal<VacationBalance | null>(null);
  readonly confirmOpen = signal(false);
  readonly terminationDate = signal(new Date().toISOString().slice(0, 10));
  readonly terminationNotes = signal('');

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.api.get<Employee>(`/employees/${this.id}`).subscribe({
      next: (response) => {
        this.employee.set(response.data);
        this.loading.set(false);
      },
      error: () => {
        this.employee.set(null);
        this.loading.set(false);
      },
    });

    this.api.list<EmployeeHistoryEntry>(`/employees/${this.id}/history`, { limit: 50 }).subscribe({
      next: (page) => this.history.set(page.data),
      error: () => this.history.set([]),
    });

    this.api.get<VacationBalance>(`/vacations/balance/${this.id}`).subscribe({
      next: (response) => this.balance.set(response.data),
      error: () => this.balance.set(null),
    });
  }

  deactivate(): void {
    this.api
      .delete(`/employees/${this.id}`, {
        terminationDate: this.terminationDate(),
        notes: this.terminationNotes() || undefined,
      })
      .subscribe({
        next: () => {
          this.confirmOpen.set(false);
          this.toast.success('Empleado dado de baja');
          this.load();
        },
        error: (error) => this.toast.error('No se pudo dar de baja', apiErrorMessage(error)),
      });
  }

  reactivate(): void {
    this.api.post(`/employees/${this.id}/reactivate`).subscribe({
      next: () => {
        this.toast.success('Empleado reactivado');
        this.load();
      },
      error: (error) => this.toast.error('No se pudo reactivar', apiErrorMessage(error)),
    });
  }
}
