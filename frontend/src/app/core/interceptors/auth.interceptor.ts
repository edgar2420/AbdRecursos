import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { BehaviorSubject, catchError, filter, switchMap, take, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { ToastService } from '../services/toast.service';

let refreshing = false;
const refreshed$ = new BehaviorSubject<string | null>(null);

/**
 * Adjunta el JWT, refresca el token cuando expira y centraliza el manejo de
 * 401/403 (seccion 4.3). Una sola peticion de refresco a la vez: el resto
 * espera y se reintenta con el token nuevo.
 */
export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const auth = inject(AuthService);
  const toast = inject(ToastService);
  const router = inject(Router);

  const isAuthEndpoint = request.url.includes('/auth/login') || request.url.includes('/auth/refresh');
  const token = auth.token();

  const authorized =
    token && !isAuthEndpoint
      ? request.clone({ setHeaders: { Authorization: `Bearer ${token}` }, withCredentials: true })
      : request.clone({ withCredentials: true });

  return next(authorized).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401 && !isAuthEndpoint) {
        if (refreshing) {
          return refreshed$.pipe(
            filter((value): value is string => value !== null),
            take(1),
            switchMap((fresh) =>
              next(authorized.clone({ setHeaders: { Authorization: `Bearer ${fresh}` } })),
            ),
          );
        }

        refreshing = true;
        refreshed$.next(null);
        return auth.refresh().pipe(
          switchMap((response) => {
            refreshing = false;
            refreshed$.next(response.data.accessToken);
            return next(
              authorized.clone({ setHeaders: { Authorization: `Bearer ${response.data.accessToken}` } }),
            );
          }),
          catchError((refreshError) => {
            refreshing = false;
            auth.clearSession();
            void router.navigate(['/login']);
            toast.warn('Sesion expirada', 'Vuelva a iniciar sesion para continuar');
            return throwError(() => refreshError);
          }),
        );
      }

      if (error.status === 403) {
        toast.error('Acceso denegado', error.error?.error?.message ?? 'No tiene permisos para esta accion');
      } else if (error.status === 0) {
        toast.error('Sin conexion', 'No se pudo contactar al servidor');
      } else if (error.status >= 500) {
        toast.error('Error del servidor', error.error?.error?.message ?? 'Intente nuevamente en unos minutos');
      }

      return throwError(() => error);
    }),
  );
};

/** Mensaje legible de un error de la API para mostrar en formularios. */
export function apiErrorMessage(error: unknown, fallback = 'Ocurrio un error'): string {
  const httpError = error as HttpErrorResponse;
  const body = httpError?.error?.error;
  if (!body) return fallback;
  if (Array.isArray(body.details) && body.details.length > 0) {
    return body.details.map((d: { field: string; message: string }) => `${d.field}: ${d.message}`).join(' | ');
  }
  return body.message ?? fallback;
}
