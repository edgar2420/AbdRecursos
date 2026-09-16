import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ApiService, saveBlob } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { apiErrorMessage } from '../../core/interceptors/auth.interceptor';
import { AguinaldoRow, PageMeta, Payslip } from '../../core/models/api.models';
import {
  CardComponent,
  ModalComponent,
  PageHeaderComponent,
  PaginatorComponent,
  StateComponent,
} from '../../shared/components/ui.components';
import { BadgeClasePipe, BolivianosPipe, EtiquetaPipe } from '../../shared/pipes/format.pipes';

const MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

@Component({
  selector: 'app-payslip-list',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    PageHeaderComponent,
    CardComponent,
    PaginatorComponent,
    StateComponent,
    ModalComponent,
    BolivianosPipe,
    EtiquetaPipe,
    BadgeClasePipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <app-page-header title="Boletas de pago" [subtitle]="auth.isHr() ? 'Generacion, emision y descarga de planillas' : 'Sus boletas de pago'">
        @if (auth.isHr()) {
          <button class="btn btn-ghost btn-sm" (click)="loadAguinaldo()">Aguinaldo</button>
          <button class="btn btn-ghost btn-sm" (click)="downloadZip()">Descargar ZIP del periodo</button>
          <button class="btn btn-primary btn-sm" (click)="generateOpen.set(true)">Generar periodo</button>
        }
      </app-page-header>

      <app-card>
        <div class="filters">
          <div class="field">
            <label>Gestion</label>
            <select [value]="filters().periodYear" (change)="setFilter('periodYear', $any($event.target).value)">
              @for (year of years; track year) {
                <option [value]="year">{{ year }}</option>
              }
            </select>
          </div>
          <div class="field">
            <label>Mes</label>
            <select [value]="filters().periodMonth" (change)="setFilter('periodMonth', $any($event.target).value)">
              <option value="">Todos</option>
              @for (month of months; track month.value) {
                <option [value]="month.value">{{ month.label }}</option>
              }
            </select>
          </div>
          @if (auth.isHr()) {
            <div class="field">
              <label>Estado</label>
              <select [value]="filters().status" (change)="setFilter('status', $any($event.target).value)">
                <option value="">Todos</option>
                <option value="DRAFT">Borrador</option>
                <option value="ISSUED">Emitida</option>
                <option value="CANCELLED">Anulada</option>
              </select>
            </div>
            <div class="field flex-1">
              <label>Buscar empleado</label>
              <input type="search" [value]="filters().search" (input)="setFilter('search', $any($event.target).value)" />
            </div>
          }
        </div>
      </app-card>

      <app-card [padded]="false">
        @if (loading()) {
          <app-state mode="loading" title="Cargando boletas"></app-state>
        } @else if (payslips().length === 0) {
          <app-state
            title="No hay boletas para el periodo"
            [message]="auth.isHr() ? 'Genere las boletas del periodo para verlas aqui.' : 'Cuando RRHH emita su boleta aparecera en esta lista.'"
          ></app-state>
        } @else {
          <div class="table-wrap">
            <table class="data">
              <thead>
                <tr>
                  @if (auth.isHr()) {
                    <th style="width:34px">
                      <input type="checkbox" [checked]="allSelected()" (change)="toggleAll($any($event.target).checked)" />
                    </th>
                  }
                  <th>Periodo</th>
                  @if (auth.isHr()) {
                    <th>Empleado</th>
                  }
                  <th class="num">Dias</th>
                  <th class="num">Total ganado</th>
                  <th class="num">Descuentos</th>
                  <th class="num">Liquido pagable</th>
                  <th>Estado</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                @for (payslip of payslips(); track payslip.id) {
                  <tr>
                    @if (auth.isHr()) {
                      <td>
                        <input
                          type="checkbox"
                          [checked]="selected().has(payslip.id)"
                          (change)="toggle(payslip.id)"
                          [disabled]="payslip.status !== 'DRAFT'"
                        />
                      </td>
                    }
                    <td class="nowrap strong">{{ monthName(payslip.periodMonth) }} {{ payslip.periodYear }}</td>
                    @if (auth.isHr()) {
                      <td>
                        {{ payslip.employeeName }}
                        <div class="muted" style="font-size:11.5px">{{ payslip.employeeCode }}</div>
                      </td>
                    }
                    <td class="num">{{ payslip.workedDays }}</td>
                    <td class="num">{{ payslip.totalEarnings | bs }}</td>
                    <td class="num" style="color:var(--danger-700)">{{ payslip.totalDeductions | bs }}</td>
                    <td class="num strong">{{ payslip.netPay | bs }}</td>
                    <td><span [class]="payslip.status | badgeClase">{{ payslip.status | etiqueta }}</span></td>
                    <td class="nowrap text-right">
                      <a class="btn btn-ghost btn-sm" [routerLink]="['/boletas', payslip.id]">Ver</a>
                      <button class="btn btn-ghost btn-sm" (click)="downloadPdf(payslip)">PDF</button>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>

          @if (auth.isHr() && selected().size > 0) {
            <div class="bulk">
              <span>{{ selected().size }} boleta(s) en borrador seleccionadas</span>
              <button class="btn btn-primary btn-sm" (click)="issue()">Emitir seleccionadas</button>
            </div>
          }

          <app-paginator [meta]="meta()" (pageChange)="goToPage($event)" (limitChange)="setLimit($event)" />
        }
      </app-card>
    </div>

    @if (generateOpen()) {
      <app-modal title="Generar boletas del periodo" (closed)="generateOpen.set(false)">
        <div class="row" style="gap:14px">
          <div class="field flex-1">
            <label>Gestion</label>
            <select [value]="genYear()" (change)="genYear.set(+$any($event.target).value)">
              @for (year of years; track year) {
                <option [value]="year">{{ year }}</option>
              }
            </select>
          </div>
          <div class="field flex-1">
            <label>Mes</label>
            <select [value]="genMonth()" (change)="genMonth.set(+$any($event.target).value)">
              @for (month of months; track month.value) {
                <option [value]="month.value">{{ month.label }}</option>
              }
            </select>
          </div>
        </div>
        <label class="row" style="gap:8px;margin-top:12px">
          <input type="checkbox" [checked]="includeAguinaldo()" (change)="includeAguinaldo.set($any($event.target).checked)" />
          <span>Incluir aguinaldo en esta planilla</span>
        </label>
        <p class="muted" style="font-size:12px">
          Se generan boletas en borrador para el personal activo. Las que ya fueron emitidas no se
          sobrescriben. El calculo usa los parametros legales vigentes en el periodo (AFP, RC-IVA,
          salario minimo) y queda registrado junto a la boleta.
        </p>
        <div footer>
          <button class="btn btn-ghost" (click)="generateOpen.set(false)">Cancelar</button>
          <button class="btn btn-primary" [disabled]="generating()" (click)="generate()">
            {{ generating() ? 'Generando...' : 'Generar' }}
          </button>
        </div>
      </app-modal>
    }

    @if (aguinaldo()) {
      <app-modal title="Aguinaldo de la gestion" (closed)="aguinaldo.set(null)">
        <div class="table-wrap">
          <table class="data">
            <thead>
              <tr>
                <th>Empleado</th>
                <th class="num">Meses</th>
                <th class="num">Monto</th>
                <th>Detalle</th>
              </tr>
            </thead>
            <tbody>
              @for (row of aguinaldo()!; track row.employeeId) {
                <tr>
                  <td>{{ row.employeeName }}</td>
                  <td class="num">{{ row.monthsWorked }}</td>
                  <td class="num strong">{{ row.amount | bs }}</td>
                  <td class="muted">{{ row.detail }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        <div footer>
          <button class="btn btn-ghost" (click)="aguinaldo.set(null)">Cerrar</button>
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
        min-width: 150px;
      }
      .bulk {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 12px 16px;
        background: var(--brand-50);
        font-size: 12.5px;
        font-weight: 500;
      }
    `,
  ],
})
export class PayslipListComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);
  readonly auth = inject(AuthService);

  readonly months = MONTHS.map((label, index) => ({ value: index + 1, label }));
  readonly years = Array.from({ length: 6 }, (_, index) => new Date().getFullYear() - index);

  readonly loading = signal(true);
  readonly generating = signal(false);
  readonly payslips = signal<Payslip[]>([]);
  readonly meta = signal<PageMeta | null>(null);
  readonly selected = signal<Set<string>>(new Set());
  readonly generateOpen = signal(false);
  readonly aguinaldo = signal<AguinaldoRow[] | null>(null);

  readonly genYear = signal(new Date().getFullYear());
  readonly genMonth = signal(new Date().getMonth() + 1);
  readonly includeAguinaldo = signal(false);

  readonly filters = signal({
    periodYear: new Date().getFullYear(),
    periodMonth: '' as number | '',
    status: '',
    search: '',
    page: 1,
    limit: 10,
  });

  ngOnInit(): void {
    this.load();
  }

  monthName(month: number): string {
    return MONTHS[month - 1] ?? '';
  }

  setFilter(key: 'periodYear' | 'periodMonth' | 'status' | 'search', value: string): void {
    this.filters.update((f) => ({ ...f, [key]: value === '' ? '' : key === 'status' || key === 'search' ? value : Number(value), page: 1 }));
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
    this.selected.set(new Set());
    this.api.list<Payslip>('/payslips', { ...this.filters() }).subscribe({
      next: (page) => {
        this.payslips.set(page.data);
        this.meta.set(page.meta);
        this.loading.set(false);
      },
      error: () => {
        this.payslips.set([]);
        this.loading.set(false);
      },
    });
  }

  allSelected(): boolean {
    const drafts = this.payslips().filter((p) => p.status === 'DRAFT');
    return drafts.length > 0 && drafts.every((p) => this.selected().has(p.id));
  }

  toggleAll(checked: boolean): void {
    const next = new Set<string>();
    if (checked) {
      this.payslips().filter((p) => p.status === 'DRAFT').forEach((p) => next.add(p.id));
    }
    this.selected.set(next);
  }

  toggle(id: string): void {
    const next = new Set(this.selected());
    if (next.has(id)) next.delete(id);
    else next.add(id);
    this.selected.set(next);
  }

  generate(): void {
    this.generating.set(true);
    this.api
      .post<Payslip[]>('/payslips/generate', {
        periodYear: this.genYear(),
        periodMonth: this.genMonth(),
        includeAguinaldo: this.includeAguinaldo(),
        overwriteDrafts: true,
      })
      .subscribe({
        next: (response) => {
          this.generating.set(false);
          this.generateOpen.set(false);
          this.toast.success(`${response.data.length} boletas generadas`, 'Quedaron en estado borrador');
          this.filters.update((f) => ({ ...f, periodYear: this.genYear(), periodMonth: this.genMonth() }));
          this.load();
        },
        error: (error) => {
          this.generating.set(false);
          this.toast.error('No se pudieron generar', apiErrorMessage(error));
        },
      });
  }

  issue(): void {
    this.api.post<{ issued: number }>('/payslips/issue', { ids: [...this.selected()] }).subscribe({
      next: (response) => {
        this.toast.success(`${response.data.issued} boletas emitidas`);
        this.load();
      },
      error: (error) => this.toast.error('No se pudieron emitir', apiErrorMessage(error)),
    });
  }

  downloadPdf(payslip: Payslip): void {
    this.api.download(`/payslips/${payslip.id}/pdf`).subscribe({
      next: (response) => saveBlob(response, `boleta-${payslip.employeeCode}.pdf`),
      error: (error) => this.toast.error('No se pudo descargar', apiErrorMessage(error)),
    });
  }

  downloadZip(): void {
    const { periodYear, periodMonth } = this.filters();
    if (!periodMonth) {
      this.toast.warn('Seleccione un mes', 'La descarga masiva requiere un periodo especifico');
      return;
    }
    this.api.download('/payslips/bulk-pdf', { periodYear, periodMonth }).subscribe({
      next: (response) => saveBlob(response, `boletas-${periodYear}-${periodMonth}.zip`),
      error: (error) => this.toast.error('No se pudo generar el ZIP', apiErrorMessage(error)),
    });
  }

  loadAguinaldo(): void {
    this.api.get<AguinaldoRow[]>('/payslips/aguinaldo', { year: this.filters().periodYear }).subscribe({
      next: (response) => this.aguinaldo.set(response.data),
      error: (error) => this.toast.error('No se pudo calcular el aguinaldo', apiErrorMessage(error)),
    });
  }
}
