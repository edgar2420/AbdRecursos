import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { apiErrorMessage } from '../../core/interceptors/auth.interceptor';

@Component({
  selector: 'app-force-change-password',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
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
            <label>Contraseña actual</label>
            <input type="password" formControlName="currentPassword" autocomplete="current-password" />
          </div>
          <div class="field">
            <label>Nueva contraseña</label>
            <input type="password" formControlName="newPassword" autocomplete="new-password" />
            <span class="hint">Entre 4 y 8 caracteres.</span>
          </div>

          @if (error()) {
            <div class="alert">{{ error() }}</div>
          }

          <button class="btn btn-primary btn-block" type="submit" [disabled]="saving()">
            {{ saving() ? 'Guardando...' : 'Cambiar contraseña e ingresar' }}
          </button>
        </form>
      </div>
    </div>
  `,
  styles: [
    `
      .page {
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        background: var(--canvas, #e3f1fb);
        padding: 20px;
      }
      .card {
        width: 100%;
        max-width: 400px;
        background: #fff;
        border-radius: var(--radius-lg, 16px);
        box-shadow: var(--shadow-md);
        padding: 32px 28px;
      }
      h1 {
        margin: 0 0 6px;
        font-size: 20px;
      }
      .muted {
        color: var(--ink-500);
        font-size: 13px;
        margin: 0 0 20px;
      }
      form {
        display: flex;
        flex-direction: column;
        gap: 14px;
      }
      .field label {
        display: block;
        font-size: 12.5px;
        font-weight: 600;
        margin-bottom: 5px;
      }
      .field input {
        width: 100%;
      }
      .hint {
        font-size: 11px;
        color: var(--ink-500);
      }
      .alert {
        background: var(--danger-50, #fdecea);
        color: var(--danger-700);
        border-radius: 8px;
        padding: 8px 12px;
        font-size: 12.5px;
      }
    `,
  ],
})
export class ForceChangePasswordComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  readonly saving = signal(false);
  readonly error = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    currentPassword: ['', Validators.required],
    newPassword: ['', [Validators.required, Validators.minLength(4), Validators.maxLength(8)]],
  });

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    this.error.set(null);
    const { currentPassword, newPassword } = this.form.getRawValue();
    if (currentPassword === newPassword) {
      this.saving.set(false);
      this.error.set('La nueva contraseña debe ser distinta de la actual');
      return;
    }
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
