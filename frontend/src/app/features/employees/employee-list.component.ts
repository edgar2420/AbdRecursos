import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService, saveBlob } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { apiErrorMessage } from '../../core/interceptors/auth.interceptor';
import { CatalogItem, Employee, EmployeeOption, PageMeta } from '../../core/models/api.models';
import {
  CardComponent,
  ModalComponent,
  PageHeaderComponent,
  PaginatorComponent,
  StateComponent,
} from '../../shared/components/ui.components';
import { BadgeClasePipe, BolivianosPipe, EtiquetaPipe, FechaPipe } from '../../shared/pipes/format.pipes';

@Component({
  selector: 'app-employee-list',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    PageHeaderComponent,
    CardComponent,
    PaginatorComponent,
    StateComponent,
    ModalComponent,
    BolivianosPipe,
    FechaPipe,
    EtiquetaPipe,
    BadgeClasePipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <app-page-header title="Empleados" subtitle="Nomina, datos laborales y carga masiva">
        @if (auth.isHr()) {
          <button class="btn btn-ghost btn-sm" (click)="downloadTemplate()">Plantilla Excel</button>
        }
        <button class="btn btn-ghost btn-sm" (click)="export('excel')">Exportar Excel</button>
        <button class="btn btn-ghost btn-sm" (click)="export('pdf')">Exportar PDF</button>
        @if (auth.isHr()) {
          <button class="btn btn-primary btn-sm" (click)="openCreate()">Nuevo empleado</button>
        }
      </app-page-header>

      <app-card>
        <div class="filters">
          <div class="field flex-1">
            <label for="search">Buscar</label>
            <input
              id="search"
              type="search"
              placeholder="Nombre y apellido, C.I. completo, codigo o correo"
              [value]="filters().search"
              (input)="setFilter('search', $any($event.target).value)"
            />
          </div>
          <div class="field">
            <label for="dep">Departamento</label>
            <select id="dep" [value]="filters().departmentId" (change)="setFilter('departmentId', $any($event.target).value)">
              <option value="">Todos</option>
              @for (dep of departments(); track dep.id) {
                <option [value]="dep.id">{{ dep.name }}</option>
              }
            </select>
          </div>
          <div class="field">
            <label for="status">Estado</label>
            <select id="status" [value]="filters().status" (change)="setFilter('status', $any($event.target).value)">
              <option value="">Todos</option>
              <option value="ACTIVE">Activo</option>
              <option value="ON_LEAVE">Con licencia</option>
              <option value="TERMINATED">Desvinculado</option>
            </select>
          </div>
          <div class="field">
            <label for="contract">Contrato</label>
            <select id="contract" [value]="filters().contractType" (change)="setFilter('contractType', $any($event.target).value)">
              <option value="">Todos</option>
              <option value="INDEFINIDO">Indefinido</option>
              <option value="PLAZO_FIJO">Plazo fijo</option>
              <option value="EVENTUAL">Eventual</option>
              <option value="CONSULTORIA">Consultoria</option>
            </select>
          </div>
          <button class="btn btn-ghost btn-sm" (click)="resetFilters()">Limpiar</button>
        </div>
      </app-card>

      <app-card [padded]="false">
        @if (loading()) {
          <app-state mode="loading" title="Cargando empleados"></app-state>
        } @else if (employees().length === 0) {
          <app-state
            title="No hay empleados que coincidan"
            message="Ajuste los filtros o registre un nuevo empleado para comenzar."
          >
            @if (auth.isHr()) {
              <button class="btn btn-primary btn-sm" (click)="openCreate()">Nuevo empleado</button>
            }
          </app-state>
        } @else {
          <div class="table-wrap">
            <table class="data">
              <thead>
                <tr>
                  <th class="sortable" (click)="sortBy('employeeCode')">Codigo</th>
                  <th class="sortable" (click)="sortBy('lastName')">Empleado</th>
                  <th>C.I.</th>
                  <th>Departamento</th>
                  <th>Cargo</th>
                  <th class="sortable" (click)="sortBy('hireDate')">Ingreso</th>
                  <th class="num sortable" (click)="sortBy('baseSalary')">Haber basico</th>
                  <th>Estado</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                @for (employee of employees(); track employee.id) {
                  <tr>
                    <td class="nowrap muted">{{ employee.employeeCode }}</td>
                    <td>
                      <a [routerLink]="['/empleados', employee.id]" class="strong">{{ employee.fullName }}</a>
                      @if (employee.jobProtection) {
                        <span class="badge badge-info" style="margin-left:6px">Inamovilidad</span>
                      }
                      <div class="muted" style="font-size:11.5px">{{ employee.email ?? 'Sin correo' }}</div>
                    </td>
                    <td class="nowrap">{{ employee.ci }}</td>
                    <td>{{ employee.departmentName ?? '-' }}</td>
                    <td>{{ employee.positionName ?? '-' }}</td>
                    <td class="nowrap">{{ employee.hireDate | fecha }}</td>
                    <td class="num">{{ employee.baseSalary | bs }}</td>
                    <td><span [class]="employee.status | badgeClase">{{ employee.status | etiqueta }}</span></td>
                    <td class="nowrap text-right">
                      <a class="btn btn-ghost btn-sm" [routerLink]="['/empleados', employee.id]">Ver</a>
                      @if (auth.isHr()) {
                        <button class="btn btn-ghost btn-sm" (click)="openEdit(employee)">Editar</button>
                      }
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
          <app-paginator [meta]="meta()" (pageChange)="goToPage($event)" (limitChange)="setLimit($event)" />
        }
      </app-card>
    </div>

    @if (formOpen()) {
      <app-modal [title]="editing() ? 'Editar empleado' : 'Nuevo empleado'" (closed)="closeForm()">
        <form [formGroup]="form" class="form-grid" novalidate>
          <div class="field">
            <label>Nombres *</label>
            <input formControlName="firstName" />
          </div>
          <div class="field">
            <label>Apellidos *</label>
            <input formControlName="lastName" />
          </div>
          <div class="field">
            <label>C.I. *</label>
            <input formControlName="ci" placeholder="1234567" />
          </div>
          <div class="field">
            <label>Extension</label>
            <select formControlName="ciExtension">
              <option value="">-</option>
              @for (ext of extensions; track ext) {
                <option [value]="ext">{{ ext }}</option>
              }
            </select>
          </div>
          <div class="field">
            <label>Fecha de ingreso *</label>
            <input type="date" formControlName="hireDate" />
          </div>
          <div class="field">
            <label>Tipo de contrato</label>
            <select formControlName="contractType">
              <option value="INDEFINIDO">Indefinido</option>
              <option value="PLAZO_FIJO">Plazo fijo</option>
              <option value="EVENTUAL">Eventual</option>
              <option value="CONSULTORIA">Consultoria</option>
            </select>
          </div>
          <div class="field">
            <label>Haber basico (Bs) *</label>
            <input type="number" min="0" step="0.01" formControlName="baseSalary" />
          </div>
          <div class="field">
            <label>Departamento</label>
            <select formControlName="departmentId">
              <option value="">Sin asignar</option>
              @for (dep of departments(); track dep.id) {
                <option [value]="dep.id">{{ dep.name }}</option>
              }
            </select>
          </div>
          <div class="field">
            <label>Cargo</label>
            <select formControlName="positionId">
              <option value="">Sin asignar</option>
              @for (pos of positions(); track pos.id) {
                <option [value]="pos.id">{{ pos.name }}</option>
              }
            </select>
          </div>
          <div class="field">
            <label>Supervisor</label>
            <select formControlName="supervisorId">
              <option value="">Sin supervisor</option>
              @for (option of options(); track option.id) {
                <option [value]="option.id">{{ option.label }}</option>
              }
            </select>
          </div>
          <div class="field">
            <label>Correo</label>
            <input type="email" formControlName="email" />
          </div>
          <div class="field">
            <label>Telefono</label>
            <input formControlName="phone" />
          </div>
          <div class="field">
            <label>AFP</label>
            <input formControlName="afpName" />
          </div>
          <div class="field">
            <label>Numero AFP</label>
            <input formControlName="afpNumber" />
          </div>
          <div class="field">
            <label>Banco</label>
            <input formControlName="bankName" />
          </div>
          <div class="field">
            <label>Cuenta bancaria</label>
            <input formControlName="bankAccount" />
          </div>
          <div class="field" style="grid-column:1/-1">
            <label>Direccion</label>
            <input formControlName="address" />
          </div>
          <div class="field">
            <label>Contacto de emergencia</label>
            <input formControlName="emergencyContactName" />
          </div>
          <div class="field">
            <label>Telefono de emergencia</label>
            <input formControlName="emergencyContactPhone" />
          </div>
        </form>

        <div footer>
          <button class="btn btn-ghost" type="button" (click)="closeForm()">Cancelar</button>
          <button class="btn btn-primary" type="button" [disabled]="saving()" (click)="save()">
            {{ saving() ? 'Guardando...' : 'Guardar' }}
          </button>
        </div>
      </app-modal>
    }
  `,
  styles: [
    `
      .filters {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        align-items: flex-end;
      }
      .filters .field {
        min-width: 170px;
      }
      .form-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
        gap: 14px;
      }
    `,
  ],
})
export class EmployeeListComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(ToastService);
  readonly auth = inject(AuthService);

  readonly extensions = ['LP', 'CB', 'SC', 'OR', 'PT', 'CH', 'TJ', 'BE', 'PD'];

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly employees = signal<Employee[]>([]);
  readonly meta = signal<PageMeta | null>(null);
  readonly departments = signal<CatalogItem[]>([]);
  readonly positions = signal<CatalogItem[]>([]);
  readonly options = signal<EmployeeOption[]>([]);
  readonly formOpen = signal(false);
  readonly editing = signal<Employee | null>(null);

  readonly filters = signal({
    search: '',
    departmentId: '',
    status: '',
    contractType: '',
    page: 1,
    limit: 10,
    sort: 'lastName',
    order: 'asc' as 'asc' | 'desc',
  });

  readonly form = this.fb.nonNullable.group({
    firstName: ['', [Validators.required, Validators.minLength(2)]],
    lastName: ['', [Validators.required, Validators.minLength(2)]],
    ci: ['', [Validators.required]],
    ciExtension: [''],
    hireDate: ['', [Validators.required]],
    contractType: ['INDEFINIDO'],
    baseSalary: [0, [Validators.required, Validators.min(0)]],
    departmentId: [''],
    positionId: [''],
    supervisorId: [''],
    email: [''],
    phone: [''],
    afpName: [''],
    afpNumber: [''],
    bankName: [''],
    bankAccount: [''],
    address: [''],
    emergencyContactName: [''],
    emergencyContactPhone: [''],
  });

  private searchTimer?: ReturnType<typeof setTimeout>;

  ngOnInit(): void {
    this.loadCatalogs();
    this.load();
  }

  setFilter(key: 'search' | 'departmentId' | 'status' | 'contractType', value: string): void {
    this.filters.update((f) => ({ ...f, [key]: value, page: 1 }));
    if (key === 'search') {
      clearTimeout(this.searchTimer);
      this.searchTimer = setTimeout(() => this.load(), 320);
      return;
    }
    this.load();
  }

  resetFilters(): void {
    this.filters.set({
      search: '',
      departmentId: '',
      status: '',
      contractType: '',
      page: 1,
      limit: 10,
      sort: 'lastName',
      order: 'asc',
    });
    this.load();
  }

  sortBy(field: string): void {
    this.filters.update((f) => ({
      ...f,
      sort: field,
      order: f.sort === field && f.order === 'asc' ? 'desc' : 'asc',
    }));
    this.load();
  }

  goToPage(page: number): void {
    this.filters.update((f) => ({ ...f, page }));
    this.load();
  }

  setLimit(limit: number): void {
    this.filters.update((f) => ({ ...f, limit, page: 1 }));
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.api.list<Employee>('/employees', { ...this.filters() }).subscribe({
      next: (page) => {
        this.employees.set(page.data);
        this.meta.set(page.meta);
        this.loading.set(false);
      },
      error: () => {
        this.employees.set([]);
        this.loading.set(false);
      },
    });
  }

  private loadCatalogs(): void {
    this.api.list<CatalogItem>('/employees/departments', { limit: 100 }).subscribe({
      next: (page) => this.departments.set(page.data),
    });
    this.api.list<CatalogItem>('/employees/positions', { limit: 100 }).subscribe({
      next: (page) => this.positions.set(page.data),
    });
    this.api.get<EmployeeOption[]>('/employees/options').subscribe({
      next: (response) => this.options.set(response.data),
      error: () => this.options.set([]),
    });
  }

  openCreate(): void {
    this.editing.set(null);
    this.form.reset({ contractType: 'INDEFINIDO', baseSalary: 0 });
    this.formOpen.set(true);
  }

  openEdit(employee: Employee): void {
    this.editing.set(employee);
    this.form.reset({
      firstName: employee.firstName,
      lastName: employee.lastName,
      ci: employee.ci,
      ciExtension: employee.ciExtension ?? '',
      hireDate: employee.hireDate.slice(0, 10),
      contractType: employee.contractType,
      baseSalary: employee.baseSalary,
      departmentId: employee.departmentId ?? '',
      positionId: employee.positionId ?? '',
      supervisorId: employee.supervisorId ?? '',
      email: employee.email ?? '',
      phone: employee.phone ?? '',
      afpName: employee.afpName ?? '',
      afpNumber: employee.afpNumber ?? '',
      bankName: employee.bankName ?? '',
      bankAccount: employee.bankAccount ?? '',
      address: employee.address ?? '',
      emergencyContactName: employee.emergencyContactName ?? '',
      emergencyContactPhone: employee.emergencyContactPhone ?? '',
    });
    this.formOpen.set(true);
  }

  closeForm(): void {
    this.formOpen.set(false);
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.toast.warn('Revise el formulario', 'Hay campos obligatorios sin completar');
      return;
    }

    const raw = this.form.getRawValue();
    // Los campos vacios no se envian: el backend los trata como "sin cambio".
    const payload: Record<string, unknown> = {};
    Object.entries(raw).forEach(([key, value]) => {
      if (value !== '' && value !== null) payload[key] = value;
    });

    this.saving.set(true);
    const editing = this.editing();
    const request = editing
      ? this.api.patch<Employee>(`/employees/${editing.id}`, payload)
      : this.api.post<Employee>('/employees', payload);

    request.subscribe({
      next: () => {
        this.saving.set(false);
        this.formOpen.set(false);
        this.toast.success(editing ? 'Empleado actualizado' : 'Empleado registrado');
        this.load();
      },
      error: (error) => {
        this.saving.set(false);
        this.toast.error('No se pudo guardar', apiErrorMessage(error));
      },
    });
  }

  export(format: 'excel' | 'pdf'): void {
    this.api.download('/employees/export', { ...this.filters(), format }).subscribe({
      next: (response) => saveBlob(response, `empleados.${format === 'pdf' ? 'pdf' : 'xlsx'}`),
      error: () => this.toast.error('No se pudo exportar'),
    });
  }

  downloadTemplate(): void {
    this.api.download('/employees/template').subscribe({
      next: (response) => saveBlob(response, 'plantilla-empleados.xlsx'),
      error: () => this.toast.error('No se pudo descargar la plantilla'),
    });
  }
}
