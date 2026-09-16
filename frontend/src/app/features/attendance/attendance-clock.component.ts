import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { apiErrorMessage } from '../../core/interceptors/auth.interceptor';
import { AttendanceJustification, AttendanceRecord } from '../../core/models/api.models';
import {
  CardComponent,
  ModalComponent,
  PageHeaderComponent,
  StateComponent,
} from '../../shared/components/ui.components';
import { BadgeClasePipe, EtiquetaPipe, FechaPipe } from '../../shared/pipes/format.pipes';

/**
 * Marcaje de entrada/salida. Pensado para movil: el empleado marca desde el
 * celular (seccion 10). La geolocalizacion es opcional y solo se envia si el
 * navegador la concede.
 */
@Component({
  selector: 'app-attendance-clock',
  standalone: true,
  imports: [
    CommonModule,
    PageHeaderComponent,
    CardComponent,
    StateComponent,
    ModalComponent,
    FechaPipe,
    EtiquetaPipe,
    BadgeClasePipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <app-page-header title="Marcar asistencia" subtitle="Registro de entrada y salida del dia">
        <button class="btn btn-ghost btn-sm" (click)="justifyOpen.set(true)">Justificar falta o tardanza</button>
      </app-page-header>

      <div class="clock-card">
        <div class="clock">
          <span class="date">{{ now() | fecha }}</span>
          <strong>{{ time() }}</strong>
          <span class="muted">{{ statusLabel() }}</span>
        </div>
        <div class="actions">
          <button class="btn btn-primary" [disabled]="saving()" (click)="punch('CHECK_IN')">Marcar entrada</button>
          <button class="btn btn-secondary" [disabled]="saving()" (click)="punch('CHECK_OUT')">Marcar salida</button>
        </div>
      </div>

      <app-card heading="Mis marcaciones recientes" [padded]="false">
        @if (loading()) {
          <app-state mode="loading" title="Cargando marcaciones"></app-state>
        } @else if (records().length === 0) {
          <app-state title="Sin marcaciones registradas" message="Su primera marcacion del dia aparecera aqui."></app-state>
        } @else {
          <div class="table-wrap">
            <table class="data">
              <thead>
                <tr>
                  <th>Fecha y hora</th>
                  <th>Tipo</th>
                  <th>Origen</th>
                  <th class="num">Tardanza</th>
                </tr>
              </thead>
              <tbody>
                @for (record of records(); track record.id) {
                  <tr>
                    <td class="nowrap">{{ record.timestamp | fecha: true }}</td>
                    <td><span [class]="record.type | badgeClase">{{ record.type | etiqueta }}</span></td>
                    <td class="muted">{{ record.source }}</td>
                    <td class="num" [class.late]="record.lateMinutes > 0">
                      {{ record.lateMinutes > 0 ? record.lateMinutes + ' min' : '-' }}
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </app-card>

      <app-card heading="Mis justificaciones" [padded]="false">
        @if (justifications().length === 0) {
          <app-state title="Sin justificaciones" message="Puede justificar una falta o tardanza adjuntando el respaldo."></app-state>
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
                @for (item of justifications(); track item.id) {
                  <tr>
                    <td class="nowrap">{{ item.date | fecha }}</td>
                    <td>{{ item.reason }}</td>
                    <td><span [class]="item.status | badgeClase">{{ item.status | etiqueta }}</span></td>
                    <td class="muted">{{ item.reviewNotes ?? '-' }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </app-card>
    </div>

    @if (justifyOpen()) {
      <app-modal title="Justificar falta o tardanza" (closed)="justifyOpen.set(false)">
        <div class="field">
          <label>Fecha *</label>
          <input type="date" [value]="justifyDate()" (change)="justifyDate.set($any($event.target).value)" />
        </div>
        <div class="field">
          <label>Motivo *</label>
          <textarea
            [value]="justifyReason()"
            (input)="justifyReason.set($any($event.target).value)"
            placeholder="Cita medica, tramite personal, emergencia familiar..."
          ></textarea>
        </div>
        <div class="field">
          <label>Enlace al respaldo (opcional)</label>
          <input
            [value]="justifyUrl()"
            (input)="justifyUrl.set($any($event.target).value)"
            placeholder="https://..."
          />
          <span class="hint">Adjunte el certificado o boleta subiendola al repositorio de la empresa.</span>
        </div>
        <div footer>
          <button class="btn btn-ghost" (click)="justifyOpen.set(false)">Cancelar</button>
          <button class="btn btn-primary" (click)="submitJustification()">Enviar</button>
        </div>
      </app-modal>
    }
  `,
  styles: [
    `
      .clock-card {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: space-between;
        gap: 22px;
        padding: 26px 28px;
        border-radius: var(--radius-lg);
        background: linear-gradient(120deg, var(--brand-800), var(--brand-600));
        color: #fff;
        box-shadow: var(--shadow-md);
      }
      .clock {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      .clock .date {
        font-size: 12.5px;
        opacity: 0.85;
        text-transform: capitalize;
      }
      .clock strong {
        font-size: 44px;
        color: #fff;
        letter-spacing: -0.03em;
        font-variant-numeric: tabular-nums;
      }
      .clock .muted {
        color: #cfeefb;
        font-size: 12.5px;
      }
      .actions {
        display: flex;
        gap: 10px;
        flex-wrap: wrap;
      }
      .late {
        color: var(--danger-700);
        font-weight: 600;
      }
      @media (max-width: 620px) {
        .actions {
          width: 100%;
        }
        .actions .btn {
          flex: 1;
        }
      }
    `,
  ],
})
export class AttendanceClockComponent implements OnInit, OnDestroy {
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);
  private readonly auth = inject(AuthService);

  readonly now = signal(new Date());
  readonly time = signal(formatTime(new Date()));
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly records = signal<AttendanceRecord[]>([]);
  readonly justifications = signal<AttendanceJustification[]>([]);

  readonly justifyOpen = signal(false);
  readonly justifyDate = signal(new Date().toISOString().slice(0, 10));
  readonly justifyReason = signal('');
  readonly justifyUrl = signal('');

  private timer?: ReturnType<typeof setInterval>;

  ngOnInit(): void {
    this.timer = setInterval(() => {
      const date = new Date();
      this.now.set(date);
      this.time.set(formatTime(date));
    }, 1000);
    this.load();
  }

  ngOnDestroy(): void {
    clearInterval(this.timer);
  }

  statusLabel(): string {
    const last = this.records()[0];
    if (!last) return 'Sin marcaciones hoy';
    return last.type === 'CHECK_IN'
      ? 'Jornada iniciada: no olvide marcar la salida'
      : 'Ultima marcacion: salida registrada';
  }

  load(): void {
    const employeeId = this.auth.employeeId();
    if (!employeeId) {
      this.loading.set(false);
      return;
    }
    this.api.list<AttendanceRecord>('/attendance', { employeeId, limit: 10 }).subscribe({
      next: (page) => {
        this.records.set(page.data);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
    this.api.list<AttendanceJustification>('/attendance/justifications', { limit: 10 }).subscribe({
      next: (page) => this.justifications.set(page.data),
      error: () => this.justifications.set([]),
    });
  }

  punch(type: 'CHECK_IN' | 'CHECK_OUT'): void {
    this.saving.set(true);
    const send = (coords?: GeolocationCoordinates) => {
      const path = type === 'CHECK_IN' ? '/attendance/check-in' : '/attendance/check-out';
      this.api
        .post<AttendanceRecord>(path, {
          latitude: coords?.latitude,
          longitude: coords?.longitude,
        })
        .subscribe({
          next: (response) => {
            this.saving.set(false);
            const late = response.data.lateMinutes;
            if (type === 'CHECK_IN' && late > 0) {
              this.toast.warn('Entrada registrada', `Con ${late} minutos de retraso`);
            } else {
              this.toast.success(type === 'CHECK_IN' ? 'Entrada registrada' : 'Salida registrada');
            }
            this.load();
          },
          error: (error) => {
            this.saving.set(false);
            this.toast.error('No se pudo registrar', apiErrorMessage(error));
          },
        });
    };

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => send(position.coords),
        () => send(),
        { timeout: 4000 },
      );
    } else {
      send();
    }
  }

  submitJustification(): void {
    if (this.justifyReason().trim().length < 5) {
      this.toast.warn('Describa el motivo', 'Escriba al menos 5 caracteres');
      return;
    }
    this.api
      .post('/attendance/justifications', {
        date: this.justifyDate(),
        reason: this.justifyReason(),
        attachmentUrl: this.justifyUrl() || undefined,
      })
      .subscribe({
        next: () => {
          this.justifyOpen.set(false);
          this.justifyReason.set('');
          this.justifyUrl.set('');
          this.toast.success('Justificacion enviada', 'Su supervisor la revisara');
          this.load();
        },
        error: (error) => this.toast.error('No se pudo enviar', apiErrorMessage(error)),
      });
  }
}

function formatTime(date: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(date.getHours())}:${p(date.getMinutes())}:${p(date.getSeconds())}`;
}
