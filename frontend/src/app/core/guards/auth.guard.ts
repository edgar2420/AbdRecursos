import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { ToastService } from '../services/toast.service';
import { Role } from '../models/api.models';

/** Guard de autenticacion: solo UX, el backend siempre revalida (8.2). */
export const authGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (auth.isAuthenticated()) return true;
  return router.createUrlTree(['/login'], { queryParams: { redirect: state.url } });
};

/** Guard de rol por feature (seccion 4.3). */
export function roleGuard(...roles: Role[]): CanActivateFn {
  return () => {
    const auth = inject(AuthService);
    const router = inject(Router);
    const toast = inject(ToastService);
    if (!auth.isAuthenticated()) return router.createUrlTree(['/login']);
    if (auth.hasRole(...roles)) return true;
    toast.warn('Seccion no disponible', 'Su rol no tiene acceso a esa seccion');
    return router.createUrlTree(['/dashboard']);
  };
}

export const loginGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.isAuthenticated() ? router.createUrlTree(['/dashboard']) : true;
};
