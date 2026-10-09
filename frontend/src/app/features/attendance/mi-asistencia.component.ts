import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { apiErrorMessage } from '../../core/interceptors/auth.interceptor';
import { AttendanceJustification, AttendanceRecord } from '../../core/models/api.models';
import { CardComponent, ModalComponent, PageHeaderComponent, StateComponent } from '../../shared/components/ui.components';
import { BadgeClasePipe, EtiquetaPipe, FechaPipe } from '../../shared/pipes/format.pipes';

const ORIGEN: Record<string, string> = {
  BIOMETRIC: 'Reloj biometrico',
  MANUAL_HR: 'Agregada por RRHH',
  IMPORT: 'Importada',
  WEB: 'Web (sistema anterior)',
  MOBILE: 'Movil (sistema anterior)',
};

function hoyLocal(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Consulta de las propias marcaciones (vienen del biometrico) y justificaciones. Aqui ya no se marca. */
@Component({
  selector: 'app-mi-asistencia',
  standalone: true,
  imports: [PageHeaderComponent, CardComponent, StateComponent, ModalComponent, FechaPipe, EtiquetaPipe, BadgeClasePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <app-page-header title="Mi asistencia" subtitle="Sus marcaciones del biometrico y sus justificaciones">
        <button class="btn btn-primary btn-sm" (click)="justificarAbierto.set(true)">Justificar falta o tardanza</button>
      </app-page-header>

      <p class="aviso-reloj">
        La entrada y la salida se marcan en el <b>reloj biometrico</b>. Si olvido marcar o una hora esta mal,
        avise a Recursos Humanos o envie una justificacion.
      </p>

      @if (!tieneFicha) {
        <app-state title="Su usuario no esta vinculado a un empleado" message="Solicite a Recursos Humanos que vincule su cuenta con su ficha."></app-state>
      } @else {
        <app-card heading="Mis ultimas marcaciones" [padded]="false">
          @if (cargando()) {
            <app-state mode="loading" title="Cargando marcaciones"></app-state>
          } @else if (marcaciones().length === 0) {
            <app-state title="Sin marcaciones" message="Cuando marque en el reloj, sus marcaciones apareceran aqui en unos minutos."></app-state>
          } @else {
            <div class="table-wrap">
              <table class="data">
                <thead>
                  <tr>
                    <th>Fecha y hora</th>
                    <th>Tipo</th>
                    <th>Origen</th>
                    <th class="num">Atraso</th>
                    <th>Observacion</th>
                  </tr>
                </thead>
                <tbody>
                  @for (m of marcaciones(); track m.id) {
                    <tr>
                      <td class="nowrap">{{ m.timestamp | fecha: true }}</td>
                      <td><span [class]="m.type | badgeClase">{{ m.type | etiqueta }}</span></td>
                      <td class="muted">{{ origen(m.source) }}</td>
                      <td class="num" [class.atraso]="m.lateMinutes > 0">{{ m.lateMinutes > 0 ? m.lateMinutes + ' min' : '-' }}</td>
                      <td class="muted">{{ observacion(m.notes) }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }
        </app-card>

        <app-card heading="Mis justificaciones" [padded]="false">
          @if (justificaciones().length === 0) {
            <app-state title="Sin justificaciones" message="Puede justificar una falta o tardanza con el boton de arriba."></app-state>
          } @else {
            <div class="table-wrap">
              <table class="data">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Motivo</th>
                    <th>Estado</th>
                    <th>Observacion</th>
                  </tr>
                </thead>
                <tbody>
                  @for (j of justificaciones(); track j.id) {
                    <tr>
                      <td class="nowrap">{{ j.date | fecha }}</td>
                      <td>{{ j.reason }}</td>
                      <td><span [class]="j.status | badgeClase">{{ j.status | etiqueta }}</span></td>
                      <td class="muted">{{ j.reviewNotes ?? '-' }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }
        </app-card>
      }
    </div>

    @if (justificarAbierto()) {
      <app-modal title="Justificar falta o tardanza" (closed)="justificarAbierto.set(false)">
        <form class="justificar" id="form-justificar" (submit)="enviarJustificacion($event)">
          <div class="field">
            <label for="just-fecha">Fecha *</label>
            <input id="just-fecha" type="date" required [max]="hoy" [value]="fecha()" (change)="fecha.set($any($event.target).value)" />
          </div>
          <div class="field">
            <label for="just-motivo">Motivo *</label>
            <textarea id="just-motivo" required minlength="5" rows="3" placeholder="Cita medica, tramite personal, emergencia familiar..." (input)="motivo.set($any($event.target).value)"></textarea>
          </div>
          <div class="field">
            <label for="just-enlace">Enlace al respaldo (opcional)</label>
            <input id="just-enlace" type="url" placeholder="https://..." (input)="enlace.set($any($event.target).value)" />
            <span class="hint">Certificado medico, boleta o documento que respalde la ausencia.</span>
          </div>
        </form>
        <div footer>
          <button type="button" class="btn btn-ghost" (click)="justificarAbierto.set(false)">Cancelar</button>
          <button type="submit" form="form-justificar" class="btn btn-primary" [disabled]="enviando()">
            {{ enviando() ? 'Enviando...' : 'Enviar' }}
          </button>
        </div>
      </app-modal>
    }
  `,
  styleUrl: './mi-asistencia.component.scss',
})
export class MiAsistenciaComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);
  private readonly auth = inject(AuthService);

  readonly hoy = hoyLocal();
  readonly tieneFicha = !!this.auth.employeeId();
  readonly cargando = signal(true);
  readonly marcaciones = signal<AttendanceRecord[]>([]);
  readonly justificaciones = signal<AttendanceJustification[]>([]);

  readonly justificarAbierto = signal(false);
  readonly enviando = signal(false);
  readonly fecha = signal(hoyLocal());
  readonly motivo = signal('');
  readonly enlace = signal('');

  ngOnInit(): void {
    this.cargar();
  }

  /** La sincronizacion anota el nombre del reloj ("Reloj BIOMETRICO"); eso ya lo dice Origen. */
  observacion(notas: string | null): string {
    return notas && !/^Reloj/i.test(notas) ? notas : '-';
  }

  origen(source: string): string {
    return ORIGEN[source] ?? source;
  }

  enviarJustificacion(evento: Event): void {
    evento.preventDefault();
    if (this.motivo().trim().length < 5) {
      this.toast.warn('Describa el motivo', 'Escriba al menos 5 caracteres');
      return;
    }
    this.enviando.set(true);
    this.api
      .post('/attendance/justifications', {
        date: this.fecha(),
        reason: this.motivo().trim(),
        attachmentUrl: this.enlace().trim() || undefined,
      })
      .subscribe({
        next: () => {
          this.enviando.set(false);
          this.justificarAbierto.set(false);
          this.motivo.set('');
          this.enlace.set('');
          this.toast.success('Justificacion enviada', 'Su supervisor la revisara');
          this.cargar();
        },
        error: (err) => {
          this.enviando.set(false);
          this.toast.error('No se pudo enviar', apiErrorMessage(err));
        },
      });
  }

  private cargar(): void {
    const employeeId = this.auth.employeeId();
    if (!employeeId) {
      this.cargando.set(false);
      return;
    }
    this.api.list<AttendanceRecord>('/attendance', { employeeId, limit: 20 }).subscribe({
      next: (page) => {
        this.marcaciones.set(page.data);
        this.cargando.set(false);
      },
      error: () => this.cargando.set(false),
    });
    this.api.list<AttendanceJustification>('/attendance/justifications', { employeeId, limit: 10 }).subscribe({
      next: (page) => this.justificaciones.set(page.data),
      error: () => this.justificaciones.set([]),
    });
  }
}
