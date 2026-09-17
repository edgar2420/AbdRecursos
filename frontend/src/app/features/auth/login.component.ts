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
      <div class="blob blob-a" aria-hidden="true"></div>
      <div class="blob blob-b" aria-hidden="true"></div>
      <div class="blob blob-c" aria-hidden="true"></div>

      <div class="stage">
        <section class="card">
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
              <div class="input-icon">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="2" y="4" width="20" height="16" rx="2.5" />
                  <path d="m3 6.5 8.4 6a1 1 0 0 0 1.2 0L21 6.5" />
                </svg>
                <input
                  id="email"
                  type="email"
                  formControlName="email"
                  autocomplete="username"
                  placeholder="nombre@empresa.bo"
                />
              </div>
              @if (form.controls.email.touched && form.controls.email.invalid) {
                <span class="error-text">Ingrese un correo valido</span>
              }
            </div>

            <div class="field">
              <label for="password">Contraseña</label>
              <div class="input-icon">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="4" y="10.5" width="16" height="10" rx="2.5" />
                  <path d="M7.5 10.5V7a4.5 4.5 0 0 1 9 0v3.5" />
                </svg>
                <div class="password-field">
                  <input
                    id="password"
                    [type]="verClave() ? 'text' : 'password'"
                    formControlName="password"
                    autocomplete="current-password"
                  />
                  <app-eye-toggle [visible]="verClave()" (toggled)="verClave.set($event)" />
                </div>
              </div>
              @if (form.controls.password.touched && form.controls.password.invalid) {
                <span class="error-text">La contraseña es obligatoria</span>
              }
            </div>

            @if (error()) {
              <div class="alert">
                <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 8v5M12 16h.01" />
                </svg>
                {{ error() }}
              </div>
            }

            <button class="btn btn-primary btn-block" type="submit" [disabled]="loading()">
              @if (loading()) {
                <span class="spinner" style="width:16px;height:16px;border-width:2px"></span>
              }
              {{ loading() ? 'Verificando...' : 'Ingresar' }}
            </button>
          </form>

          <p class="foot muted">
            Su sesion se cierra automaticamente por seguridad. Si olvido su contraseña, solicite el
            restablecimiento al administrador del sistema.
          </p>
        </section>

        <aside class="art">
          <span class="art-kicker">Laboratorios ABD</span>
          <h2>Gestion de personal conforme a la normativa boliviana</h2>
          <ul>
            <li>
              <span class="dot"></span>
              Vacaciones por antiguedad segun la Ley General del Trabajo
            </li>
            <li>
              <span class="dot"></span>
              Boletas de pago con AFP y RC-IVA parametrizables
            </li>
            <li>
              <span class="dot"></span>
              Permisos de lactancia (Ley 3460) con alertas de vencimiento
            </li>
            <li>
              <span class="dot"></span>
              Asistencia, horarios y carga masiva desde Excel
            </li>
          </ul>
        </aside>
      </div>
    </div>
  `,
  styles: [
    `
      .login {
        position: relative;
        min-height: 100vh;
        overflow: hidden;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 32px 20px;
        background: linear-gradient(160deg, var(--brand-900) 0%, var(--brand-800) 42%, #082a38 100%);
      }

      /* Formas decoradas flotando de fondo: le dan profundidad al degrade
         plano sin depender de ninguna imagen. Se apagan si el usuario pide
         menos movimiento. */
      .blob {
        position: absolute;
        border-radius: 50%;
        filter: blur(60px);
        opacity: 0.55;
        pointer-events: none;
      }
      .blob-a {
        width: 520px;
        height: 520px;
        top: -180px;
        left: -140px;
        background: radial-gradient(circle, var(--brand-500), transparent 70%);
        animation: float-a 16s ease-in-out infinite;
      }
      .blob-b {
        width: 420px;
        height: 420px;
        bottom: -160px;
        right: -100px;
        background: radial-gradient(circle, var(--brand-300), transparent 70%);
        animation: float-b 20s ease-in-out infinite;
      }
      .blob-c {
        width: 300px;
        height: 300px;
        top: 30%;
        right: 12%;
        background: radial-gradient(circle, #fde68a, transparent 72%);
        opacity: 0.18;
        animation: float-c 24s ease-in-out infinite;
      }
      @keyframes float-a {
        0%, 100% { transform: translate(0, 0) scale(1); }
        50% { transform: translate(40px, 30px) scale(1.08); }
      }
      @keyframes float-b {
        0%, 100% { transform: translate(0, 0) scale(1); }
        50% { transform: translate(-30px, -24px) scale(1.05); }
      }
      @keyframes float-c {
        0%, 100% { transform: translate(0, 0); }
        50% { transform: translate(-20px, 26px); }
      }
      @media (prefers-reduced-motion: reduce) {
        .blob { animation: none; }
      }

      .stage {
        position: relative;
        z-index: 1;
        width: 100%;
        max-width: 980px;
        display: grid;
        grid-template-columns: minmax(340px, 440px) 1fr;
        align-items: stretch;
        border-radius: 28px;
        overflow: hidden;
        box-shadow: 0 30px 70px -20px rgba(3, 22, 34, 0.55);
        animation: rise 0.5s cubic-bezier(0.22, 1, 0.36, 1) both;
      }
      @keyframes rise {
        from { opacity: 0; transform: translateY(18px) scale(0.98); }
        to { opacity: 1; transform: none; }
      }
      @media (prefers-reduced-motion: reduce) {
        .stage { animation: none; }
      }

      .card {
        background: var(--surface);
        padding: 44px 40px;
        display: flex;
        flex-direction: column;
        gap: 14px;
        justify-content: center;
      }
      .brand {
        display: flex;
        align-items: center;
        gap: 11px;
        margin-bottom: 14px;
      }
      .brand-logo {
        height: 42px;
        width: auto;
        filter: drop-shadow(0 4px 10px rgba(15, 23, 42, 0.12));
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
        font-size: 22px;
        margin-bottom: 2px;
      }
      form {
        display: flex;
        flex-direction: column;
        gap: 15px;
        margin-top: 8px;
      }

      /* Icono dentro del campo: el input le deja el hueco con padding-left. */
      .input-icon {
        position: relative;
      }
      .input-icon > svg {
        position: absolute;
        left: 12px;
        top: 50%;
        transform: translateY(-50%);
        color: var(--ink-300);
        pointer-events: none;
        transition: color 0.15s ease;
        z-index: 1;
      }
      .input-icon input {
        padding-left: 36px;
      }
      .input-icon:focus-within > svg {
        color: var(--brand-600);
      }
      .input-icon .password-field {
        position: relative;
      }

      input,
      select {
        transition: border-color 0.15s ease, box-shadow 0.15s ease, transform 0.1s ease;
      }
      input:focus,
      select:focus {
        transform: translateY(-1px);
      }

      .btn-primary {
        background: linear-gradient(135deg, var(--brand-700), var(--brand-600));
        border: 0;
        box-shadow: 0 10px 24px -10px rgba(8, 145, 178, 0.55);
        transition: transform 0.15s ease, box-shadow 0.15s ease, filter 0.15s ease;
      }
      .btn-primary:hover:not(:disabled) {
        transform: translateY(-1px);
        box-shadow: 0 14px 28px -10px rgba(8, 145, 178, 0.6);
        filter: brightness(1.04);
      }
      .btn-primary:active:not(:disabled) {
        transform: translateY(0);
      }

      .alert {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 10px 12px;
        border-radius: 10px;
        background: var(--danger-100);
        color: var(--danger-700);
        font-size: 12.5px;
        font-weight: 500;
      }
      .alert svg {
        flex: none;
      }
      .foot {
        font-size: 11.5px;
        margin-top: 4px;
      }

      .art {
        position: relative;
        background: linear-gradient(160deg, rgba(255, 255, 255, 0.06), rgba(255, 255, 255, 0) 55%),
          linear-gradient(150deg, var(--brand-700), var(--brand-800) 60%, var(--brand-900));
        color: #e0f2fe;
        padding: 52px 48px;
        display: flex;
        flex-direction: column;
        justify-content: center;
        gap: 18px;
      }
      .art::before {
        content: '';
        position: absolute;
        inset: 0;
        background-image: radial-gradient(rgba(255, 255, 255, 0.14) 1px, transparent 1px);
        background-size: 22px 22px;
        opacity: 0.5;
        pointer-events: none;
      }
      .art-kicker {
        position: relative;
        font-size: 11.5px;
        font-weight: 700;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: var(--brand-300);
      }
      .art h2 {
        position: relative;
        color: #fff;
        font-size: 27px;
        max-width: 440px;
        line-height: 1.28;
        margin: 0;
      }
      .art ul {
        position: relative;
        list-style: none;
        margin: 4px 0 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: 13px;
        font-size: 13.5px;
        max-width: 420px;
      }
      .art li {
        display: flex;
        align-items: flex-start;
        gap: 10px;
        line-height: 1.4;
      }
      .art .dot {
        flex: none;
        width: 7px;
        height: 7px;
        margin-top: 6px;
        border-radius: 50%;
        background: var(--brand-300);
        box-shadow: 0 0 0 4px rgba(125, 211, 252, 0.18);
      }

      @media (max-width: 900px) {
        .stage {
          grid-template-columns: 1fr;
          border-radius: 22px;
        }
        .art {
          display: none;
        }
        .card {
          padding: 34px 26px;
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
