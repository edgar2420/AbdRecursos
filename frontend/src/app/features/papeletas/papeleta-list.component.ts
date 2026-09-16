import { ChangeDetectionStrategy, Component, ElementRef, OnDestroy, OnInit, ViewChild, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { apiErrorMessage } from '../../core/interceptors/auth.interceptor';
import { PageMeta, Papeleta } from '../../core/models/api.models';
import {
  CardComponent,
  ModalComponent,
  PageHeaderComponent,
  PaginatorComponent,
  StateComponent,
} from '../../shared/components/ui.components';
import { BadgeClasePipe, EtiquetaPipe, FechaPipe } from '../../shared/pipes/format.pipes';

/**
 * Papeletas de horas extras y de salida, las mismas que antes se llenaban en
 * papel. El circuito de firmas es jefe de area y despues Recursos Humanos.
 */
@Component({
  selector: 'app-papeleta-list',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    PageHeaderComponent,
    CardComponent,
    PaginatorComponent,
    StateComponent,
    ModalComponent,
    FechaPipe,
    EtiquetaPipe,
    BadgeClasePipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <app-page-header title="Papeletas" subtitle="Horas extras y salidas, con firma del jefe de area y de RRHH">
        <button class="btn btn-secondary btn-sm" (click)="abrirSalida()">Papeleta de salida</button>
        <button class="btn btn-primary btn-sm" (click)="abrirHorasExtras()">Papeleta de horas extras</button>
      </app-page-header>

      <app-card>
        <div class="filtros">
          <div class="field">
            <label>Tipo</label>
            <select [value]="filtros().tipo" (change)="setFiltro('tipo', $any($event.target).value)">
              <option value="">Todas</option>
              <option value="HORAS_EXTRAS">Horas extras</option>
              <option value="SALIDA">Salida</option>
            </select>
          </div>
          <div class="field">
            <label>Estado</label>
            <select [value]="filtros().estado" (change)="setFiltro('estado', $any($event.target).value)">
              <option value="">Todos</option>
              <option value="PENDIENTE_JEFE_AREA">Pendiente jefe de area</option>
              <option value="PENDIENTE_RRHH">Pendiente RRHH</option>
              <option value="APROBADA">Aprobadas</option>
              <option value="RECHAZADA">Rechazadas</option>
              <option value="ANULADA">Anuladas</option>
            </select>
          </div>
          <div class="field flex-1">
            <label>Buscar</label>
            <input type="search" placeholder="Numero o empleado" [value]="filtros().search"
              (input)="setFiltro('search', $any($event.target).value)" />
          </div>
        </div>
      </app-card>

      <app-card [padded]="false">
        @if (cargando()) {
          <app-state mode="loading" title="Cargando papeletas"></app-state>
        } @else if (papeletas().length === 0) {
          <app-state title="Sin papeletas" message="Emita una papeleta de horas extras o de salida.">
            <button class="btn btn-primary btn-sm" (click)="abrirHorasExtras()">Nueva papeleta</button>
          </app-state>
        } @else {
          <div class="table-wrap">
            <table class="data">
              <thead>
                <tr>
                  <th>Numero</th>
                  <th>Tipo</th>
                  <th>Empleado</th>
                  <th>Area</th>
                  <th>Fecha</th>
                  <th>Detalle</th>
                  <th>Firmas</th>
                  <th>Estado</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                @for (p of papeletas(); track p.id) {
                  <tr>
                    <td class="nowrap strong">{{ p.numero }}</td>
                    <td class="nowrap">{{ p.tipo | etiqueta }}</td>
                    <td>
                      {{ p.employeeNombre }}
                      <div class="muted" style="font-size:11.5px">{{ p.employeeCodigo }}</div>
                    </td>
                    <td class="muted">{{ p.area }}</td>
                    <td class="nowrap">{{ p.fecha | fecha }}</td>
                    <td class="muted" style="max-width:220px">
                      @if (p.tipo === 'HORAS_EXTRAS') {
                        {{ p.totalHoras }} h · {{ p.recargo | etiqueta }}
                        <div style="font-size:11.5px">{{ p.trabajoRealizado }}</div>
                      } @else {
                        {{ p.salidaMotivo | etiqueta }} · {{ p.tiempoSolicitado }}
                        <div style="font-size:11.5px">{{ p.motivo }}</div>
                      }
                    </td>
                    <td class="nowrap">
                      <span class="firma" [class.ok]="p.firmaArea" title="Jefe de area">Area</span>
                      <span class="firma" [class.ok]="p.firmaRrhh" title="Recursos Humanos">RRHH</span>
                    </td>
                    <td>
                      <span [class]="p.estado | badgeClase">{{ p.estado | etiqueta }}</span>
                      @if (p.motivoRechazo) {
                        <div class="muted" style="font-size:11px">{{ p.motivoRechazo }}</div>
                      }
                    </td>
                    <td class="nowrap text-right">
                      <button class="btn btn-secondary btn-sm" (click)="ver(p)">Ver</button>
                      @if (puedeFirmar(p)) {
                        <button class="btn btn-secondary btn-sm" (click)="firmar(p)">Firmar</button>
                        <button class="btn btn-ghost btn-sm" (click)="abrirRechazo(p)">Rechazar</button>
                      }
                      @if (puedeAnular(p)) {
                        <button class="btn btn-ghost btn-sm" (click)="anular(p)">Anular</button>
                      }
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
          <app-paginator [meta]="meta()" (pageChange)="irAPagina($event)" (limitChange)="setLimite($event)" />
        }
      </app-card>
    </div>

    @if (formHoras()) {
      <app-modal title="Papeleta de horas extras" (closed)="formHoras.set(false)">
        <form [formGroup]="horasForm" class="stack">
          <div class="field">
            <label>Fecha *</label>
            <input type="date" formControlName="fecha" />
          </div>
          <div class="field">
            <label>Trabajo realizado *</label>
            <textarea formControlName="trabajoRealizado" placeholder="Describa la tarea que motivo las horas extra"></textarea>
          </div>
          <div class="row" style="gap:14px">
            <div class="field flex-1">
              <label>Desde *</label>
              <input type="time" formControlName="horaDesde" />
            </div>
            <div class="field flex-1">
              <label>Hasta *</label>
              <input type="time" formControlName="horaHasta" />
            </div>
            <div class="field flex-1">
              <label>Recargo</label>
              <select formControlName="recargo">
                <option value="DIURNA">Diurna (100%)</option>
                <option value="NOCTURNA">Nocturna (200%)</option>
                <option value="FERIADO">Feriado (200%)</option>
              </select>
            </div>
          </div>
          <p class="muted" style="font-size:12px;margin:0">
            Su nombre, codigo y area salen de su ficha. La papeleta pasa primero por el jefe de area y
            despues por Recursos Humanos.
          </p>
        </form>
        <div footer>
          <button class="btn btn-ghost" (click)="formHoras.set(false)">Cancelar</button>
          <button class="btn btn-primary" [disabled]="guardando()" (click)="guardarHoras()">Emitir</button>
        </div>
      </app-modal>
    }

    @if (formSalida()) {
      <app-modal title="Papeleta de salida" (closed)="formSalida.set(false)">
        <form [formGroup]="salidaForm" class="stack">
          <div class="field">
            <label>Tipo de salida *</label>
            <div class="row">
              @for (op of tiposSalida; track op.valor) {
                <label class="opcion" [class.activa]="salidaForm.value.salidaMotivo === op.valor">
                  <input type="radio" [value]="op.valor" formControlName="salidaMotivo" />
                  {{ op.etiqueta }}
                </label>
              }
            </div>
          </div>
          <div class="field">
            <label>Fecha *</label>
            <input type="date" formControlName="fecha" />
          </div>
          <div class="field">
            <label>Tiempo solicitado *</label>
            <input formControlName="tiempoSolicitado" placeholder="2 horas, media jornada..." />
          </div>
          <div class="field">
            <label>Motivo *</label>
            <textarea formControlName="motivo"></textarea>
          </div>
          <div class="row" style="gap:14px">
            <div class="field flex-1">
              <label>Hora de salida *</label>
              <input type="time" formControlName="horaSalida" />
            </div>
            <div class="field flex-1">
              <label>Hora de retorno</label>
              <input type="time" formControlName="horaRetorno" />
              <span class="hint">Dejela vacia si no regresa ese dia.</span>
            </div>
          </div>

          @if (salidaForm.value.salidaMotivo === 'MEDICA') {
            <div class="field">
              <label>Certificado medico (opcional)</label>
              <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" (change)="onAdjuntoSeleccionado($event)" />
              <span class="hint">Foto o PDF de la ficha/certificado. Queda adjunto a esta papeleta.</span>
              @if (adjuntoPreview()) {
                <img [src]="adjuntoPreview()" alt="Vista previa del certificado" class="adjunto-preview" />
              } @else if (adjuntoArchivo()) {
                <span class="badge badge-ok" style="margin-top:6px">{{ adjuntoArchivo()!.name }}</span>
              }
            </div>
          }
        </form>
        <div footer>
          <button class="btn btn-ghost" (click)="formSalida.set(false)">Cancelar</button>
          <button class="btn btn-primary" [disabled]="guardando()" (click)="guardarSalida()">Emitir</button>
        </div>
      </app-modal>
    }

    @if (rechazando(); as p) {
      <app-modal [title]="'Rechazar ' + p.numero" (closed)="rechazando.set(null)">
        <div class="field">
          <label>Motivo del rechazo *</label>
          <textarea [value]="motivoRechazo()" (input)="motivoRechazo.set($any($event.target).value)"></textarea>
          <span class="hint">El empleado vera este mensaje en su papeleta.</span>
        </div>
        <div footer>
          <button class="btn btn-ghost" (click)="rechazando.set(null)">Cancelar</button>
          <button class="btn btn-danger" (click)="rechazar(p)">Rechazar</button>
        </div>
      </app-modal>
    }

    @if (viendo(); as p) {
      <app-modal [title]="'Papeleta ' + p.numero" (closed)="viendo.set(null)">
        <div class="doc">
          <div class="doc-head" [class.salida]="p.tipo === 'SALIDA'">
            <div class="doc-brand">
              <span>Laboratorios ABD</span>
              <strong>Departamento de RRHH</strong>
            </div>
            <span [class]="p.estado | badgeClase">{{ p.estado | etiqueta }}</span>
          </div>
          <div class="doc-banner">
            {{ p.tipo === 'HORAS_EXTRAS' ? 'Papeleta de horas extras' : 'Papeleta de salida' }}
          </div>

          <div class="doc-grid">
            <div class="doc-field"><span>Empleado</span><strong>{{ p.employeeNombre }}</strong></div>
            <div class="doc-field"><span>Codigo</span><strong>{{ p.employeeCodigo }}</strong></div>
            <div class="doc-field"><span>Area</span><strong>{{ p.area }}</strong></div>
            <div class="doc-field"><span>Fecha</span><strong>{{ p.fecha | fecha }}</strong></div>
          </div>

          @if (p.tipo === 'HORAS_EXTRAS') {
            <div class="doc-field wide">
              <span>Trabajo realizado</span>
              <strong>{{ p.trabajoRealizado }}</strong>
            </div>
            <div class="doc-grid">
              <div class="doc-field"><span>Desde</span><strong>{{ hora(p.desde) }}</strong></div>
              <div class="doc-field"><span>Hasta</span><strong>{{ hora(p.hasta) }}</strong></div>
              <div class="doc-field"><span>Recargo</span><strong>{{ p.recargo | etiqueta }}</strong></div>
              <div class="doc-field">
                <span>Total horas</span>
                <strong class="doc-total">{{ p.totalHoras }} h</strong>
              </div>
            </div>
          } @else {
            <div class="doc-checks">
              @for (op of tiposSalida; track op.valor) {
                <div class="doc-check" [class.on]="p.salidaMotivo === op.valor">
                  <span class="box">{{ p.salidaMotivo === op.valor ? '✓' : '' }}</span>
                  {{ op.etiqueta }}
                </div>
              }
            </div>
            <div class="doc-field wide"><span>Motivo</span><strong>{{ p.motivo }}</strong></div>
            <div class="doc-grid">
              <div class="doc-field"><span>Tiempo solicitado</span><strong>{{ p.tiempoSolicitado }}</strong></div>
              <div class="doc-field"><span>Hora de salida</span><strong>{{ p.horaSalida }}</strong></div>
              <div class="doc-field">
                <span>Hora de retorno</span>
                <strong>{{ p.horaRetorno ?? 'No especificada' }}</strong>
              </div>
            </div>
            @if (p.salidaMotivo === 'MEDICA') {
              <div class="doc-field wide">
                <span>Certificado medico</span>
                @if (p.attachmentUrl) {
                  <button class="btn btn-secondary btn-sm" style="margin-top:4px;align-self:start" (click)="verAdjunto(p)">
                    Ver certificado
                  </button>
                } @else {
                  <strong class="muted">No se adjunto certificado</strong>
                }
              </div>
            }
          }

          @if (p.motivoRechazo) {
            <div class="doc-alert">Rechazada: {{ p.motivoRechazo }}</div>
          }

          <div class="doc-firmas">
            <div class="doc-firma" [class.ok]="p.firmaArea">
              <span class="rol">Jefe de area</span>
              @if (p.firmaArea; as f) {
                <strong>{{ f.nombre }}</strong>
                <span class="cuando">{{ f.fecha | fecha: true }}</span>
              } @else {
                <span class="pendiente">Pendiente de firma</span>
              }
            </div>
            <div class="doc-firma" [class.ok]="p.firmaRrhh">
              <span class="rol">{{ p.tipo === 'SALIDA' ? 'Enc. Personal / RRHH' : 'Jefe de RRHH' }}</span>
              @if (p.firmaRrhh; as f) {
                <strong>{{ f.nombre }}</strong>
                <span class="cuando">{{ f.fecha | fecha: true }}</span>
              } @else {
                <span class="pendiente">Pendiente de firma</span>
              }
            </div>
          </div>
        </div>

        <div footer>
          @if (puedeFirmar(p)) {
            <button class="btn btn-ghost" (click)="rechazarDesdeVisor(p)">Rechazar</button>
            <button class="btn btn-secondary" (click)="firmarDesdeVisor(p)">Firmar</button>
          }
          <button class="btn btn-ghost" (click)="viendo.set(null)">Cerrar</button>
          <button class="btn btn-primary" (click)="descargar(p)">Ver PDF e imprimir</button>
        </div>
      </app-modal>
    }

    @if (docPreview(); as doc) {
      <app-modal [title]="doc.titulo" (closed)="cerrarDocPreview()">
        <iframe #pdfFrame [src]="doc.url" class="pdf-frame" title="Vista previa del documento"></iframe>
        <div footer>
          <button class="btn btn-ghost" (click)="cerrarDocPreview()">Cerrar</button>
          <button class="btn btn-primary" (click)="imprimir()">Imprimir</button>
        </div>
      </app-modal>
    }
  `,
  styles: [
    `
      .filtros {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        align-items: flex-end;
      }
      .filtros .field {
        min-width: 170px;
      }
      .stack {
        display: flex;
        flex-direction: column;
        gap: 14px;
      }
      .adjunto-preview {
        margin-top: 8px;
        max-width: 160px;
        max-height: 120px;
        border-radius: 8px;
        border: 1px solid var(--ink-200);
        object-fit: cover;
      }
      .pdf-frame {
        width: 100%;
        height: 68vh;
        border: 0;
        border-radius: 8px;
        background: var(--ink-100);
      }
      .firma {
        display: inline-block;
        padding: 2px 7px;
        margin-right: 4px;
        border-radius: 6px;
        font-size: 10.5px;
        font-weight: 600;
        background: var(--ink-100);
        color: var(--ink-500);
      }
      .firma.ok {
        background: var(--ok-100);
        color: var(--ok-700);
      }
      .opcion {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 8px 12px;
        border: 1px solid var(--ink-300);
        border-radius: 10px;
        font-size: 13px;
        cursor: pointer;
      }
      .opcion.activa {
        border-color: var(--brand-600);
        background: var(--brand-50);
        color: var(--brand-800);
        font-weight: 600;
      }

      /* Visor: reproduce la papeleta en pantalla, en lugar de abrir directo el PDF. */
      .doc {
        border: 1px solid var(--ink-200);
        border-radius: var(--radius-lg);
        overflow: hidden;
      }
      .doc-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 14px 18px;
        background: var(--brand-800);
        color: #fff;
      }
      .doc-head.salida {
        background: var(--brand-700);
      }
      .doc-brand {
        display: flex;
        flex-direction: column;
        line-height: 1.3;
      }
      .doc-brand span {
        font-size: 10px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        opacity: 0.75;
      }
      .doc-brand strong {
        font-size: 14px;
        color: #fff;
      }
      .doc-banner {
        padding: 10px 18px;
        background: var(--brand-50);
        color: var(--brand-800);
        font-weight: 700;
        font-size: 13px;
        text-align: center;
        letter-spacing: 0.02em;
        border-bottom: 1px solid var(--ink-200);
      }
      .doc-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
        gap: 14px;
        padding: 16px 18px 4px;
      }
      .doc-field {
        display: flex;
        flex-direction: column;
        gap: 3px;
      }
      .doc-field.wide {
        padding: 0 18px 4px;
      }
      .doc-field span {
        font-size: 10.5px;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: var(--ink-500);
        font-weight: 600;
      }
      .doc-field strong {
        font-size: 13.5px;
        color: var(--ink-900);
      }
      .doc-total {
        color: var(--brand-700);
        font-size: 16px;
      }
      .doc-checks {
        display: flex;
        gap: 10px;
        padding: 14px 18px 4px;
      }
      .doc-check {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 12px;
        border: 1px solid var(--ink-300);
        border-radius: 10px;
        font-size: 12.5px;
        color: var(--ink-500);
      }
      .doc-check.on {
        border-color: var(--brand-600);
        background: var(--brand-50);
        color: var(--brand-800);
        font-weight: 600;
      }
      .doc-check .box {
        width: 16px;
        height: 16px;
        border-radius: 4px;
        border: 1px solid currentColor;
        display: grid;
        place-items: center;
        font-size: 11px;
        line-height: 1;
      }
      .doc-alert {
        margin: 14px 18px 0;
        padding: 10px 12px;
        border-radius: 10px;
        background: var(--danger-100);
        color: var(--danger-700);
        font-size: 12.5px;
        font-weight: 500;
      }
      .doc-firmas {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 14px;
        padding: 16px 18px 18px;
        margin-top: 10px;
        border-top: 1px dashed var(--ink-300);
      }
      .doc-firma {
        display: flex;
        flex-direction: column;
        gap: 3px;
        padding: 10px 12px;
        border-radius: 10px;
        background: var(--ink-50);
      }
      .doc-firma.ok {
        background: var(--ok-100);
      }
      .doc-firma .rol {
        font-size: 10.5px;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: var(--ink-500);
        font-weight: 700;
      }
      .doc-firma strong {
        font-size: 13px;
        color: var(--ink-900);
      }
      .doc-firma .cuando {
        font-size: 11px;
        color: var(--ink-500);
      }
      .doc-firma .pendiente {
        font-size: 12px;
        color: var(--warn-700);
        font-style: italic;
      }
    `,
  ],
})
export class PapeletaListComponent implements OnInit, OnDestroy {
  private readonly api = inject(ApiService);
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(ToastService);
  readonly auth = inject(AuthService);

  readonly tiposSalida = [
    { valor: 'PARTICULAR', etiqueta: 'Particular' },
    { valor: 'OFICIAL', etiqueta: 'Oficial' },
    { valor: 'MEDICA', etiqueta: 'Medica' },
  ];

  readonly cargando = signal(true);
  readonly guardando = signal(false);
  readonly papeletas = signal<Papeleta[]>([]);
  readonly meta = signal<PageMeta | null>(null);
  readonly formHoras = signal(false);
  readonly formSalida = signal(false);
  readonly rechazando = signal<Papeleta | null>(null);
  readonly motivoRechazo = signal('');
  readonly viendo = signal<Papeleta | null>(null);
  readonly adjuntoArchivo = signal<File | null>(null);
  readonly adjuntoPreview = signal<string | null>(null);

  /** Visor generico embebido en un modal (el PDF de la papeleta o el certificado adjunto). */
  private readonly sanitizer = inject(DomSanitizer);
  readonly docPreview = signal<{ titulo: string; url: SafeResourceUrl } | null>(null);
  private docObjectUrl: string | null = null;
  @ViewChild('pdfFrame') private pdfFrame?: ElementRef<HTMLIFrameElement>;

  readonly filtros = signal({ tipo: '', estado: '', search: '', page: 1, limit: 10 });

  private readonly hoy = new Date().toISOString().slice(0, 10);

  readonly horasForm = this.fb.nonNullable.group({
    fecha: [this.hoy, Validators.required],
    trabajoRealizado: ['', [Validators.required, Validators.minLength(5)]],
    horaDesde: ['18:00', Validators.required],
    horaHasta: ['20:00', Validators.required],
    recargo: ['DIURNA'],
  });

  readonly salidaForm = this.fb.nonNullable.group({
    fecha: [this.hoy, Validators.required],
    salidaMotivo: ['PARTICULAR', Validators.required],
    tiempoSolicitado: ['', Validators.required],
    motivo: ['', [Validators.required, Validators.minLength(4)]],
    horaSalida: ['', Validators.required],
    horaRetorno: [''],
  });

  private buscador?: ReturnType<typeof setTimeout>;

  ngOnInit(): void {
    this.cargar();
  }

  setFiltro(clave: 'tipo' | 'estado' | 'search', valor: string): void {
    this.filtros.update((f) => ({ ...f, [clave]: valor, page: 1 }));
    if (clave === 'search') {
      clearTimeout(this.buscador);
      this.buscador = setTimeout(() => this.cargar(), 320);
      return;
    }
    this.cargar();
  }

  irAPagina(page: number): void {
    this.filtros.update((f) => ({ ...f, page }));
    this.cargar();
  }

  setLimite(limit: number): void {
    this.filtros.update((f) => ({ ...f, limit, page: 1 }));
    this.cargar();
  }

  cargar(): void {
    this.cargando.set(true);
    this.api.list<Papeleta>('/papeletas', { ...this.filtros() }).subscribe({
      next: (page) => {
        this.papeletas.set(page.data);
        this.meta.set(page.meta);
        this.cargando.set(false);
      },
      error: () => {
        this.papeletas.set([]);
        this.cargando.set(false);
      },
    });
  }

  /** El boton aparece solo si al rol le toca firmar ese paso; la API lo revalida. */
  puedeFirmar(p: Papeleta): boolean {
    if (p.employeeId === this.auth.employeeId()) return false;
    if (p.estado === 'PENDIENTE_JEFE_AREA') return this.auth.hasRole('SUPERVISOR', 'ADMIN');
    if (p.estado === 'PENDIENTE_RRHH') return this.auth.hasRole('HR', 'ADMIN');
    return false;
  }

  puedeAnular(p: Papeleta): boolean {
    const enCurso = p.estado === 'PENDIENTE_JEFE_AREA' || p.estado === 'PENDIENTE_RRHH';
    return enCurso && (p.employeeId === this.auth.employeeId() || this.auth.isHr());
  }

  abrirHorasExtras(): void {
    this.horasForm.reset({ fecha: this.hoy, horaDesde: '18:00', horaHasta: '20:00', recargo: 'DIURNA' });
    this.formHoras.set(true);
  }

  abrirSalida(): void {
    this.salidaForm.reset({ fecha: this.hoy, salidaMotivo: 'PARTICULAR' });
    this.adjuntoArchivo.set(null);
    this.adjuntoPreview.set(null);
    this.formSalida.set(true);
  }

  onAdjuntoSeleccionado(event: Event): void {
    const archivo = (event.target as HTMLInputElement).files?.[0] ?? null;
    this.adjuntoArchivo.set(archivo);
    this.adjuntoPreview.set(null);
    if (archivo && archivo.type.startsWith('image/')) {
      const lector = new FileReader();
      lector.onload = () => this.adjuntoPreview.set(lector.result as string);
      lector.readAsDataURL(archivo);
    }
  }

  guardarHoras(): void {
    if (this.horasForm.invalid) {
      this.horasForm.markAllAsTouched();
      this.toast.warn('Revise el formulario', 'Complete el trabajo realizado y el horario');
      return;
    }
    const v = this.horasForm.getRawValue();
    this.guardando.set(true);
    this.api
      .post<Papeleta>('/papeletas/horas-extras', {
        fecha: v.fecha,
        trabajoRealizado: v.trabajoRealizado,
        desde: `${v.fecha}T${v.horaDesde}:00`,
        hasta: `${v.fecha}T${v.horaHasta}:00`,
        recargo: v.recargo,
      })
      .subscribe({
        next: (r) => {
          this.guardando.set(false);
          this.formHoras.set(false);
          this.toast.success(`Papeleta ${r.data.numero} emitida`, 'Espera la firma del jefe de area');
          this.cargar();
        },
        error: (e) => {
          this.guardando.set(false);
          this.toast.error('No se pudo emitir', apiErrorMessage(e));
        },
      });
  }

  guardarSalida(): void {
    if (this.salidaForm.invalid) {
      this.salidaForm.markAllAsTouched();
      this.toast.warn('Revise el formulario', 'Complete el motivo y la hora de salida');
      return;
    }
    const v = this.salidaForm.getRawValue();
    this.guardando.set(true);

    const emitir = (attachmentUrl?: string): void => {
      this.api
        .post<Papeleta>('/papeletas/salidas', {
          fecha: v.fecha,
          salidaMotivo: v.salidaMotivo,
          motivo: v.motivo,
          tiempoSolicitado: v.tiempoSolicitado,
          horaSalida: v.horaSalida,
          horaRetorno: v.horaRetorno || undefined,
          attachmentUrl,
        })
        .subscribe({
          next: (r) => {
            this.guardando.set(false);
            this.formSalida.set(false);
            this.toast.success(`Papeleta ${r.data.numero} emitida`, 'Espera la firma del jefe de area');
            this.cargar();
          },
          error: (e) => {
            this.guardando.set(false);
            this.toast.error('No se pudo emitir', apiErrorMessage(e));
          },
        });
    };

    const archivo = this.adjuntoArchivo();
    if (v.salidaMotivo === 'MEDICA' && archivo) {
      const form = new FormData();
      form.append('file', archivo);
      this.api.upload<{ url: string }>('/uploads', form).subscribe({
        next: (r) => emitir(r.data.url),
        error: (e) => {
          this.guardando.set(false);
          this.toast.error('No se pudo subir el certificado', apiErrorMessage(e));
        },
      });
    } else {
      emitir();
    }
  }

  firmar(p: Papeleta): void {
    this.api.post<Papeleta>(`/papeletas/${p.id}/firmar`).subscribe({
      next: (r) => {
        this.toast.success(
          r.data.estado === 'APROBADA' ? 'Papeleta aprobada' : 'Firmada, pasa a Recursos Humanos',
        );
        this.cargar();
      },
      error: (e) => this.toast.error('No se pudo firmar', apiErrorMessage(e)),
    });
  }

  abrirRechazo(p: Papeleta): void {
    this.motivoRechazo.set('');
    this.rechazando.set(p);
  }

  rechazar(p: Papeleta): void {
    if (this.motivoRechazo().trim().length < 5) {
      this.toast.warn('Indique el motivo', 'Escriba al menos 5 caracteres');
      return;
    }
    this.api.post(`/papeletas/${p.id}/rechazar`, { motivo: this.motivoRechazo() }).subscribe({
      next: () => {
        this.rechazando.set(null);
        this.toast.success('Papeleta rechazada');
        this.cargar();
      },
      error: (e) => this.toast.error('No se pudo rechazar', apiErrorMessage(e)),
    });
  }

  anular(p: Papeleta): void {
    this.api.post(`/papeletas/${p.id}/anular`).subscribe({
      next: () => {
        this.toast.info('Papeleta anulada');
        this.cargar();
      },
      error: (e) => this.toast.error('No se pudo anular', apiErrorMessage(e)),
    });
  }

  /** Ver el PDF de la papeleta dentro de un modal, antes de imprimir. */
  descargar(p: Papeleta): void {
    this.api.download(`/papeletas/${p.id}/pdf`).subscribe({
      next: (r) => this.mostrarEnVisor(r.body as Blob, `Papeleta ${p.numero}`),
      error: () => this.toast.error('No se pudo generar el PDF'),
    });
  }

  /** Certificado adjunto a una salida medica: misma logica, mismo visor. */
  verAdjunto(p: Papeleta): void {
    if (!p.attachmentUrl) return;
    this.api.download(p.attachmentUrl).subscribe({
      next: (r) => this.mostrarEnVisor(r.body as Blob, `Certificado - ${p.numero}`),
      error: () => this.toast.error('No se pudo abrir el certificado'),
    });
  }

  private mostrarEnVisor(blob: Blob, titulo: string): void {
    this.cerrarDocPreview();
    this.docObjectUrl = URL.createObjectURL(blob);
    this.docPreview.set({ titulo, url: this.sanitizer.bypassSecurityTrustResourceUrl(this.docObjectUrl) });
  }

  cerrarDocPreview(): void {
    if (this.docObjectUrl) {
      URL.revokeObjectURL(this.docObjectUrl);
      this.docObjectUrl = null;
    }
    this.docPreview.set(null);
  }

  /** Imprime directo el contenido del iframe: no hace falta buscar el boton del visor del navegador. */
  imprimir(): void {
    const ventana = this.pdfFrame?.nativeElement.contentWindow;
    if (!ventana) {
      this.toast.error('El documento todavia no termino de cargar');
      return;
    }
    ventana.focus();
    ventana.print();
  }

  ngOnDestroy(): void {
    this.cerrarDocPreview();
  }

  /** Vista en pantalla de la papeleta: el PDF queda como descarga opcional dentro del visor. */
  ver(p: Papeleta): void {
    this.viendo.set(p);
  }

  /** "Desde" y "hasta" llegan como fecha y hora completas; en el visor solo se muestra la hora. */
  hora(iso: string | null): string {
    if (!iso) return '-';
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  firmarDesdeVisor(p: Papeleta): void {
    this.viendo.set(null);
    this.firmar(p);
  }

  rechazarDesdeVisor(p: Papeleta): void {
    this.viendo.set(null);
    this.abrirRechazo(p);
  }
}
