import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { apiErrorMessage } from '../../core/interceptors/auth.interceptor';
import { EyeToggleComponent } from '../../shared/components/ui.components';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, EyeToggleComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="login">
      <section class="panel">
        <div class="brand">
          <img src="/logo-abd.png" alt="Laboratorios ABD" class="brand-logo" />
          <div>
            <strong>SGRH</strong>
            <small>Sistema de Gestion de Recursos Humanos</small>
          </div>
        </div>

        <h1>Ingrese a su cuenta</h1>
        <p class="muted">Use el correo institucional que le asigno Recursos Humanos.</p>

        <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
          <div class="field">
            <label for="email">Correo electronico</label>
            <input
              id="email"
              type="email"
              formControlName="email"
              autocomplete="username"
              placeholder="nombre@empresa.bo"
            />
            @if (form.controls.email.touched && form.controls.email.invalid) {
              <span class="error-text">Ingrese un correo valido</span>
            }
          </div>

          <div class="field">
            <label for="password">Contrasena</label>
            <div class="password-field">
              <input
                id="password"
                [type]="verClave() ? 'text' : 'password'"
                formControlName="password"
                autocomplete="current-password" 
              />
              <app-eye-toggle [visible]="verClave()" (toggled)="verClave.set($event)" />
            </div>
            @if (form.controls.password.touched && form.controls.password.invalid) {
              <span class="error-text">La contrasena es obligatoria</span>
            }
          </div>

          @if (error()) {
            <div class="alert">{{ error() }}</div>
          }

          <button class="btn btn-primary btn-block" type="submit" [disabled]="loading()">
            @if (loading()) {
              <span class="spinner" style="width:16px;height:16px;border-width:2px"></span>
            }
            {{ loading() ? 'Verificando...' : 'Ingresar' }}
          </button>
        </form>

        <p class="foot muted">
          Su sesion se cierra automaticamente por seguridad. Si olvido su contrasena, solicite el
          restablecimiento al administrador del sistema.
        </p>
      </section>

      <aside class="art">
        <h2>Gestion de personal conforme a la normativa boliviana</h2>
        <ul>
          <li>Vacaciones por antiguedad segun la Ley General del Trabajo</li>
          <li>Boletas de pago con AFP y RC-IVA parametrizables</li>
          <li>Permisos de lactancia (Ley 3460) con alertas de vencimiento</li>
          <li>Asistencia, horarios y carga masiva desde Excel</li>
        </ul>
      </aside>
    </div>
  `,
  styles: [
    `
      .login {
        min-height: 100vh;
        display: grid;
        grid-template-columns: minmax(360px, 460px) 1fr;
        background: var(--canvas);
      }
      .panel {
        background: var(--surface);
        padding: 46px 44px;
        display: flex;
        flex-direction: column;
        gap: 14px;
        justify-content: center;
      }
      .brand {
        display: flex;
        align-items: center;
        gap: 11px;
        margin-bottom: 18px;
      }
      .brand-logo {
        height: 42px;
        width: auto;
      }
      .brand strong {
        display: block;
        font-size: 16px;
      }
      .brand small {
        color: var(--ink-500);
        font-size: 11.5px;
      }
      h1 {
        font-size: 21px;
      }
      form {
        display: flex;
        flex-direction: column;
        gap: 14px;
        margin-top: 10px;
      }
      .alert {
        padding: 10px 12px;
        border-radius: 10px;
        background: var(--danger-100);
        color: var(--danger-700);
        font-size: 12.5px;
        font-weight: 500;
      }
      .foot {
        font-size: 11.5px;
        margin-top: 6px;
      }
      .art {
        background: linear-gradient(145deg, var(--brand-800), var(--brand-600));
        color: #e0f2fe;
        padding: 60px 56px;
        display: flex;
        flex-direction: column;
        justify-content: center;
        gap: 20px;
      }
      .art h2 {
        color: #fff;
        font-size: 28px;
        max-width: 520px;
        line-height: 1.25;
      }
      .art ul {
        margin: 0;
        padding-left: 18px;
        display: flex;
        flex-direction: column;
        gap: 10px;
        font-size: 14px;
        max-width: 460px;
      }
      @media (max-width: 900px) {
        .login {
          grid-template-columns: 1fr;
        }
        .art {
          display: none;
        }
        .panel {
          padding: 32px 22px;
        }
      }
    `,
  ],
})
export class LoginComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly verClave = signal(false);

  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
  });

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.loading.set(true);
    this.error.set(null);

    const { email, password } = this.form.getRawValue();
    this.auth.login(email, password).subscribe({
      next: () => {
        this.loading.set(false);
        const redirect = this.route.snapshot.queryParamMap.get('redirect') ?? '/dashboard';
        void this.router.navigateByUrl(redirect);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(apiErrorMessage(err, 'No se pudo iniciar sesion'));
      },
    });
  }
}
