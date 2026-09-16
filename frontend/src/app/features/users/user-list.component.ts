import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { apiErrorMessage } from '../../core/interceptors/auth.interceptor';
import { EmployeeOption, PageMeta, Role, SystemUser } from '../../core/models/api.models';
import {
  CardComponent,
  EyeToggleComponent,
  ModalComponent,
  PageHeaderComponent,
  PaginatorComponent,
  StateComponent,
} from '../../shared/components/ui.components';
import { EtiquetaPipe, FechaPipe } from '../../shared/pipes/format.pipes';

const ROLES: Role[] = ['EMPLOYEE', 'SUPERVISOR', 'HR', 'ADMIN'];

/** Gestion de usuarios y roles: exclusiva del Administrador (seccion 3). */
@Component({
  selector: 'app-user-list',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    PageHeaderComponent,
    CardComponent,
    PaginatorComponent,
    StateComponent,
    ModalComponent,
    EyeToggleComponent,
    FechaPipe,
    EtiquetaPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <app-page-header title="Usuarios y roles" subtitle="Accesos al sistema y permisos por rol">
        <button class="btn btn-primary btn-sm" (click)="openForm()">Nuevo usuario</button>
      </app-page-header>

      <app-card>
        <div class="row" style="align-items:flex-end;gap:12px">
          <div class="field flex-1">
            <label>Buscar por correo</label>
            <input type="search" [value]="search()" (input)="setSearch($any($event.target).value)" />
          </div>
          <div class="field">
            <label>Rol</label>
            <select [value]="role()" (change)="setRole($any($event.target).value)">
              <option value="">Todos</option>
              @for (item of roles; track item) {
                <option [value]="item">{{ item | etiqueta }}</option>
              }
            </select>
          </div>
        </div>
      </app-card>

      <app-card [padded]="false">
        @if (loading()) {
          <app-state mode="loading" title="Cargando usuarios"></app-state>
        } @else if (users().length === 0) {
          <app-state title="Sin usuarios" message="Cree el primer usuario del sistema."></app-state>
        } @else {
          <div class="table-wrap">
            <table class="data">
              <thead>
                <tr>
                  <th>Correo</th>
                  <th>Empleado vinculado</th>
                  <th>Rol</th>
                  <th>Ultimo ingreso</th>
                  <th>Estado</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                @for (user of users(); track user.id) {
                  <tr>
                    <td class="strong">{{ user.email }}</td>
                    <td class="muted">{{ user.employeeName ?? 'Sin vincular' }}</td>
                    <td>
                      <select
                        [value]="user.role"
                        (change)="changeRole(user, $any($event.target).value)"
                        [disabled]="user.id === auth.user()?.id"
                        style="width:auto;height:31px"
                      >
                        @for (item of roles; track item) {
                          <option [value]="item">{{ item | etiqueta }}</option>
                        }
                      </select>
                    </td>
                    <td class="nowrap muted">{{ user.lastLoginAt ? (user.lastLoginAt | fecha: true) : 'Nunca' }}</td>
                    <td>
                      <span class="badge" [class.badge-ok]="user.isActive" [class.badge-neutral]="!user.isActive">
                        {{ user.isActive ? 'Activo' : 'Inactivo' }}
                      </span>
                    </td>
                    <td class="text-right nowrap">
                      <button class="btn btn-ghost btn-sm" (click)="openReset(user)">Restablecer clave</button>
                      <button
                        class="btn btn-ghost btn-sm"
                        [disabled]="user.id === auth.user()?.id"
                        (click)="toggleActive(user)"
                      >
                        {{ user.isActive ? 'Desactivar' : 'Activar' }}
                      </button>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
          <app-paginator [meta]="meta()" (pageChange)="goToPage($event)" (limitChange)="setLimit($event)" />
        }
      </app-card>

      <app-card heading="Matriz de permisos">
        <div class="table-wrap">
          <table class="data">
            <thead>
              <tr>
                <th>Accion</th>
                <th>Empleado</th>
                <th>Supervisor</th>
                <th>RRHH</th>
                <th>Admin</th>
              </tr>
            </thead>
            <tbody>
              @for (row of matrix; track row.action) {
                <tr>
                  <td>{{ row.action }}</td>
                  @for (allowed of row.roles; track $index) {
                    <td [class.yes]="allowed" [class.no]="!allowed">{{ allowed ? 'Si' : 'No' }}</td>
                  }
                </tr>
              }
            </tbody>
          </table>
        </div>
      </app-card>
    </div>

    @if (formOpen()) {
      <app-modal title="Nuevo usuario" (closed)="formOpen.set(false)">
        <form [formGroup]="form" class="stack">
          <div class="field">
            <label>Correo *</label>
            <input type="email" formControlName="email" />
          </div>
          <div class="field">
            <label>Contrasena inicial *</label>
            <div class="password-field">
              <input [type]="verNueva() ? 'text' : 'password'" formControlName="password" />
              <app-eye-toggle [visible]="verNueva()" (toggled)="verNueva.set($event)" />
            </div>
            <span class="hint">Minimo 10 caracteres, con mayuscula, minuscula y numero.</span>
          </div>
          <div class="field">
            <label>Rol *</label>
            <select formControlName="role">
              @for (item of roles; track item) {
                <option [value]="item">{{ item | etiqueta }}</option>
              }
            </select>
          </div>
          <div class="field">
            <label>Empleado vinculado</label>
            <select formControlName="employeeId">
              <option value="">Sin vincular</option>
              @for (option of options(); track option.id) {
                <option [value]="option.id">{{ option.label }}</option>
              }
            </select>
            <span class="hint">Necesario para que el usuario vea sus boletas, vacaciones y asistencia.</span>
          </div>
        </form>
        <div footer>
          <button class="btn btn-ghost" (click)="formOpen.set(false)">Cancelar</button>
          <button class="btn btn-primary" (click)="create()">Crear usuario</button>
        </div>
      </app-modal>
    }

    @if (resetting(); as user) {
      <app-modal [title]="'Restablecer clave de ' + user.email" (closed)="resetting.set(null)">
        <div class="field">
          <label>Nueva contrasena *</label>
          <div class="password-field">
            <input
              [type]="verReset() ? 'text' : 'password'"
              [value]="newPassword()"
              (input)="newPassword.set($any($event.target).value)"
            />
            <app-eye-toggle [visible]="verReset()" (toggled)="verReset.set($event)" />
          </div>
          <span class="hint">Se cerraran todas las sesiones activas de ese usuario.</span>
        </div>
        <div footer>
          <button class="btn btn-ghost" (click)="resetting.set(null)">Cancelar</button>
          <button class="btn btn-danger" (click)="resetPassword(user)">Restablecer</button>
        </div>
      </app-modal>
    }
  `,
  styles: [
    `
      .stack {
        display: flex;
        flex-direction: column;
        gap: 14px;
      }
      td.yes {
        color: var(--ok-700);
        font-weight: 600;
      }
      td.no {
        color: var(--ink-300);
      }
    `,
  ],
})
export class UserListComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(ToastService);
  readonly auth = inject(AuthService);

  readonly roles = ROLES;
  readonly matrix = [
    { action: 'Ver y editar su propio perfil', roles: [true, true, true, true] },
    { action: 'Ver perfiles de su equipo', roles: [false, true, true, true] },
    { action: 'CRUD de empleados', roles: [false, false, true, true] },
    { action: 'Solicitar vacaciones propias', roles: [true, true, true, true] },
    { action: 'Aprobar vacaciones del equipo', roles: [false, true, true, true] },
    { action: 'Ver y descargar boletas propias', roles: [true, true, true, true] },
    { action: 'Generar y editar boletas', roles: [false, false, true, true] },
    { action: 'Registrar permiso de lactancia', roles: [false, false, true, true] },
    { action: 'Marcar entrada y salida propia', roles: [true, true, true, true] },
    { action: 'Ver asistencia del equipo', roles: [false, true, true, true] },
    { action: 'Definir horarios y turnos', roles: [false, false, true, true] },
    { action: 'Ver reportes globales', roles: [false, false, true, true] },
    { action: 'Cargar Excel masivo', roles: [false, false, true, true] },
    { action: 'Gestion de usuarios y roles', roles: [false, false, false, true] },
  ];

  readonly loading = signal(true);
  readonly users = signal<SystemUser[]>([]);
  readonly meta = signal<PageMeta | null>(null);
  readonly options = signal<EmployeeOption[]>([]);
  readonly formOpen = signal(false);
  readonly resetting = signal<SystemUser | null>(null);
  readonly newPassword = signal('');
  readonly verNueva = signal(false);
  readonly verReset = signal(false);

  readonly search = signal('');
  readonly role = signal('');
  readonly page = signal(1);
  readonly limit = signal(10);

  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(10)]],
    role: ['EMPLOYEE' as Role, Validators.required],
    employeeId: [''],
  });

  private searchTimer?: ReturnType<typeof setTimeout>;

  ngOnInit(): void {
    this.load();
    this.api.get<EmployeeOption[]>('/employees/options').subscribe({
      next: (response) => this.options.set(response.data),
      error: () => this.options.set([]),
    });
  }

  setSearch(value: string): void {
    this.search.set(value);
    this.page.set(1);
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => this.load(), 320);
  }

  setRole(value: string): void {
    this.role.set(value);
    this.page.set(1);
    this.load();
  }

  goToPage(page: number): void {
    this.page.set(page);
    this.load();
  }

  setLimit(limit: number): void {
    this.limit.set(limit);
    this.page.set(1);
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.api
      .list<SystemUser>('/auth/users', {
        page: this.page(),
        limit: this.limit(),
        search: this.search() || undefined,
        role: this.role() || undefined,
      })
      .subscribe({
        next: (page) => {
          this.users.set(page.data);
          this.meta.set(page.meta);
          this.loading.set(false);
        },
        error: () => {
          this.users.set([]);
          this.loading.set(false);
        },
      });
  }

  openForm(): void {
    this.form.reset({ role: 'EMPLOYEE' });
    this.verNueva.set(false);
    this.formOpen.set(true);
  }

  create(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.toast.warn('Revise el formulario', 'Verifique el correo y la contrasena');
      return;
    }
    const raw = this.form.getRawValue();
    this.api
      .post<SystemUser>('/auth/users', {
        email: raw.email,
        password: raw.password,
        role: raw.role,
        employeeId: raw.employeeId || undefined,
      })
      .subscribe({
        next: () => {
          this.formOpen.set(false);
          this.toast.success('Usuario creado');
          this.load();
        },
        error: (error) => this.toast.error('No se pudo crear', apiErrorMessage(error)),
      });
  }

  changeRole(user: SystemUser, role: Role): void {
    this.api.patch(`/auth/users/${user.id}/role`, { role }).subscribe({
      next: () => {
        this.toast.success('Rol actualizado', 'El usuario debera iniciar sesion nuevamente');
        this.load();
      },
      error: (error) => {
        this.toast.error('No se pudo cambiar el rol', apiErrorMessage(error));
        this.load();
      },
    });
  }

  toggleActive(user: SystemUser): void {
    this.api.patch(`/auth/users/${user.id}/active`, { isActive: !user.isActive }).subscribe({
      next: () => {
        this.toast.success(user.isActive ? 'Usuario desactivado' : 'Usuario activado');
        this.load();
      },
      error: (error) => this.toast.error('No se pudo actualizar', apiErrorMessage(error)),
    });
  }

  openReset(user: SystemUser): void {
    this.newPassword.set('');
    this.verReset.set(false);
    this.resetting.set(user);
  }

  resetPassword(user: SystemUser): void {
    if (this.newPassword().length < 10) {
      this.toast.warn('Contrasena muy corta', 'Debe tener al menos 10 caracteres');
      return;
    }
    this.api.post(`/auth/users/${user.id}/reset-password`, { newPassword: this.newPassword() }).subscribe({
      next: () => {
        this.resetting.set(null);
        this.toast.success('Contrasena restablecida');
      },
      error: (error) => this.toast.error('No se pudo restablecer', apiErrorMessage(error)),
    });
  }
}
