import { ChangeDetectionStrategy, Component, EventEmitter, Input, OnInit, Output, inject, signal } from '@angular/core';
import { ApiService } from '../../core/services/api.service';
import { ToastService } from '../../core/services/toast.service';
import { apiErrorMessage } from '../../core/interceptors/auth.interceptor';
import { Employee } from '../../core/models/api.models';
import { ModalComponent } from '../../shared/components/ui.components';
import { FechaPipe } from '../../shared/pipes/format.pipes';

export const MOTIVOS_BAJA: { valor: string; etiqueta: string }[] = [
  { valor: 'RENUNCIA', etiqueta: 'Renuncia voluntaria' },
  { valor: 'FIN_CONTRATO', etiqueta: 'Fin de contrato' },
  { valor: 'RETIRO_EMPRESA', etiqueta: 'Retiro por decision de la empresa' },
  { valor: 'DESPIDO_CAUSA', etiqueta: 'Despido con causa justificada' },
  { valor: 'MUTUO_ACUERDO', etiqueta: 'Mutuo acuerdo' },
  { valor: 'ABANDONO', etiqueta: 'Abandono de trabajo' },
  { valor: 'JUBILACION', etiqueta: 'Jubilacion' },
  { valor: 'FALLECIMIENTO', etiqueta: 'Fallecimiento' },
  { valor: 'OTRO', etiqueta: 'Otro motivo' },
];

export function etiquetaMotivoBaja(valor: string | null | undefined): string {
  return MOTIVOS_BAJA.find((m) => m.valor === valor)?.etiqueta ?? 'Motivo no registrado';
}

/** "AAAA-MM-DD" del dia local (toISOString daria el dia siguiente por la noche en Bolivia). */
function hoyLocal(desplazarDias = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + desplazarDias);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

interface Resultado {
  usuarioAfectado: boolean;
}

/** Dar de baja: motivo obligatorio, fecha de retiro y lo que pasa con el empleado. */
@Component({
  selector: 'app-baja-empleado',
  standalone: true,
  imports: [ModalComponent, FechaPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal [title]="'Dar de baja a ' + empleado.fullName" (closed)="cerrado.emit()">
      <form class="baja" id="form-baja" (submit)="guardar($event)">
        <div class="field">
          <label for="baja-motivo">Motivo de la baja *</label>
          <select id="baja-motivo" required [value]="motivo()" (change)="motivo.set($any($event.target).value)">
            <option value="" disabled>Elija un motivo</option>
            @for (m of motivos; track m.valor) {
              <option [value]="m.valor">{{ m.etiqueta }}</option>
            }
          </select>
        </div>
        <div class="field">
          <label for="baja-fecha">Ultimo dia de trabajo *</label>
          <input id="baja-fecha" type="date" required [min]="minimo" [max]="maximo" [value]="fecha()" (change)="fecha.set($any($event.target).value)" />
          <span class="hint">Ingreso: {{ empleado.hireDate | fecha }}. Puede programarla hasta 31 dias adelante.</span>
        </div>
        <div class="field">
          <label for="baja-notas">Notas</label>
          <textarea id="baja-notas" maxlength="300" rows="3" placeholder="Ej.: presento su carta de renuncia el 01/10" (input)="notas.set($any($event.target).value)"></textarea>
        </div>

        <div class="efectos">
          <b>Al confirmar:</b>
          <ul>
            <li>Pasa a la lista <b>De baja</b> de Empleados; deja de contarse en asistencia y planillas.</li>
            <li>Si tiene usuario en el sistema, se <b>bloquea</b> y se cierran sus sesiones.</li>
            <li>Se conserva todo: historial, boletas, vacaciones y marcaciones.</li>
            <li>Se puede revertir con <b>Reactivar</b> desde su ficha.</li>
          </ul>
        </div>
      </form>
      <div footer>
        <button type="button" class="btn btn-ghost" (click)="cerrado.emit()">Cancelar</button>
        <button type="submit" form="form-baja" class="btn btn-danger" [disabled]="guardando() || !motivo() || !fecha()">
          {{ guardando() ? 'Guardando...' : 'Confirmar baja' }}
        </button>
      </div>
    </app-modal>
  `,
  styleUrl: './baja-empleado.component.scss',
})
export class BajaEmpleadoComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);

  @Input({ required: true }) empleado!: Employee;
  @Output() cerrado = new EventEmitter<void>();
  @Output() hecho = new EventEmitter<void>();

  readonly motivos = MOTIVOS_BAJA;
  readonly motivo = signal('');
  readonly fecha = signal(hoyLocal());
  readonly notas = signal('');
  readonly guardando = signal(false);
  readonly maximo = hoyLocal(31);
  minimo = '';

  ngOnInit(): void {
    this.minimo = this.empleado.hireDate.slice(0, 10);
  }

  guardar(evento: Event): void {
    evento.preventDefault();
    if (!this.motivo() || !this.fecha()) return;
    this.guardando.set(true);
    this.api
      .delete<{ data: Resultado }>(`/employees/${this.empleado.id}`, {
        terminationDate: this.fecha(),
        motivo: this.motivo(),
        notes: this.notas().trim() || undefined,
      })
      .subscribe({
        next: (r) => {
          this.guardando.set(false);
          this.toast.success(
            `${this.empleado.fullName} dado de baja`,
            r.data?.usuarioAfectado ? 'Su usuario quedo bloqueado' : 'Lo encuentra en Empleados > De baja',
          );
          this.hecho.emit();
        },
        error: (err) => {
          this.guardando.set(false);
          this.toast.error('No se pudo dar de baja', apiErrorMessage(err));
        },
      });
  }
}

/** Reactivar (reingreso): explica el efecto y deja una nota en el historial. */
@Component({
  selector: 'app-reactivar-empleado',
  standalone: true,
  imports: [ModalComponent, FechaPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal [title]="'Reactivar a ' + empleado.fullName" (closed)="cerrado.emit()">
      <form class="baja" id="form-reactivar" (submit)="guardar($event)">
        <p class="m-0">
          Fue dado de baja el <b>{{ empleado.terminationDate | fecha }}</b> ({{ motivo }}).
          Al reactivarlo vuelve a la lista de activos y, si tiene usuario, se habilita de nuevo.
          La fecha de ingreso no cambia; si es un reingreso con nueva antiguedad, actualicela en <b>Editar</b>.
        </p>
        <div class="field">
          <label for="reactivar-notas">Notas</label>
          <textarea id="reactivar-notas" maxlength="300" rows="3" placeholder="Ej.: se registro la baja por error / reingreso el 01/11" (input)="notas.set($any($event.target).value)"></textarea>
        </div>
      </form>
      <div footer>
        <button type="button" class="btn btn-ghost" (click)="cerrado.emit()">Cancelar</button>
        <button type="submit" form="form-reactivar" class="btn btn-primary" [disabled]="guardando()">
          {{ guardando() ? 'Guardando...' : 'Reactivar' }}
        </button>
      </div>
    </app-modal>
  `,
  styleUrl: './baja-empleado.component.scss',
})
export class ReactivarEmpleadoComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);

  @Input({ required: true }) empleado!: Employee;
  @Output() cerrado = new EventEmitter<void>();
  @Output() hecho = new EventEmitter<void>();

  readonly notas = signal('');
  readonly guardando = signal(false);
  motivo = '';

  ngOnInit(): void {
    this.motivo = etiquetaMotivoBaja(this.empleado.terminationReason);
  }

  guardar(evento: Event): void {
    evento.preventDefault();
    this.guardando.set(true);
    this.api.post<Resultado>(`/employees/${this.empleado.id}/reactivate`, { notes: this.notas().trim() || undefined }).subscribe({
      next: (r) => {
        this.guardando.set(false);
        this.toast.success(`${this.empleado.fullName} reactivado`, r.data?.usuarioAfectado ? 'Su usuario se habilito de nuevo' : undefined);
        this.hecho.emit();
      },
      error: (err) => {
        this.guardando.set(false);
        this.toast.error('No se pudo reactivar', apiErrorMessage(err));
      },
    });
  }
}
