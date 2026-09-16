import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { AuthService } from './auth.service';
import { ToastService } from './toast.service';

/** Minutos de inactividad tras los cuales se cierra la sesion (igual que el backend). */
const MINUTOS_INACTIVIDAD = 15;
/** Aviso previo, para que a nadie se le corte el trabajo sin advertencia. */
const AVISO_ANTES_MS = 60_000;
/** Cada cuanto se renueva el token mientras la persona esta trabajando. */
const RENOVAR_CADA_MS = 10 * 60_000;

const EVENTOS = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click'];

/**
 * Cierre de sesion por inactividad.
 *
 * Mientras hay actividad el token se renueva solo, asi la sesion no se corta a
 * alguien que esta trabajando. Si no hay actividad, no se renueva nada y a los
 * 15 minutos se cierra: el backend ademas lo verifica por su cuenta, esto es
 * para que la pantalla no quede abierta con datos de personal a la vista.
 */
@Injectable({ providedIn: 'root' })
export class IdleService {
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  private ultimaActividad = Date.now();
  private ultimaRenovacion = Date.now();
  private intervalo?: ReturnType<typeof setInterval>;
  private avisado = false;
  private iniciado = false;

  readonly minutosRestantes = signal(MINUTOS_INACTIVIDAD);

  iniciar(): void {
    if (this.iniciado) return;
    this.iniciado = true;

    const registrar = () => this.registrarActividad();
    EVENTOS.forEach((evento) => document.addEventListener(evento, registrar, { passive: true }));

    this.intervalo = setInterval(() => this.revisar(), 15_000);

    this.destroyRef.onDestroy(() => {
      EVENTOS.forEach((evento) => document.removeEventListener(evento, registrar));
      clearInterval(this.intervalo);
    });
  }

  private registrarActividad(): void {
    this.ultimaActividad = Date.now();
    this.avisado = false;
  }

  private revisar(): void {
    if (!this.auth.isAuthenticated()) return;

    const inactivoMs = Date.now() - this.ultimaActividad;
    const restanteMs = MINUTOS_INACTIVIDAD * 60_000 - inactivoMs;
    this.minutosRestantes.set(Math.max(0, Math.ceil(restanteMs / 60_000)));

    if (restanteMs <= 0) {
      this.auth.logout();
      this.toast.warn(
        'Sesion cerrada',
        `Estuvo ${MINUTOS_INACTIVIDAD} minutos sin actividad. Vuelva a ingresar.`,
      );
      return;
    }

    if (restanteMs <= AVISO_ANTES_MS && !this.avisado) {
      this.avisado = true;
      this.toast.warn('Su sesion esta por cerrarse', 'Mueva el mouse o toque la pantalla para seguir.');
      return;
    }

    // Con actividad reciente, se renueva el token antes de que expire.
    const huboActividad = inactivoMs < RENOVAR_CADA_MS;
    if (huboActividad && Date.now() - this.ultimaRenovacion > RENOVAR_CADA_MS) {
      this.ultimaRenovacion = Date.now();
      this.auth.refresh().subscribe({ error: () => undefined });
    }
  }
}
