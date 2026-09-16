import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { apiErrorMessage } from '../../core/interceptors/auth.interceptor';
import { Employee, VacationBalance } from '../../core/models/api.models';
import {
  CardComponent,
  EyeToggleComponent,
  PageHeaderComponent,
  StateComponent,
} from '../../shared/components/ui.components';
import { FlameGaugeComponent } from '../../shared/components/flame-gauge.component';
import { BolivianosPipe, EtiquetaPipe, FechaPipe } from '../../shared/pipes/format.pipes';

/**
 * Portal del empleado: cada quien ve y edita solo su propio perfil, y solo los
 * datos de contacto (el backend ignora cualquier otro campo que se envie).
 */
@Component({
  selector: 'app-my-profile',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    PageHeaderComponent,
    CardComponent,
    StateComponent,
    EyeToggleComponent,
    FlameGaugeComponent,
    BolivianosPipe,
    FechaPipe,
    EtiquetaPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <app-page-header title="Mi perfil" subtitle="Sus datos laborales y de contacto"></app-page-header>

      @if (loading()) {
        <app-state mode="loading" title="Cargando su perfil"></app-state>
      } @else if (!employee()) {
        <app-state
          mode="error"
          title="Su usuario no esta vinculado a un empleado"
          message="Solicite a Recursos Humanos que vincule su cuenta con su ficha de empleado."
        ></app-state>
      } @else {
      @if (employee(); as e) {
        <div class="grid cols-2">
          <app-card heading="Informacion laboral">
            <dl>
              <div><dt>Codigo</dt><dd>{{ e.employeeCode }}</dd></div>
              <div><dt>Cargo</dt><dd>{{ e.positionName ?? '-' }}</dd></div>
              <div><dt>Departamento</dt><dd>{{ e.departmentName ?? '-' }}</dd></div>
              <div><dt>Supervisor</dt><dd>{{ e.supervisorName ?? '-' }}</dd></div>
              <div><dt>Fecha de ingreso</dt><dd>{{ e.hireDate | fecha }}</dd></div>
              <div><dt>Contrato</dt><dd>{{ e.contractType | etiqueta }}</dd></div>
              <div><dt>Haber basico</dt><dd class="strong">{{ e.baseSalary | bs }}</dd></div>
              <div><dt>AFP</dt><dd>{{ e.afpName ?? '-' }}</dd></div>
            </dl>
          </app-card>

          <app-card heading="Vacaciones">
            @if (balance(); as bal) {
              <div class="balance">
                <app-flame-gauge label="Dias disponibles" [value]="bal.availableDays" [max]="maxFlame(bal)" />
                <dl>
                  <div><dt>Antiguedad</dt><dd>{{ bal.yearsOfService }} años</dd></div>
                  <div><dt>Le corresponden</dt><dd>{{ bal.entitledDays }} dias habiles esta gestion</dd></div>
                  <div><dt>Tomados</dt><dd>{{ bal.takenDays }}</dd></div>
                  <div><dt>En tramite</dt><dd>{{ bal.pendingDays }}</dd></div>
                </dl>
              </div>
            } @else {
              <p class="muted">Aun no tiene saldo calculado para esta gestion.</p>
            }
          </app-card>
        </div>

        <div class="grid cols-2">
          <app-card heading="Datos de contacto">
            <form [formGroup]="form" class="stack" (ngSubmit)="save()">
              <div class="field">
                <label>Correo</label>
                <input type="email" formControlName="email" />
              </div>
              <div class="field">
                <label>Telefono</label>
                <input formControlName="phone" />
              </div>
              <div class="field">
                <label>Direccion</label>
                <input formControlName="address" />
              </div>
              <div class="field">
                <label>Contacto de emergencia</label>
                <input formControlName="emergencyContactName" />
              </div>
              <div class="field">
                <label>Telefono de emergencia</label>
                <input formControlName="emergencyContactPhone" />
              </div>
              <div class="field">
                <label>Parentesco</label>
                <input formControlName="emergencyContactRelation" />
              </div>
              <button class="btn btn-primary" type="submit" [disabled]="saving()">Guardar cambios</button>
            </form>
          </app-card>

          <app-card heading="Seguridad">
            <form [formGroup]="passwordForm" class="stack" (ngSubmit)="changePassword()">
              <div class="field">
                <label>Contrasena actual</label>
                <div class="password-field">
                  <input
                    [type]="verActual() ? 'text' : 'password'"
                    formControlName="currentPassword"
                    autocomplete="current-password"
                  />
                  <app-eye-toggle [visible]="verActual()" (toggled)="verActual.set($event)" />
                </div>
              </div>
              <div class="field">
                <label>Nueva contrasena</label>
                <div class="password-field">
                  <input
                    [type]="verNueva() ? 'text' : 'password'"
                    formControlName="newPassword"
                    autocomplete="new-password"
                  />
                  <app-eye-toggle [visible]="verNueva()" (toggled)="verNueva.set($event)" />
                </div>
                <span class="hint">Minimo 10 caracteres, con mayuscula, minuscula y numero.</span>
              </div>
              <button class="btn btn-secondary" type="submit" [disabled]="changingPassword()">
                Cambiar contrasena
              </button>
              <p class="muted" style="font-size:11.5px;margin:0">
                Al cambiar la contrasena se cierran las demas sesiones abiertas.
              </p>
            </form>
          </app-card>
        </div>
      }
      }
    </div>
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
      .stack {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      .balance {
        display: flex;
        gap: 22px;
        align-items: stretch;
        flex-wrap: wrap;
      }
      .balance app-flame-gauge {
        flex: none;
        min-width: 210px;
      }
      .balance dl {
        flex: 1;
        min-width: 200px;
        align-self: center;
      }
    `,
  ],
})
export class MyProfileComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(ToastService);
  private readonly auth = inject(AuthService);

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly changingPassword = signal(false);
  readonly verActual = signal(false);
  readonly verNueva = signal(false);
  readonly employee = signal<Employee | null>(null);
  readonly balance = signal<VacationBalance | null>(null);

  readonly form = this.fb.nonNullable.group({
    email: [''],
    phone: [''],
    address: [''],
    emergencyContactName: [''],
    emergencyContactPhone: [''],
    emergencyContactRelation: [''],
  });

  readonly passwordForm = this.fb.nonNullable.group({
    currentPassword: ['', Validators.required],
    newPassword: ['', [Validators.required, Validators.minLength(10)]],
  });

  ngOnInit(): void {
    const employeeId = this.auth.employeeId();
    if (!employeeId) {
      this.loading.set(false);
      return;
    }

    this.api.get<Employee>(`/employees/${employeeId}`).subscribe({
      next: (response) => {
        const e = response.data;
        this.employee.set(e);
        this.form.patchValue({
          email: e.email ?? '',
          phone: e.phone ?? '',
          address: e.address ?? '',
          emergencyContactName: e.emergencyContactName ?? '',
          emergencyContactPhone: e.emergencyContactPhone ?? '',
          emergencyContactRelation: e.emergencyContactRelation ?? '',
        });
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });

    this.api.get<VacationBalance>('/vacations/balance/me').subscribe({
      next: (response) => this.balance.set(response.data),
      error: () => this.balance.set(null),
    });
  }

  /** Referencia del 100% de la llama: lo acreditado en gestiones ya cumplidas. */
  maxFlame(bal: VacationBalance): number {
    const total = bal.gestiones?.reduce((sum, g) => sum + g.diasAcreditados, 0) ?? 0;
    return total > 0 ? total : bal.entitledDays;
  }

  save(): void {
    const employeeId = this.auth.employeeId();
    if (!employeeId) return;
    this.saving.set(true);
    this.api.patch<Employee>(`/employees/${employeeId}`, this.form.getRawValue()).subscribe({
      next: (response) => {
        this.employee.set(response.data);
        this.saving.set(false);
        this.toast.success('Datos actualizados');
      },
      error: (error) => {
        this.saving.set(false);
        this.toast.error('No se pudo guardar', apiErrorMessage(error));
      },
    });
  }

  changePassword(): void {
    if (this.passwordForm.invalid) {
      this.passwordForm.markAllAsTouched();
      return;
    }
    this.changingPassword.set(true);
    const { currentPassword, newPassword } = this.passwordForm.getRawValue();
    this.auth.changePassword(currentPassword, newPassword).subscribe({
      next: () => {
        this.changingPassword.set(false);
        this.passwordForm.reset();
        this.toast.success('Contrasena actualizada', 'Vuelva a iniciar sesion');
        setTimeout(() => this.auth.logout(), 1200);
      },
      error: (error) => {
        this.changingPassword.set(false);
        this.toast.error('No se pudo cambiar la contrasena', apiErrorMessage(error));
      },
    });
  }
}
