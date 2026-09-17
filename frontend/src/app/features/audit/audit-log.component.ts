import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../core/services/api.service';
import { AuditLogEntry, PageMeta } from '../../core/models/api.models';
import {
  CardComponent,
  PageHeaderComponent,
  PaginatorComponent,
  StateComponent,
} from '../../shared/components/ui.components';
import { FechaPipe } from '../../shared/pipes/format.pipes';

@Component({
  selector: 'app-audit-log',
  standalone: true,
  imports: [CommonModule, PageHeaderComponent, CardComponent, PaginatorComponent, StateComponent, FechaPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <app-page-header title="Auditoria" subtitle="Historial de acciones realizadas en el sistema"></app-page-header>

      <app-card heading="Registro" [padded]="false">
        <div class="filters">
          <div class="field flex-1">
            <label>Buscar</label>
            <input
              type="search"
              placeholder="Accion, entidad o usuario"
              [value]="search()"
              (input)="setSearch($any($event.target).value)"
            />
          </div>
        </div>

        @if (loading()) {
          <app-state mode="loading" title="Cargando registro"></app-state>
        } @else if (rows().length === 0) {
          <app-state title="Sin eventos" message="Aun no hay actividad registrada."></app-state>
        } @else {
          <div class="table-wrap">
            <table class="data">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Usuario</th>
                  <th>Accion</th>
                  <th>Entidad</th>
                  <th>Detalle</th>
                </tr>
              </thead>
              <tbody>
                @for (row of rows(); track row.id) {
                  <tr>
                    <td class="nowrap">{{ row.createdAt | fecha: true }}</td>
                    <td>{{ row.userName ?? 'Sistema' }}</td>
                    <td><span class="badge badge-info">{{ row.action }}</span></td>
                    <td class="muted">{{ row.entity }}{{ row.entityId ? ' · ' + row.entityId : '' }}</td>
                    <td class="muted detalle">{{ resumen(row) }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
          <app-paginator [meta]="meta()" (pageChange)="goToPage($event)" (limitChange)="setLimit($event)" />
        }
      </app-card>
    </div>
  `,
  styles: [
    `
      .filters {
        display: flex;
        gap: 12px;
        padding: 16px 18px;
        border-bottom: 1px solid var(--ink-200);
      }
      .filters .field {
        min-width: 220px;
      }
      .detalle {
        max-width: 360px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
    `,
  ],
})
export class AuditLogComponent implements OnInit {
  private readonly api = inject(ApiService);

  readonly loading = signal(true);
  readonly rows = signal<AuditLogEntry[]>([]);
  readonly meta = signal<PageMeta | null>(null);
  readonly search = signal('');
  readonly page = signal(1);
  readonly limit = signal(20);

  private searchTimer?: ReturnType<typeof setTimeout>;

  ngOnInit(): void {
    this.load();
  }

  setSearch(value: string): void {
    this.search.set(value);
    this.page.set(1);
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => this.load(), 320);
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

  resumen(row: AuditLogEntry): string {
    if (!row.changes) return '-';
    try {
      return JSON.stringify(row.changes);
    } catch {
      return '-';
    }
  }

  load(): void {
    this.loading.set(true);
    this.api
      .list<AuditLogEntry>('/audit-logs', {
        search: this.search() || undefined,
        page: this.page(),
        limit: this.limit(),
      })
      .subscribe({
        next: (response) => {
          this.rows.set(response.data);
          this.meta.set(response.meta);
          this.loading.set(false);
        },
        error: () => {
          this.rows.set([]);
          this.loading.set(false);
        },
      });
  }
}
