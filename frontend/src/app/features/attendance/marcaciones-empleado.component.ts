import { ChangeDetectionStrategy, Component, EventEmitter, Input, OnInit, Output, computed, inject, signal } from '@angular/core';
import { forkJoin, Observable, of, switchMap, map } from 'rxjs';
import { ApiService } from '../../core/services/api.service';
import { ToastService } from '../../core/services/toast.service';
import { apiErrorMessage } from '../../core/interceptors/auth.interceptor';
import { AttendanceRecord, AttendanceReportRow, Paginated } from '../../core/models/api.models';
import { ModalComponent, StateComponent } from '../../shared/components/ui.components';
import { BancoHorasComponent } from '../../shared/components/banco-horas.component';
import {
  ETIQUETA_ESTADO,
  EstadoDia,
  MarcacionesDelDia,
  aIsoLocal,
  agruparPorDia,
  claveDia,
  etiquetaDia,
  formatoHoras,
  formatoMinutos,
  horaLocal,
} from './asistencia-formato';

interface FilaDia {
  clave: string;
  etiqueta: string;
  estado: EstadoDia;
  tardanza: number;
  horas: number;
  marcaciones: MarcacionesDelDia;
}

interface Edicion {
  clave: string;
  tipo: 'CHECK_IN' | 'CHECK_OUT';
  registro: AttendanceRecord | null;
}

const POR_PAGINA = 100;

/** Marcaciones de un empleado dia por dia, con correccion de entradas y salidas para RRHH. */
@Component({
  selector: 'app-marcaciones-empleado',
  standalone: true,
  imports: [ModalComponent, StateComponent, BancoHorasComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal size="lg" [title]="fila.employeeName + ' · ' + fila.employeeCode" (closed)="cerrado.emit()">
      <div class="vistas" role="tablist" aria-label="Detalle del empleado">
        <button type="button" role="tab" [attr.aria-selected]="vista() === 'marcaciones'" (click)="vista.set('marcaciones')">Marcaciones</button>
        <button type="button" role="tab" [attr.aria-selected]="vista() === 'banco'" (click)="vista.set('banco')">Banco de horas</button>
      </div>

      @if (vista() === 'banco') {
        <app-banco-horas [employeeId]="fila.employeeId" [puedeAjustar]="puedeEditar" (cambiado)="cambiado.emit()" />
      } @else {
      <div class="resumen">
        <span><strong>{{ fila.daysPresent }}</strong> dias trabajados</span>
        @if (fila.daysIncomplete > 0) {
          <span class="alerta"><strong>{{ fila.daysIncomplete }}</strong> incompletos</span>
        }
        <span [class.alerta]="fila.daysLate > 0"><strong>{{ fila.daysLate }}</strong> llegadas tarde{{ fila.daysLate > 0 ? " (" + minutos(fila.totalLateMinutes) + ")" : "" }}</span>
        <span [class.peligro]="fila.daysAbsent > 0"><strong>{{ fila.daysAbsent }}</strong> faltas</span>
        <span><strong>{{ horas(fila.workedHours) }}</strong> trabajadas</span>
        <span class="horario">{{ fila.scheduleName ?? 'Sin horario asignado' }}</span>
      </div>
      @if (puedeEditar) {
        <p class="ayuda">Use <em>Corregir</em> o <em>Agregar</em> para ajustar una entrada o salida. Cada cambio pide un motivo y queda en Auditoria.</p>
      }

      @if (cargando()) {
        <app-state mode="loading" title="Cargando marcaciones"></app-state>
      } @else {
        <div class="table-wrap">
          <table class="data dias">
            <thead>
              <tr>
                <th>Dia</th>
                <th>Entrada</th>
                <th>Salida</th>
                <th class="num">Horas</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              @for (dia of dias(); track dia.clave) {
                <tr [class.descanso]="dia.estado === 'REST'">
                  <td class="nowrap strong">{{ dia.etiqueta }}</td>

                  @for (tipo of tipos; track tipo) {
                    <td class="celda-hora">
                      @if (editando()?.clave === dia.clave && editando()?.tipo === tipo) {
                        <form class="editor" (submit)="guardar($event)">
                          <input type="time" required [value]="horaInicial()" (input)="hora.set($any($event.target).value)" aria-label="Hora" />
                          <input type="text" required minlength="5" maxlength="200" placeholder="Motivo del cambio" (input)="motivo.set($any($event.target).value)" aria-label="Motivo" />
                          <div class="editor-acciones">
                            <button type="submit" class="btn btn-primary btn-sm" [disabled]="guardando()">Guardar</button>
                            <button type="button" class="btn btn-ghost btn-sm" (click)="editando.set(null)">Cancelar</button>
                          </div>
                        </form>
                      } @else {
                        @if (registroDe(dia, tipo); as r) {
                          <span class="hora" [class.manual]="r.source === 'MANUAL_HR'" [title]="r.source === 'MANUAL_HR' ? 'Corregida o cargada por RRHH' : 'Marcacion del reloj'">
                            {{ horaLocal(r.timestamp) }}
                          </span>
                          @if (tipo === 'CHECK_IN' && dia.tardanza > 0) {
                            <span class="tarde">+{{ dia.tardanza }} min</span>
                          }
                          @if (puedeEditar) {
                            <button type="button" class="link" (click)="editar(dia, tipo, r)">Corregir</button>
                          }
                        } @else {
                          <span class="vacio">—</span>
                          @if (puedeEditar && dia.estado !== 'REST' && (tipo === 'CHECK_IN' || dia.marcaciones.entrada)) {
                            <button type="button" class="link" (click)="editar(dia, tipo, null)">Agregar</button>
                          }
                        }
                      }
                    </td>
                  }

                  <td class="num">{{ horas(dia.horas) }}</td>
                  <td>
                    <span class="estado" [class]="'estado estado-' + dia.estado">{{ etiquetaEstado(dia) }}</span>
                    @if (dia.marcaciones.otras.length) {
                      <span class="otras" [title]="textoOtras(dia)">+{{ dia.marcaciones.otras.length }} marc.</span>
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
      }
      <div footer>
        <button class="btn btn-ghost" type="button" (click)="cerrado.emit()">Cerrar</button>
      </div>
    </app-modal>
  `,
  styleUrl: './marcaciones-empleado.component.scss',
})
export class MarcacionesEmpleadoComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);

  @Input({ required: true }) fila!: AttendanceReportRow;
  @Input({ required: true }) desde = '';
  @Input({ required: true }) hasta = '';
  @Input() puedeEditar = false;
  @Output() cerrado = new EventEmitter<void>();
  @Output() cambiado = new EventEmitter<void>();

  readonly tipos: Array<'CHECK_IN' | 'CHECK_OUT'> = ['CHECK_IN', 'CHECK_OUT'];
  readonly vista = signal<'marcaciones' | 'banco'>('marcaciones');
  readonly horaLocal = horaLocal;
  readonly horas = formatoHoras;
  readonly minutos = formatoMinutos;

  readonly cargando = signal(true);
  readonly guardando = signal(false);
  readonly dias = signal<FilaDia[]>([]);
  readonly editando = signal<Edicion | null>(null);
  readonly hora = signal('');
  readonly motivo = signal('');
  readonly horaInicial = computed(() => {
    const e = this.editando();
    if (!e) return '';
    if (e.registro) return horaLocal(e.registro.timestamp);
    return e.tipo === 'CHECK_IN' ? '08:00' : '17:00';
  });

  ngOnInit(): void {
    this.cargar();
  }

  etiquetaEstado(dia: FilaDia): string {
    if (dia.estado === 'INCOMPLETE') return dia.marcaciones.entrada ? 'Sin salida' : 'Sin entrada';
    // Sin horario no hay contra que medir la puntualidad.
    if (dia.estado === 'PRESENT' && !this.fila.scheduleName) return 'Asistio';
    return ETIQUETA_ESTADO[dia.estado] ?? dia.estado;
  }

  registroDe(dia: FilaDia, tipo: 'CHECK_IN' | 'CHECK_OUT'): AttendanceRecord | null {
    return tipo === 'CHECK_IN' ? dia.marcaciones.entrada : dia.marcaciones.salida;
  }

  textoOtras(dia: FilaDia): string {
    return dia.marcaciones.otras
      .map((r) => `${r.type === 'CHECK_IN' ? 'Entrada' : 'Salida'} ${horaLocal(r.timestamp)}`)
      .join(' · ');
  }

  editar(dia: FilaDia, tipo: 'CHECK_IN' | 'CHECK_OUT', registro: AttendanceRecord | null): void {
    this.editando.set({ clave: dia.clave, tipo, registro });
    this.hora.set(this.horaInicial());
    this.motivo.set('');
  }

  guardar(evento: Event): void {
    evento.preventDefault();
    const e = this.editando();
    if (!e) return;
    const motivo = this.motivo().trim();
    if (!this.hora() || motivo.length < 5) {
      this.toast.warn('Faltan datos', 'Indique la hora y un motivo de al menos 5 caracteres');
      return;
    }
    const timestamp = aIsoLocal(e.clave, this.hora());
    const peticion: Observable<unknown> = e.registro
      ? this.api.patch(`/attendance/${e.registro.id}`, { timestamp, reason: motivo })
      : this.api.post(e.tipo === 'CHECK_IN' ? '/attendance/check-in' : '/attendance/check-out', {
          employeeId: this.fila.employeeId,
          timestamp,
          notes: motivo,
        });

    this.guardando.set(true);
    peticion.subscribe({
      next: () => {
        this.guardando.set(false);
        this.editando.set(null);
        this.toast.success(e.registro ? 'Marcacion corregida' : 'Marcacion agregada');
        this.cargar();
        this.cambiado.emit();
      },
      error: (err) => {
        this.guardando.set(false);
        this.toast.error('No se pudo guardar', apiErrorMessage(err));
      },
    });
  }

  private cargar(): void {
    this.cargando.set(true);
    const resumen$ = this.api.list<AttendanceReportRow>('/attendance/report', {
      from: this.desde,
      to: this.hasta,
      employeeId: this.fila.employeeId,
      includeDays: 'true',
      page: 1,
      limit: 1,
    });

    forkJoin([resumen$, this.todasLasMarcaciones()]).subscribe({
      next: ([resumen, registros]) => {
        const porDia = agruparPorDia(registros);
        const actual = resumen.data[0];
        if (actual) this.fila = { ...this.fila, ...actual, days: undefined };
        this.dias.set(
          (actual?.days ?? []).map((d) => {
            const clave = claveDia(d.date);
            return {
              clave,
              etiqueta: etiquetaDia(d.date),
              estado: d.status as EstadoDia,
              tardanza: d.lateMinutes,
              horas: d.workedHours ?? 0,
              marcaciones: porDia.get(clave) ?? { entrada: null, salida: null, otras: [] },
            };
          }),
        );
        this.cargando.set(false);
      },
      error: (err) => {
        this.cargando.set(false);
        this.toast.error('No se pudieron cargar las marcaciones', apiErrorMessage(err));
      },
    });
  }

  private todasLasMarcaciones(): Observable<AttendanceRecord[]> {
    const pagina = (n: number) =>
      this.api.list<AttendanceRecord>('/attendance', {
        employeeId: this.fila.employeeId,
        dateFrom: this.desde,
        dateTo: this.hasta,
        page: n,
        limit: POR_PAGINA,
      });
    return pagina(1).pipe(
      switchMap((primera: Paginated<AttendanceRecord>) => {
        const total = primera.meta.totalPages;
        if (total <= 1) return of(primera.data);
        const resto = Array.from({ length: Math.min(total, 10) - 1 }, (_, i) => pagina(i + 2));
        return forkJoin(resto).pipe(map((paginas) => [...primera.data, ...paginas.flatMap((p) => p.data)]));
      }),
    );
  }
}
