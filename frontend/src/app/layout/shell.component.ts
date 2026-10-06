import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../core/services/auth.service';
import { IdleService } from '../core/services/idle.service';
import { Role } from '../core/models/api.models';
import { EtiquetaPipe } from '../shared/pipes/format.pipes';

interface NavItem {
  path: string;
  label: string;
  /** Trazos SVG (viewBox 24x24, estilo lineal). */
  icon: string[];
  roles?: Role[];
}

const NAV: NavItem[] = [
  { path: '/dashboard', label: 'Panel', icon: ['M3 3h7v9H3z', 'M14 3h7v5h-7z', 'M14 12h7v9h-7z', 'M3 16h7v5H3z'] },
  { path: '/mi-perfil', label: 'Mi perfil', icon: ['M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z', 'M20 21a8 8 0 0 0-16 0'] },
  { path: '/asistencia/marcar', label: 'Marcar asistencia', icon: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z', 'M12 7v5l3 2'] },
  {
    path: '/vacaciones',
    label: 'Vacaciones',
    icon: [
      'M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
      'M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41',
    ],
  },
  {
    path: '/papeletas',
    label: 'Papeletas',
    icon: [
      'M9 3h6a1 1 0 0 1 1 1v1H8V4a1 1 0 0 1 1-1z',
      'M16 5h2a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2',
      'M8 12h8M8 16h5',
    ],
  },
  { path: '/boletas', label: 'Boletas de pago', icon: ['M4 3h16v18l-3-2-2.5 2-2.5-2-2.5 2L7 19l-3 2z', 'M8 8h8M8 12h8M8 16h4'] },
  {
    path: '/empleados',
    label: 'Empleados',
    icon: [
      'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2',
      'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
      'M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
    ],
    roles: ['SUPERVISOR', 'HR', 'ADMIN'],
  },
  { path: '/asistencia', label: 'Asistencia', icon: ['M3 3v18h18', 'M7 16v-4M12 16V8M17 16v-7'], roles: ['SUPERVISOR', 'HR', 'ADMIN'] },
  {
    path: '/horarios',
    label: 'Horarios y turnos',
    icon: ['M8 2v4M16 2v4', 'M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z', 'M3 10h18'],
    roles: ['HR', 'ADMIN'],
  },
  {
    path: '/lactancia',
    label: 'Lactancia',
    icon: ['M20.5 8.5c0 4.5-8.5 10-8.5 10s-8.5-5.5-8.5-10a4.5 4.5 0 0 1 8.5-2 4.5 4.5 0 0 1 8.5 2z'],
    roles: ['HR', 'ADMIN'],
  },
  {
    path: '/importaciones',
    label: 'Carga masiva',
    icon: ['M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4', 'M17 8l-5-5-5 5', 'M12 3v12'],
    roles: ['HR', 'ADMIN'],
  },
  {
    path: '/usuarios',
    label: 'Usuarios y roles',
    icon: ['M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z', 'M9 12l2 2 4-4'],
    roles: ['ADMIN'],
  },
  { path: '/auditoria', label: 'Auditoria', icon: ['M3 12a9 9 0 1 0 3-6.7L3 8', 'M3 3v5h5', 'M12 7v5l4 2'], roles: ['ADMIN'] },
];

const SIDEBAR_COLLAPSED_KEY = 'sgrh.sidebar.collapsed';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive, EtiquetaPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a class="skip-link" href="#contenido" (click)="saltarAlContenido($event)">Saltar al contenido</a>
    <div class="shell" [class.nav-open]="menuOpen()" [class.collapsed]="collapsed()">
      <aside class="sidebar" id="menu-lateral">
        <div class="brand">
          @if (collapsed()) {
            <div class="brand-mark-crop">
              <img src="/logo-abd.png" alt="Laboratorios ABD" />
            </div>
          } @else {
            <div class="brand-mark-full">
              <img src="/logo-abd.png" alt="Laboratorios ABD" />
            </div>
            <div class="brand-text">
              <strong>SGRH</strong>
              <small>Recursos Humanos</small>
            </div>
          }
        </div>

        <nav aria-label="Menu principal">
          @for (item of visibleNav(); track item.path) {
            <a
              [routerLink]="item.path"
              routerLinkActive="active"
              ariaCurrentWhenActive="page"
              [routerLinkActiveOptions]="{ exact: item.path.startsWith('/asistencia') }"
              [title]="collapsed() ? item.label : ''"
              [attr.aria-label]="collapsed() ? item.label : null"
              (click)="menuOpen.set(false)"
            >
              <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                @for (d of item.icon; track $index) {
                  <path [attr.d]="d" />
                }
              </svg>
              @if (!collapsed()) {
                <span class="nav-label">{{ item.label }}</span>
              }
            </a>
          }
        </nav>

        @if (!collapsed()) {
          <div class="sidebar-foot">
            <span class="credit">Desarrollado por Ing. Edgar Rojas</span>
          </div>
        }
      </aside>

      <button
        type="button"
        class="collapse-handle"
        [title]="collapsed() ? 'Expandir menu' : 'Contraer menu'"
        [attr.aria-label]="collapsed() ? 'Expandir menu' : 'Contraer menu'"
        [attr.aria-expanded]="!collapsed()"
        aria-controls="menu-lateral"
        (click)="toggleCollapsed()"
      >
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">
          @if (collapsed()) {
            <path d="m9 18 6-6-6-6" />
          } @else {
            <path d="m15 18-6-6 6-6" />
          }
        </svg>
      </button>

      <div class="main">
        <header class="topbar">
          <button
            type="button"
            class="btn btn-ghost btn-sm menu-btn"
            aria-label="Abrir menu"
            aria-controls="menu-lateral"
            [attr.aria-expanded]="menuOpen()"
            (click)="menuOpen.set(!menuOpen())"
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
              <path d="M4 6h16M4 12h16M4 18h16" />
            </svg>
            Menu
          </button>
          <div class="flex-1"></div>
          <div class="user">
            <div class="user-info hidden-sm">
              <strong>{{ auth.user()?.email }}</strong>
              <small>{{ auth.role() | etiqueta }}</small>
            </div>
            <span class="avatar">{{ initials() }}</span>
            <button class="btn btn-ghost btn-sm" (click)="auth.logout()">Salir</button>
          </div>
        </header>

        <main id="contenido" tabindex="-1"><router-outlet></router-outlet></main>
      </div>
    </div>
  `,
  styleUrl: './shell.component.scss',
})
export class ShellComponent {
  readonly auth = inject(AuthService);
  private readonly idle = inject(IdleService);
  readonly menuOpen = signal(false);
  readonly collapsed = signal(leerColapsado());

  saltarAlContenido(event: Event): void {
    event.preventDefault();
    document.getElementById('contenido')?.focus();
  }

  toggleCollapsed(): void {
    const next = !this.collapsed();
    this.collapsed.set(next);
    try {
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? '1' : '0');
    } catch {}
  }

  constructor() {
    this.idle.iniciar();
  }

  readonly visibleNav = computed(() => {
    const role = this.auth.role();
    return NAV.filter((item) => !item.roles || (role !== null && item.roles.includes(role)));
  });

  readonly initials = computed(() => {
    const email = this.auth.user()?.email ?? '';
    return email.slice(0, 2).toUpperCase();
  });
}

function leerColapsado(): boolean {
  try {
    return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1';
  } catch {
    return false;
  }
}
