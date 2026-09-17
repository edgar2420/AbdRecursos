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
          <div class="art-glow" aria-hidden="true"></div>

          <span class="art-kicker">Sistema interno · Laboratorios ABD</span>
          <h2>Todo tu equipo, en un solo lugar</h2>
          <p class="art-lead">Vacaciones, boletas de pago, asistencia y permisos de tu personal, en una sola herramienta.</p>

          <div class="feature-grid">
            <div class="feature">
              <span class="feature-icon">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="3" />
                  <path d="M16 2v4M8 2v4M3 10h18" />
                </svg>
              </span>
              <span>Vacaciones</span>
            </div>
            <div class="feature">
              <span class="feature-icon">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M4 3h16v18l-3-2-2.5 2-2.5-2-2.5 2L7 19l-3 2Z" />
                  <path d="M8 8h8M8 12h8M8 16h4" />
                </svg>
              </span>
              <span>Boletas de pago</span>
            </div>
            <div class="feature">
              <span class="feature-icon">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M20.5 8.5c0 4.5-8.5 10-8.5 10s-8.5-5.5-8.5-10a4.5 4.5 0 0 1 8.5-2 4.5 4.5 0 0 1 8.5 2Z" />
                </svg>
              </span>
              <span>Lactancia</span>
            </div>
            <div class="feature">
              <span class="feature-icon">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 7v5l3.5 2" />
                </svg>
              </span>
              <span>Asistencia</span>
            </div>
          </div>

          <p class="art-legal">Conforme a la Ley General del Trabajo y normativa boliviana vigente.</p>
        </aside>
      </div>

      <footer class="credit">
        Desarrollado por <strong>Ing. Edgar Rojas</strong> · Sistema interno de Laboratorios ABD
      </footer>
    </div>
  `,
  styles: [
    `
      .login {
        font-family: 'Montserrat', var(--font);
        position: relative;
        min-height: 100vh;
        overflow: hidden;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 18px;
        padding: 32px 20px;
        background: linear-gradient(160deg, var(--brand-900) 0%, var(--brand-800) 42%, #082a38 100%);
      }
      .credit {
        position: relative;
        z-index: 1;
        font-size: 11.5px;
        color: rgba(224, 242, 254, 0.55);
        text-align: center;
      }
      .credit strong {
        color: rgba(224, 242, 254, 0.85);
        font-weight: 600;
      }

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
        max-width: 940px;
        display: flex;
        align-items: stretch;
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
        position: relative;
        z-index: 2;
        flex: none;
        width: min(400px, 100%);
        margin-right: -58px;
        background: var(--surface);
        border-radius: 26px;
        box-shadow: 0 26px 60px -18px rgba(3, 22, 34, 0.5);
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
        flex: 1;
        min-width: 0;
        border-radius: 26px;
        background: linear-gradient(160deg, rgba(255, 255, 255, 0.06), rgba(255, 255, 255, 0) 55%),
          linear-gradient(150deg, var(--brand-700), var(--brand-800) 60%, var(--brand-900));
        color: #e0f2fe;
        padding: 52px 48px 52px 104px;
        display: flex;
        flex-direction: column;
        justify-content: center;
        gap: 20px;
        overflow: hidden;
        box-shadow: 0 26px 60px -18px rgba(3, 22, 34, 0.5);
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
      .art-glow {
        position: absolute;
        width: 480px;
        height: 480px;
        right: -160px;
        top: -120px;
        border-radius: 50%;
        background: radial-gradient(circle, rgba(125, 211, 252, 0.35), transparent 70%);
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
        font-size: 30px;
        max-width: 420px;
        line-height: 1.24;
        margin: 0;
      }
      .art-lead {
        position: relative;
        margin: -8px 0 0;
        max-width: 400px;
        font-size: 14px;
        line-height: 1.5;
        color: rgba(224, 242, 254, 0.82);
      }

      .feature-grid {
        position: relative;
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;
        max-width: 400px;
        margin-top: 4px;
      }
      .feature {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 12px 14px;
        border-radius: 14px;
        background: rgba(255, 255, 255, 0.07);
        border: 1px solid rgba(255, 255, 255, 0.12);
        font-size: 13px;
        font-weight: 500;
        backdrop-filter: blur(2px);
      }
      .feature-icon {
        flex: none;
        display: grid;
        place-items: center;
        width: 32px;
        height: 32px;
        border-radius: 10px;
        background: rgba(125, 211, 252, 0.16);
        color: var(--brand-300);
      }
      .art-legal {
        position: relative;
        margin: 4px 0 0;
        font-size: 11.5px;
        color: rgba(224, 242, 254, 0.55);
        max-width: 400px;
      }

      @media (max-width: 900px) {
        .art {
          display: none;
        }
        .card {
          width: 100%;
          margin-right: 0;
          border-radius: 22px;
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
