import { ChangeDetectionStrategy, Component, Input, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import { Employee, EmployeeHistoryEntry, VacationBalance } from '../../core/models/api.models';
import { CardComponent, PageHeaderComponent, StateComponent } from '../../shared/components/ui.components';
import { BajaEmpleadoComponent, ReactivarEmpleadoComponent, etiquetaMotivoBaja } from './baja-empleado.component';
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
    BajaEmpleadoComponent,
    ReactivarEmpleadoComponent,
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
        <app-page-header [title]="e.fullName" [subtitle]="(e.positionName ?? 'Sin cargo') + ' · ' + (e.departmentName ?? 'Sin departamento')">
          <a class="btn btn-ghost btn-sm" routerLink="/empleados">Volver</a>
          @if (auth.isHr() && e.isActive) {
            <button class="btn btn-danger btn-sm" (click)="modal.set('baja')">Dar de baja</button>
          }
        </app-page-header>

        @if (!e.isActive) {
          <section class="aviso-baja" aria-label="Empleado dado de baja">
            <div>
              <strong>De baja desde el {{ e.terminationDate | fecha }}</strong>
              <span>{{ motivoBaja(e.terminationReason) }}</span>
              @if (e.terminationNotes) {
                <p>{{ e.terminationNotes }}</p>
              }
            </div>
            @if (auth.isHr()) {
              <button class="btn btn-secondary btn-sm" (click)="modal.set('reactivar')">Reactivar</button>
            }
          </section>
        }

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
              @if (e.terminationDate) {
                <div><dt>Retiro</dt><dd>{{ e.terminationDate | fecha }}</dd></div>
              }
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
            <div class="row gap-xl">
              <div><span class="muted">Antiguedad</span><strong>{{ bal.yearsOfService }} años</strong></div>
              <div><span class="muted">Le corresponden</span><strong>{{ bal.entitledDays }} dias</strong></div>
              <div><span class="muted">Tomados</span><strong>{{ bal.takenDays }} dias</strong></div>
              <div><span class="muted">En tramite</span><strong>{{ bal.pendingDays }} dias</strong></div>
              <div>
                <span class="muted">Disponibles</span>
                <strong class="text-brand">{{ bal.availableDays }} dias</strong>
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

    @if (employee(); as e) {
      @if (modal() === 'baja') {
        <app-baja-empleado [empleado]="e" (cerrado)="modal.set(null)" (hecho)="trasCambio()" />
      }
      @if (modal() === 'reactivar') {
        <app-reactivar-empleado [empleado]="e" (cerrado)="modal.set(null)" (hecho)="trasCambio()" />
      }
    }
  `,
  styleUrl: './employee-detail.component.scss',
})
export class EmployeeDetailComponent implements OnInit {
  private readonly api = inject(ApiService);
  readonly auth = inject(AuthService);

  @Input() id = '';

  readonly loading = signal(true);
  readonly employee = signal<Employee | null>(null);
  readonly history = signal<EmployeeHistoryEntry[]>([]);
  readonly balance = signal<VacationBalance | null>(null);
  readonly modal = signal<'baja' | 'reactivar' | null>(null);
  readonly motivoBaja = etiquetaMotivoBaja;

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

  trasCambio(): void {
    this.modal.set(null);
    this.load();
  }
}
