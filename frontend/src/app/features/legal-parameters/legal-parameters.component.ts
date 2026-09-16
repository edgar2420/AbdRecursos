import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../core/services/api.service';
import { ToastService } from '../../core/services/toast.service';
import { apiErrorMessage } from '../../core/interceptors/auth.interceptor';
import { LegalParameter, PageMeta } from '../../core/models/api.models';
import {
  CardComponent,
  ModalComponent,
  PageHeaderComponent,
  PaginatorComponent,
  StateComponent,
} from '../../shared/components/ui.components';
import { FechaPipe } from '../../shared/pipes/format.pipes';

/** Agrupacion por tema para que RRHH encuentre rapido lo que busca. */
const GROUPS: { title: string; prefix: string[]; note: string }[] = [
  {
    title: 'Vacaciones',
    prefix: ['VACATION'],
    note: 'Dias por tramo de antiguedad y flujo de aprobacion (Ley General del Trabajo).',
  },
  {
    title: 'Lactancia e inamovilidad',
    prefix: ['LACTATION', 'JOB_PROTECTION'],
    note: 'Ley 3460: permiso diario, vigencia y alerta de vencimiento.',
  },
  { title: 'Aguinaldo', prefix: ['AGUINALDO', 'DOUBLE'], note: 'Meses minimos y bandera de doble aguinaldo.' },
  {
    title: 'Boleta de pago',
    prefix: ['AFP', 'RCIVA', 'MINIMUM_WAGE'],
    note: 'Aporte laboral, RC-IVA, minimo no imponible y salario minimo nacional.',
  },
  {
    title: 'Jornada laboral',
    prefix: ['WORK_', 'OVERTIME'],
    note: 'Jornada de referencia y recargos de horas extra.',
  },
];

@Component({
  selector: 'app-legal-parameters',
  standalone: true,
  imports: [
    CommonModule,
    PageHeaderComponent,
    CardComponent,
    PaginatorComponent,
    StateComponent,
    ModalComponent,
    FechaPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <app-page-header
        title="Parametros legales"
        subtitle="Los valores de la normativa boliviana se editan aqui, no en el codigo"
      >
        <button class="btn btn-primary btn-sm" (click)="openNew()">Nueva version</button>
      </app-page-header>

      <app-card>
        <p class="muted" style="margin:0;font-size:12.5px">
          Cada cambio crea una <strong>nueva version con fecha de vigencia</strong>: las boletas ya
          emitidas conservan los valores con los que fueron calculadas. Verifique cada gestion el
          salario minimo nacional y la tasa de aporte laboral vigente.
        </p>
      </app-card>

      @if (loading()) {
        <app-state mode="loading" title="Cargando parametros"></app-state>
      } @else {
        @for (group of groups; track group.title) {
          @if (byGroup(group.prefix).length) {
            <app-card [heading]="group.title" [padded]="false">
              <div class="table-wrap">
                <table class="data">
                  <thead>
                    <tr>
                      <th>Clave</th>
                      <th>Descripcion</th>
                      <th class="num">Valor</th>
                      <th>Unidad</th>
                      <th>Vigente desde</th>
                      <th>Hasta</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (param of byGroup(group.prefix); track param.id) {
                      <tr [class.historic]="param.validUntil">
                        <td class="strong nowrap">{{ param.key }}</td>
                        <td class="muted">{{ param.description ?? '-' }}</td>
                        <td class="num strong">{{ param.value }}</td>
                        <td class="muted">{{ param.unit ?? '-' }}</td>
                        <td class="nowrap">{{ param.validFrom | fecha }}</td>
                        <td class="nowrap">
                          {{ param.validUntil ? (param.validUntil | fecha) : 'Vigente' }}
                        </td>
                        <td class="text-right">
                          @if (!param.validUntil) {
                            <button class="btn btn-ghost btn-sm" (click)="openChange(param)">Cambiar valor</button>
                          }
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
              <p class="group-note">{{ group.note }}</p>
            </app-card>
          }
        }

        <app-card heading="Todos los parametros (historico)" [padded]="false">
          <app-paginator [meta]="meta()" (pageChange)="goToPage($event)" (limitChange)="setLimit($event)" />
        </app-card>
      }
    </div>

    @if (editing(); as param) {
      <app-modal [title]="'Nuevo valor para ' + param.key" (closed)="editing.set(null)">
        <div class="field">
          <label>Valor actual</label>
          <input [value]="param.value" disabled />
        </div>
        <div class="field">
          <label>Nuevo valor *</label>
          @if (param.valueType === 'boolean') {
            <select [value]="newValue()" (change)="newValue.set($any($event.target).value)">
              <option value="true">Activado</option>
              <option value="false">Desactivado</option>
            </select>
          } @else {
            <input [value]="newValue()" (input)="newValue.set($any($event.target).value)" />
          }
        </div>
        <div class="field">
          <label>Vigente desde *</label>
          <input type="date" [value]="validFrom()" (change)="validFrom.set($any($event.target).value)" />
          <span class="hint">El valor anterior se cierra automaticamente en esta fecha.</span>
        </div>
        <div footer>
          <button class="btn btn-ghost" (click)="editing.set(null)">Cancelar</button>
          <button class="btn btn-primary" (click)="saveVersion(param)">Guardar version</button>
        </div>
      </app-modal>
    }

    @if (creating()) {
      <app-modal title="Nuevo parametro legal" (closed)="creating.set(false)">
        <div class="field">
          <label>Clave *</label>
          <input [value]="newKey()" (input)="newKey.set($any($event.target).value.toUpperCase())" placeholder="EJEMPLO_TASA" />
          <span class="hint">Use MAYUSCULAS_CON_GUION_BAJO.</span>
        </div>
        <div class="field">
          <label>Tipo</label>
          <select [value]="newType()" (change)="newType.set($any($event.target).value)">
            <option value="number">Numero</option>
            <option value="boolean">Si / No</option>
            <option value="string">Texto</option>
          </select>
        </div>
        <div class="field">
          <label>Valor *</label>
          <input [value]="newValue()" (input)="newValue.set($any($event.target).value)" />
        </div>
        <div class="field">
          <label>Descripcion</label>
          <input [value]="newDescription()" (input)="newDescription.set($any($event.target).value)" />
        </div>
        <div class="field">
          <label>Vigente desde *</label>
          <input type="date" [value]="validFrom()" (change)="validFrom.set($any($event.target).value)" />
        </div>
        <div footer>
          <button class="btn btn-ghost" (click)="creating.set(false)">Cancelar</button>
          <button class="btn btn-primary" (click)="create()">Crear</button>
        </div>
      </app-modal>
    }
  `,
  styles: [
    `
      tr.historic td {
        color: var(--ink-500);
        background: var(--ink-50);
      }
      .group-note {
        margin: 0;
        padding: 10px 16px;
        font-size: 12px;
        color: var(--ink-500);
        border-top: 1px solid var(--ink-200);
      }
    `,
  ],
})
export class LegalParametersComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);

  readonly groups = GROUPS;
  readonly loading = signal(true);
  readonly parameters = signal<LegalParameter[]>([]);
  readonly meta = signal<PageMeta | null>(null);
  readonly editing = signal<LegalParameter | null>(null);
  readonly creating = signal(false);

  readonly newValue = signal('');
  readonly newKey = signal('');
  readonly newType = signal<'number' | 'boolean' | 'string'>('number');
  readonly newDescription = signal('');
  readonly validFrom = signal(new Date().toISOString().slice(0, 10));

  readonly page = signal(1);
  readonly limit = signal(100);

  ngOnInit(): void {
    this.load();
  }

  byGroup(prefixes: string[]): LegalParameter[] {
    return this.parameters().filter((param) => prefixes.some((prefix) => param.key.startsWith(prefix)));
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
    this.api.list<LegalParameter>('/legal-parameters', { page: this.page(), limit: this.limit() }).subscribe({
      next: (page) => {
        this.parameters.set(page.data);
        this.meta.set(page.meta);
        this.loading.set(false);
      },
      error: () => {
        this.parameters.set([]);
        this.loading.set(false);
      },
    });
  }

  openChange(param: LegalParameter): void {
    this.newValue.set(param.value);
    this.validFrom.set(new Date().toISOString().slice(0, 10));
    this.editing.set(param);
  }

  openNew(): void {
    this.newKey.set('');
    this.newValue.set('');
    this.newDescription.set('');
    this.newType.set('number');
    this.validFrom.set(new Date().toISOString().slice(0, 10));
    this.creating.set(true);
  }

  saveVersion(param: LegalParameter): void {
    this.api
      .post<LegalParameter>('/legal-parameters', {
        key: param.key,
        value: this.newValue(),
        valueType: param.valueType,
        description: param.description ?? undefined,
        unit: param.unit ?? undefined,
        validFrom: this.validFrom(),
      })
      .subscribe({
        next: () => {
          this.editing.set(null);
          this.toast.success('Parametro actualizado', 'Los calculos futuros usaran el nuevo valor');
          this.load();
        },
        error: (error) => this.toast.error('No se pudo guardar', apiErrorMessage(error)),
      });
  }

  create(): void {
    if (!this.newKey() || !this.newValue()) {
      this.toast.warn('Datos incompletos', 'Indique la clave y el valor');
      return;
    }
    this.api
      .post<LegalParameter>('/legal-parameters', {
        key: this.newKey(),
        value: this.newValue(),
        valueType: this.newType(),
        description: this.newDescription() || undefined,
        validFrom: this.validFrom(),
      })
      .subscribe({
        next: () => {
          this.creating.set(false);
          this.toast.success('Parametro creado');
          this.load();
        },
        error: (error) => this.toast.error('No se pudo crear', apiErrorMessage(error)),
      });
  }
}
