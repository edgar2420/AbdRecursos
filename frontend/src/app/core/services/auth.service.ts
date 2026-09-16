import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Envelope, Role, SessionUser } from '../models/api.models';

const ACCESS_TOKEN_KEY = 'sgrh.access';
const USER_KEY = 'sgrh.user';

/**
 * Sesion del usuario.
 *
 * El access token vive en memoria/localStorage y el refresh token viaja en una
 * cookie httpOnly que el navegador envia solo a /auth (el JS nunca la lee).
 * Los permisos que se calculan aqui son solo para la UI: la fuente de verdad
 * es el backend (seccion 8.2).
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  private readonly accessToken = signal<string | null>(localStorage.getItem(ACCESS_TOKEN_KEY));
  readonly user = signal<SessionUser | null>(readStoredUser());

  readonly isAuthenticated = computed(() => this.accessToken() !== null && this.user() !== null);
  readonly role = computed<Role | null>(() => this.user()?.role ?? null);
  readonly employeeId = computed(() => this.user()?.employeeId ?? null);

  readonly isHr = computed(() => this.hasRole('HR', 'ADMIN'));
  readonly isAdmin = computed(() => this.hasRole('ADMIN'));
  readonly isSupervisor = computed(() => this.hasRole('SUPERVISOR', 'HR', 'ADMIN'));

  hasRole(...roles: Role[]): boolean {
    const current = this.user()?.role;
    return current ? roles.includes(current) : false;
  }

  token(): string | null {
    return this.accessToken();
  }

  login(email: string, password: string): Observable<Envelope<{ accessToken: string; user: SessionUser }>> {
    return this.http
      .post<Envelope<{ accessToken: string; user: SessionUser }>>(
        `${environment.apiUrl}/auth/login`,
        { email, password },
        { withCredentials: true },
      )
      .pipe(tap((response) => this.setSession(response.data.accessToken, response.data.user)));
  }

  refresh(): Observable<Envelope<{ accessToken: string }>> {
    return this.http
      .post<Envelope<{ accessToken: string }>>(
        `${environment.apiUrl}/auth/refresh`,
        {},
        { withCredentials: true },
      )
      .pipe(
        tap((response) => {
          this.accessToken.set(response.data.accessToken);
          localStorage.setItem(ACCESS_TOKEN_KEY, response.data.accessToken);
        }),
      );
  }

  me(): Observable<Envelope<SessionUser>> {
    return this.http
      .get<Envelope<SessionUser>>(`${environment.apiUrl}/auth/me`)
      .pipe(tap((response) => this.storeUser(response.data)));
  }

  changePassword(currentPassword: string, newPassword: string): Observable<void> {
    return this.http.post<void>(`${environment.apiUrl}/auth/change-password`, {
      currentPassword,
      newPassword,
    });
  }

  logout(redirect = true): void {
    this.http
      .post(`${environment.apiUrl}/auth/logout`, {}, { withCredentials: true })
      .subscribe({ complete: () => undefined, error: () => undefined });
    this.clearSession();
    if (redirect) void this.router.navigate(['/login']);
  }

  clearSession(): void {
    this.accessToken.set(null);
    this.user.set(null);
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }

  private setSession(token: string, user: SessionUser): void {
    this.accessToken.set(token);
    localStorage.setItem(ACCESS_TOKEN_KEY, token);
    this.storeUser(user);
  }

  private storeUser(user: SessionUser): void {
    this.user.set(user);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  }
}

function readStoredUser(): SessionUser | null {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SessionUser;
  } catch {
    return null;
  }
}
