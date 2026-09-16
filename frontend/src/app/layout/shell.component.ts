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
  icon: string;
  roles?: Role[];
}

/** Navegacion: se oculta lo que el rol no puede usar (la API igual lo bloquea). */
const NAV: NavItem[] = [
  { path: '/dashboard', label: 'Panel', icon: '▦' },
  { path: '/mi-perfil', label: 'Mi perfil', icon: '☺' },
  { path: '/asistencia/marcar', label: 'Marcar asistencia', icon: '◷' },
  { path: '/vacaciones', label: 'Vacaciones', icon: '☀' },
  { path: '/papeletas', label: 'Papeletas', icon: '✎' },
  { path: '/boletas', label: 'Boletas de pago', icon: '₿' },
  { path: '/empleados', label: 'Empleados', icon: '≡', roles: ['SUPERVISOR', 'HR', 'ADMIN'] },
  { path: '/asistencia', label: 'Asistencia', icon: '◴', roles: ['SUPERVISOR', 'HR', 'ADMIN'] },
  { path: '/horarios', label: 'Horarios y turnos', icon: '◫', roles: ['HR', 'ADMIN'] },
  { path: '/lactancia', label: 'Lactancia', icon: '♡', roles: ['HR', 'ADMIN'] },
  { path: '/importaciones', label: 'Carga masiva', icon: '⇪', roles: ['HR', 'ADMIN'] },
  { path: '/parametros', label: 'Parametros legales', icon: '§', roles: ['HR', 'ADMIN'] },
  { path: '/usuarios', label: 'Usuarios y roles', icon: '◎', roles: ['ADMIN'] },
];

const SIDEBAR_COLLAPSED_KEY = 'sgrh.sidebar.collapsed';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive, EtiquetaPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="shell" [class.nav-open]="menuOpen()" [class.collapsed]="collapsed()">
      <aside class="sidebar">
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

        <nav>
          @for (item of visibleNav(); track item.path) {
            <a
              [routerLink]="item.path"
              routerLinkActive="active"
              [routerLinkActiveOptions]="{ exact: item.path === '/asistencia/marcar' }"
              [title]="collapsed() ? item.label : ''"
              (click)="menuOpen.set(false)"
            >
              <span class="nav-icon" aria-hidden="true">{{ item.icon }}</span>
              @if (!collapsed()) {
                <span class="nav-label">{{ item.label }}</span>
              }
            </a>
          }
        </nav>

        @if (!collapsed()) {
          <div class="sidebar-foot">
            <span class="muted">Bolivia · Ley General del Trabajo</span>
          </div>
        }
      </aside>

      <button
        type="button"
        class="collapse-handle"
        [title]="collapsed() ? 'Expandir menu' : 'Contraer menu'"
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
          <button class="btn btn-ghost btn-sm menu-btn" (click)="menuOpen.set(!menuOpen())">Menu</button>
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

        <main><router-outlet></router-outlet></main>
      </div>
    </div>
  `,
  styles: [
    `
      .shell {
        display: flex;
        min-height: 100vh;
        position: relative;
      }

      .sidebar {
        width: var(--sidebar-width);
        flex-shrink: 0;
        background: linear-gradient(180deg, var(--brand-900), var(--brand-800));
        color: #e0f2fe;
        display: flex;
        flex-direction: column;
        position: sticky;
        top: 0;
        height: 100vh;
        transition: width 0.18s ease;
        overflow: hidden;
      }
      .collapsed .sidebar {
        width: 72px;
      }

      /* Manija siempre visible a caballo entre el sidebar y el contenido:
         nunca desaparece, este contraido o expandido, ni depende de hover. */
      .collapse-handle {
        position: absolute;
        top: 22px;
        left: calc(var(--sidebar-width) - 13px);
        z-index: 30;
        width: 26px;
        height: 26px;
        display: grid;
        place-items: center;
        border-radius: 999px;
        background: var(--surface);
        border: 1px solid var(--ink-200);
        color: var(--ink-500);
        box-shadow: var(--shadow-xs);
        transition: left 0.18s ease, color 0.15s ease, border-color 0.15s ease;
      }
      .collapse-handle:hover {
        color: var(--brand-700);
        border-color: var(--brand-300);
      }
      .collapsed .collapse-handle {
        left: 59px;
      }
      @media (max-width: 900px) {
        .collapse-handle {
          display: none;
        }
      }

      .brand {
        display: flex;
        align-items: center;
        gap: 11px;
        padding: 18px 14px 16px;
      }
      /* El logo trae su propio texto oscuro: una placa clara detras asegura
         contraste sobre el fondo oscuro del sidebar. */
      .brand-mark-full {
        flex-shrink: 0;
        background: #fff;
        border-radius: 8px;
        padding: 5px 9px;
        display: flex;
        align-items: center;
      }
      .brand-mark-full img {
        height: 22px;
        width: auto;
        display: block;
      }
      .brand-mark-crop {
        width: 38px;
        height: 38px;
        flex-shrink: 0;
        overflow: hidden;
        border-radius: 10px;
        background: #fff;
      }
      .brand-mark-crop img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        object-position: 0% 50%;
      }
      .brand-text {
        flex: 1;
        min-width: 0;
      }
      .brand strong {
        display: block;
        color: #fff;
        font-size: 15px;
      }
      .brand small {
        color: var(--brand-300);
        font-size: 11.5px;
      }
      .collapsed .brand {
        justify-content: center;
        padding: 18px 0 16px;
      }

      nav {
        display: flex;
        flex-direction: column;
        gap: 2px;
        padding: 6px 10px;
        overflow-y: auto;
        flex: 1;
      }

      nav a {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 9px 12px;
        border-radius: 10px;
        color: #cbe9f5;
        font-size: 13px;
        font-weight: 500;
        transition: background 0.15s ease, color 0.15s ease;
      }
      nav a:hover {
        background: rgba(255, 255, 255, 0.08);
        color: #fff;
        text-decoration: none;
      }
      nav a.active {
        background: var(--brand-600);
        color: #fff;
        font-weight: 600;
      }
      .nav-icon {
        width: 18px;
        text-align: center;
        opacity: 0.9;
        flex-shrink: 0;
      }
      .collapsed nav a {
        justify-content: center;
        padding: 10px 0;
      }

      .sidebar-foot {
        padding: 14px 18px;
        border-top: 1px solid rgba(255, 255, 255, 0.1);
        font-size: 11px;
        color: var(--brand-300);
      }

      .main {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
      }

      .topbar {
        height: var(--header-height);
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 0 22px;
        background: var(--surface);
        border-bottom: 1px solid var(--ink-200);
        position: sticky;
        top: 0;
        z-index: 20;
      }

      .user {
        display: flex;
        align-items: center;
        gap: 10px;
      }
      .user-info {
        text-align: right;
        line-height: 1.25;
      }
      .user-info strong {
        display: block;
        font-size: 12.5px;
      }
      .user-info small {
        color: var(--ink-500);
        font-size: 11.5px;
      }
      .avatar {
        width: 34px;
        height: 34px;
        display: grid;
        place-items: center;
        border-radius: 50%;
        background: var(--brand-100);
        color: var(--brand-800);
        font-weight: 700;
        font-size: 12.5px;
      }

      .menu-btn {
        display: none;
      }

      @media (max-width: 900px) {
        .sidebar {
          position: fixed;
          z-index: 50;
          transform: translateX(-100%);
          transition: transform 0.2s ease;
          box-shadow: var(--shadow-md);
        }
        .nav-open .sidebar {
          transform: none;
        }
        .menu-btn {
          display: inline-flex;
        }
      }
    `,
  ],
})
export class ShellComponent {
  readonly auth = inject(AuthService);
  private readonly idle = inject(IdleService);
  readonly menuOpen = signal(false);
  readonly collapsed = signal(leerColapsado());

  toggleCollapsed(): void {
    const next = !this.collapsed();
    this.collapsed.set(next);
    try {
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? '1' : '0');
    } catch {
      // almacenamiento no disponible (modo privado, etc.): no es critico.
    }
  }

  constructor() {
    // Cierre por inactividad: solo corre dentro de la zona autenticada.
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
