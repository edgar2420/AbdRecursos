import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
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
          <p class="muted">
            Escriba su codigo de empleado seguido de sus apellidos completos. No importan los espacios, guiones,
            tildes ni mayusculas.
          </p>

          <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
            <div class="field">
              <label for="username">Usuario</label>
              <div class="input-icon">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="8" r="3.5" />
                  <path d="M5 20c1.2-3.4 4-5 7-5s5.8 1.6 7 5" />
                </svg>
                <input
                  id="username"
                  type="text"
                  formControlName="username"
                  autocomplete="username"
                  placeholder="Ej.: ABD-0000 Perez Lopez"
                />
              </div>
              @if (form.controls.username.touched && form.controls.username.invalid) {
                <span class="error-text">Ingrese su codigo de empleado y apellido</span>
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
              <div class="alert" role="alert">
                <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 8v5M12 16h.01" />
                </svg>
                {{ error() }}
              </div>
            }

            <button class="btn btn-primary btn-block" type="submit" [disabled]="loading()">
              @if (loading()) {
                <span class="spinner spinner-sm"></span>
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
  styleUrl: './login.component.scss',
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
    username: ['', [Validators.required]],
    password: ['', [Validators.required]],
  });

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.loading.set(true);
    this.error.set(null);

    const { username, password } = this.form.getRawValue();
    this.auth.login(username, password).subscribe({
      next: (response) => {
        this.loading.set(false);
        if (response.data.user.mustChangePassword) {
          void this.router.navigateByUrl('/cambiar-clave');
          return;
        }
        const redirect = this.route.snapshot.queryParamMap.get('redirect') ?? '/dashboard';
        void this.router.navigateByUrl(redirect);
      },
      error: (err: HttpErrorResponse) => {
        this.loading.set(false);
        this.error.set(mensajeDeLogin(err));
      },
    });
  }
}

function mensajeDeLogin(err: HttpErrorResponse): string {
  const restantes = Number(err.headers?.get('RateLimit-Remaining'));
  const reinicio = Number(err.headers?.get('RateLimit-Reset'));

  if (err.status === 429) {
    const minutos = Number.isFinite(reinicio) && reinicio > 0 ? Math.ceil(reinicio / 60) : 15;
    return `Demasiados intentos fallidos. Por seguridad el acceso queda bloqueado; intente de nuevo en ${minutos} minuto${minutos === 1 ? '' : 's'}.`;
  }
  if (err.status === 401) {
    const base =
      'Usuario o contraseña incorrectos. Si aun no cambio su contraseña, use la que le entrego Recursos Humanos.';
    if (err.headers?.has('RateLimit-Remaining') && Number.isFinite(restantes)) {
      if (restantes === 0) return `${base} Este fue su ultimo intento: el proximo error bloqueara el acceso por unos minutos.`;
      return `${base} Le queda${restantes === 1 ? '' : 'n'} ${restantes} intento${restantes === 1 ? '' : 's'} antes de un bloqueo temporal.`;
    }
    return base;
  }
  return apiErrorMessage(err, 'No se pudo iniciar sesion');
}
