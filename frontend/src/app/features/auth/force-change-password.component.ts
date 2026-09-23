import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { apiErrorMessage } from '../../core/interceptors/auth.interceptor';
import { EyeToggleComponent } from '../../shared/components/ui.components';

const MIN = 4;
const MAX = 8;

@Component({
  selector: 'app-force-change-password',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, EyeToggleComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <div class="card">
        <h1>Cambie su contraseña</h1>
        <p class="muted">
          Por seguridad debe reemplazar la contraseña que le asigno Recursos Humanos antes de continuar.
        </p>

        <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
          <div class="field">
            <label for="actual">Contraseña actual</label>
            <div class="password-field">
              <input
                id="actual"
                [type]="verActual() ? 'text' : 'password'"
                formControlName="currentPassword"
                autocomplete="current-password"
              />
              <app-eye-toggle [visible]="verActual()" (toggled)="verActual.set($event)" />
            </div>
            @if (form.controls.currentPassword.touched && form.controls.currentPassword.invalid) {
              <span class="error-text">Ingrese la contraseña con la que acaba de entrar</span>
            }
          </div>

          <div class="field">
            <label for="nueva">Nueva contraseña</label>
            <div class="password-field">
              <input
                id="nueva"
                [type]="verNueva() ? 'text' : 'password'"
                formControlName="newPassword"
                autocomplete="new-password"
                [attr.maxlength]="max"
                aria-describedby="reglas"
              />
              <app-eye-toggle [visible]="verNueva()" (toggled)="verNueva.set($event)" />
            </div>

            <ul class="rules" id="reglas" aria-live="polite">
              <li [class.ok]="largoOk()">
                <span class="dot" aria-hidden="true"><svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg></span>
                Entre {{ min }} y {{ max }} caracteres
                <span class="count">({{ largo() }}/{{ max }})</span>
              </li>
              <li [class.ok]="distintaOk()">
                <span class="dot" aria-hidden="true"><svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg></span>
                Distinta de la contraseña actual
              </li>
            </ul>
            <span class="hint">Puede usar letras, numeros y simbolos. Distingue mayusculas de minusculas.</span>
          </div>

          @if (error()) {
            <div class="alert" role="alert">{{ error() }}</div>
          }

          <button class="btn btn-primary btn-block" type="submit" [disabled]="saving()">
            {{ saving() ? 'Guardando...' : 'Cambiar contraseña e ingresar' }}
          </button>
        </form>
      </div>
    </div>
  `,
  styleUrl: './force-change-password.component.scss',
})
export class ForceChangePasswordComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  readonly min = MIN;
  readonly max = MAX;
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly verActual = signal(false);
  readonly verNueva = signal(false);

  readonly form = this.fb.nonNullable.group({
    currentPassword: ['', Validators.required],
    newPassword: ['', [Validators.required, Validators.minLength(MIN), Validators.maxLength(MAX)]],
  });

  private readonly valores = toSignal(this.form.valueChanges, { initialValue: this.form.getRawValue() });
  readonly largo = computed(() => this.valores().newPassword?.length ?? 0);
  readonly largoOk = computed(() => this.largo() >= MIN && this.largo() <= MAX);
  readonly distintaOk = computed(() => {
    const { currentPassword, newPassword } = this.valores();
    return !!newPassword && newPassword !== currentPassword;
  });

  constructor() {
    this.form.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => this.error.set(null));
  }

  submit(): void {
    this.form.markAllAsTouched();
    const { currentPassword, newPassword } = this.form.getRawValue();
    if (!currentPassword) {
      this.error.set('Ingrese su contraseña actual.');
      return;
    }
    if (!this.largoOk()) {
      this.error.set(`La nueva contraseña debe tener entre ${MIN} y ${MAX} caracteres (ahora tiene ${this.largo()}).`);
      return;
    }
    if (!this.distintaOk()) {
      this.error.set('La nueva contraseña debe ser distinta de la actual.');
      return;
    }
    this.saving.set(true);
    this.error.set(null);
    this.auth.changePassword(currentPassword, newPassword).subscribe({
      next: () => {
        this.saving.set(false);
        this.toast.success('Contraseña actualizada', 'Vuelva a iniciar sesion');
        setTimeout(() => this.auth.logout(), 1000);
      },
      error: (err) => {
        this.saving.set(false);
        this.error.set(apiErrorMessage(err, 'No se pudo cambiar la contraseña'));
      },
    });
  }
}
