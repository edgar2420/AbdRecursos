import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService, saveBlob } from '../../core/services/api.service';
import { ToastService } from '../../core/services/toast.service';
import { apiErrorMessage } from '../../core/interceptors/auth.interceptor';
import { ImportLog, PageMeta } from '../../core/models/api.models';
import {
  CardComponent,
  PageHeaderComponent,
  PaginatorComponent,
  StateComponent,
} from '../../shared/components/ui.components';
import { BadgeClasePipe, EtiquetaPipe, FechaPipe } from '../../shared/pipes/format.pipes';

type ImportType = 'EMPLOYEES' | 'ATTENDANCE' | 'SCHEDULES';

@Component({
  selector: 'app-import-wizard',
  standalone: true,
  imports: [
    CommonModule,
    PageHeaderComponent,
    CardComponent,
    PaginatorComponent,
    StateComponent,
    FechaPipe,
    EtiquetaPipe,
    BadgeClasePipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <app-page-header title="Carga masiva desde Excel" subtitle="Empleados, asistencia historica y horarios">
        <button class="btn btn-ghost btn-sm" (click)="downloadTemplate()">Descargar plantilla</button>
      </app-page-header>

      <app-card heading="1. Subir archivo">
        <div class="upload">
          <div class="field">
            <label>Tipo de carga</label>
            <select [value]="type()" (change)="type.set($any($event.target).value)">
              <option value="EMPLOYEES">Empleados</option>
              <option value="ATTENDANCE">Asistencia historica</option>
              <option value="SCHEDULES">Asignacion de horarios</option>
            </select>
          </div>
          <div class="field flex-1">
            <label>Archivo Excel (.xlsx)</label>
            <input type="file" accept=".xlsx,.xls" (change)="pickFile($event)" />
            <span class="hint">Use la plantilla descargable para evitar errores de formato.</span>
          </div>
          <button class="btn btn-primary" [disabled]="!file() || uploading()" (click)="upload()">
            {{ uploading() ? 'Validando...' : 'Validar archivo' }}
          </button>
        </div>
      </app-card>

      @if (preview(); as prev) {
        <app-card heading="2. Vista previa">
          <div class="summary">
            <div><span class="muted">Archivo</span><strong>{{ prev.fileName }}</strong></div>
            <div><span class="muted">Filas leidas</span><strong>{{ prev.totalRows }}</strong></div>
            <div><span class="muted">Validas</span><strong style="color:var(--ok-700)">{{ prev.validRows }}</strong></div>
            <div><span class="muted">Con error</span><strong style="color:var(--danger-700)">{{ prev.errorRows }}</strong></div>
          </div>

          @if (prev.errorRows > 0) {
            <p class="muted" style="font-size:12.5px">
              Solo se procesaran las filas validas. Corrija las filas con error en el archivo y vuelva a
              subirlo si necesita cargarlas.
            </p>
          }

          <div class="table-wrap" style="margin-top:12px">
            <table class="data">
              <thead>
                <tr>
                  <th style="width:64px">Fila</th>
                  <th style="width:110px">Estado</th>
                  <th>Errores</th>
                  <th>Datos</th>
                </tr>
              </thead>
              <tbody>
                @for (row of prev.rows ?? []; track row.rowNumber) {
                  <tr [class.bad]="!row.isValid">
                    <td class="num">{{ row.rowNumber }}</td>
                    <td>
                      <span class="badge" [class.badge-ok]="row.isValid" [class.badge-danger]="!row.isValid">
                        {{ row.isValid ? 'Valida' : 'Con error' }}
                      </span>
                    </td>
                    <td class="error-text">{{ row.errors.join(' · ') || '-' }}</td>
                    <td class="muted preview-data">{{ summarize(row.data) }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </app-card>

        <app-card heading="3. Confirmar">
          <div class="row" style="justify-content:space-between">
            <p class="muted" style="margin:0;font-size:12.5px">
              Se crearan {{ prev.validRows }} registro(s). Esta accion queda en la auditoria.
            </p>
            <div class="row">
              <button class="btn btn-ghost" (click)="preview.set(null)">Descartar</button>
              <button class="btn btn-primary" [disabled]="prev.validRows === 0 || confirming()" (click)="confirm(prev)">
                {{ confirming() ? 'Procesando...' : 'Confirmar e importar' }}
              </button>
            </div>
          </div>
        </app-card>
      }

      <app-card heading="Historial de importaciones" [padded]="false">
        @if (loading()) {
          <app-state mode="loading" title="Cargando historial"></app-state>
        } @else if (history().length === 0) {
          <app-state title="Sin importaciones previas" message="Aqui quedara el registro de cada carga masiva."></app-state>
        } @else {
          <div class="table-wrap">
            <table class="data">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Tipo</th>
                  <th>Archivo</th>
                  <th class="num">Filas</th>
                  <th class="num">Validas</th>
                  <th class="num">Procesadas</th>
                  <th>Estado</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                @for (log of history(); track log.id) {
                  <tr>
                    <td class="nowrap">{{ log.createdAt | fecha: true }}</td>
                    <td>{{ log.type | etiqueta }}</td>
                    <td class="muted">{{ log.fileName }}</td>
                    <td class="num">{{ log.totalRows }}</td>
                    <td class="num">{{ log.validRows }}</td>
                    <td class="num strong">{{ log.processedRows }}</td>
                    <td><span [class]="log.status | badgeClase">{{ log.status | etiqueta }}</span></td>
                    <td class="text-right nowrap">
                      <button class="btn btn-ghost btn-sm" (click)="downloadLog(log)">Log Excel</button>
                      @if (log.status === 'VALIDATED') {
                        <button class="btn btn-secondary btn-sm" (click)="openPreview(log)">Retomar</button>
                      }
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
          <app-paginator [meta]="meta()" (pageChange)="goToPage($event)" />
        }
      </app-card>
    </div>
  `,
  styles: [
    `
      .upload {
        display: flex;
        flex-wrap: wrap;
        gap: 14px;
        align-items: flex-end;
      }
      .upload .field {
        min-width: 200px;
      }
      .summary {
        display: flex;
        flex-wrap: wrap;
        gap: 28px;
      }
      .summary > div {
        display: flex;
        flex-direction: column;
      }
      .summary span {
        font-size: 11.5px;
      }
      .summary strong {
        font-size: 18px;
      }
      tr.bad td {
        background: #fff7f7;
      }
      .preview-data {
        max-width: 420px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-size: 11.5px;
      }
    `,
  ],
})
export class ImportWizardComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);

  readonly type = signal<ImportType>('EMPLOYEES');
  readonly file = signal<File | null>(null);
  readonly uploading = signal(false);
  readonly confirming = signal(false);
  readonly preview = signal<ImportLog | null>(null);
  readonly history = signal<ImportLog[]>([]);
  readonly meta = signal<PageMeta | null>(null);
  readonly loading = signal(true);
  readonly page = signal(1);

  ngOnInit(): void {
    this.loadHistory();
  }

  pickFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.file.set(input.files?.[0] ?? null);
  }

  summarize(data: Record<string, unknown>): string {
    return Object.entries(data)
      .filter(([, value]) => value !== null && value !== '')
      .slice(0, 6)
      .map(([key, value]) => `${key}: ${value}`)
      .join(' · ');
  }

  upload(): void {
    const file = this.file();
    if (!file) return;

    const form = new FormData();
    form.append('file', file);
    form.append('type', this.type());

    this.uploading.set(true);
    this.api.upload<ImportLog>('/imports', form).subscribe({
      next: (response) => {
        this.uploading.set(false);
        this.preview.set(response.data);
        if (response.data.errorRows > 0) {
          this.toast.warn(
            `${response.data.errorRows} filas con error`,
            'Revise el detalle antes de confirmar',
          );
        } else {
          this.toast.success('Archivo validado', 'Todas las filas estan correctas');
        }
        this.loadHistory();
      },
      error: (error) => {
        this.uploading.set(false);
        this.toast.error('No se pudo validar el archivo', apiErrorMessage(error));
      },
    });
  }

  confirm(log: ImportLog): void {
    this.confirming.set(true);
    this.api.post<ImportLog>(`/imports/${log.id}/confirm`).subscribe({
      next: (response) => {
        this.confirming.set(false);
        this.preview.set(null);
        this.toast.success(`${response.data.processedRows} registros importados`);
        if (response.data.errors?.length) {
          this.toast.warn('Algunas filas fallaron', response.data.errors[0]);
        }
        this.loadHistory();
      },
      error: (error) => {
        this.confirming.set(false);
        this.toast.error('No se pudo procesar', apiErrorMessage(error));
      },
    });
  }

  openPreview(log: ImportLog): void {
    this.api.get<ImportLog>(`/imports/${log.id}`).subscribe({
      next: (response) => this.preview.set(response.data),
      error: (error) => this.toast.error('No se pudo abrir la vista previa', apiErrorMessage(error)),
    });
  }

  downloadTemplate(): void {
    this.api.download('/imports/template', { type: this.type() }).subscribe({
      next: (response) => saveBlob(response, `plantilla-${this.type().toLowerCase()}.xlsx`),
      error: () => this.toast.error('No se pudo descargar la plantilla'),
    });
  }

  downloadLog(log: ImportLog): void {
    this.api.download(`/imports/${log.id}/log`).subscribe({
      next: (response) => saveBlob(response, `log-importacion.xlsx`),
      error: () => this.toast.error('No se pudo descargar el log'),
    });
  }

  goToPage(page: number): void {
    this.page.set(page);
    this.loadHistory();
  }

  private loadHistory(): void {
    this.loading.set(true);
    this.api.list<ImportLog>('/imports', { page: this.page(), limit: 10 }).subscribe({
      next: (response) => {
        this.history.set(response.data);
        this.meta.set(response.meta);
        this.loading.set(false);
      },
      error: () => {
        this.history.set([]);
        this.loading.set(false);
      },
    });
  }
}
