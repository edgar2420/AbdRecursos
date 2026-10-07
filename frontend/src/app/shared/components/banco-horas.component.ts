import { ChangeDetectionStrategy, Component, EventEmitter, Input, OnChanges, Output, inject, signal } from '@angular/core';
import { ApiService } from '../../core/services/api.service';
import { ToastService } from '../../core/services/toast.service';
import { apiErrorMessage } from '../../core/interceptors/auth.interceptor';
import { StateComponent } from './ui.components';
import { FechaPipe } from '../pipes/format.pipes';

export interface MovimientoBanco {
  fecha: string;
  tipo: 'HORAS_EXTRAS' | 'SALIDA' | 'AJUSTE';
  minutos: number;
  detalle: string;
  referencia: string | null;
  estimado: boolean;
  saldo: number;
}

export interface DetalleBanco {
  saldoMinutos: number;
  aFavorMinutos: number;
  usadoMinutos: number;
  ajustesMinutos: number;
  movimientos: MovimientoBanco[];
}

/** "+2 h 30 min", "-45 min", "0 min" */
export function duracionConSigno(minutos: number): string {
  const abs = Math.abs(Math.round(minutos));
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  const texto = h ? (m ? `${h} h ${m} min` : `${h} h`) : `${m} min`;
  if (minutos > 0) return `+${texto}`;
  if (minutos < 0) return `-${texto}`;
  return texto;
}

const TIPO: Record<MovimientoBanco['tipo'], string> = {
  HORAS_EXTRAS: 'Horas extra',
  SALIDA: 'Salida particular',
  AJUSTE: 'Ajuste RRHH',
};

/** Banco de horas de un empleado: saldo, desglose, movimientos y (para RRHH) ajustes manuales. */
@Component({
  selector: 'app-banco-horas',
  standalone: true,
  imports: [StateComponent, FechaPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (cargando()) {
      <app-state mode="loading" title="Calculando banco de horas"></app-state>
    } @else {
    @if (datos(); as d) {
      <div class="saldo" [class.favor]="d.saldoMinutos > 0" [class.debe]="d.saldoMinutos < 0">
        <span class="saldo-etiqueta">
          {{ d.saldoMinutos > 0 ? 'Horas a favor' : d.saldoMinutos < 0 ? 'Debe horas' : 'Saldo al dia' }}
        </span>
        <strong class="saldo-valor">{{ d.saldoMinutos < 0 ? duracion(-d.saldoMinutos) : duracion(d.saldoMinutos) }}</strong>
        <div class="desglose">
          <span>Horas extra con papeleta <b>{{ duracion(d.aFavorMinutos) }}</b></span>
          <span>Salidas particulares <b>{{ duracion(-d.usadoMinutos) }}</b></span>
          @if (d.ajustesMinutos) {
            <span>Ajustes de RRHH <b>{{ duracion(d.ajustesMinutos) }}</b></span>
          }
        </div>
      </div>
      <p class="regla">
        Suman las papeletas de horas extra aprobadas y restan las de salida particular aprobadas. Las salidas oficiales y medicas no descuentan.
      </p>

      @if (puedeAjustar) {
        @if (ajustando()) {
          <form class="ajuste" (submit)="guardarAjuste($event)">
            <div class="ajuste-tipo" role="group" aria-label="Tipo de ajuste">
              <button type="button" [attr.aria-pressed]="signo() === 1" (click)="signo.set(1)">Sumar horas</button>
              <button type="button" [attr.aria-pressed]="signo() === -1" (click)="signo.set(-1)">Descontar horas</button>
            </div>
            <label>Horas <input type="number" min="0" max="999" [value]="horas()" (input)="horas.set(+$any($event.target).value)" /></label>
            <label>Minutos <input type="number" min="0" max="59" [value]="minutos()" (input)="minutos.set(+$any($event.target).value)" /></label>
            <label class="motivo">Motivo <input type="text" minlength="5" maxlength="300" placeholder="Ej.: se pagaron 10 h en la boleta de octubre" (input)="motivo.set($any($event.target).value)" /></label>
            <div class="ajuste-acciones">
              <button type="submit" class="btn btn-primary btn-sm" [disabled]="guardando()">Guardar ajuste</button>
              <button type="button" class="btn btn-ghost btn-sm" (click)="ajustando.set(false)">Cancelar</button>
            </div>
          </form>
        } @else {
          <button type="button" class="btn btn-ghost btn-sm" (click)="abrirAjuste()">Ajustar saldo</button>
        }
      }

      @if (d.movimientos.length === 0) {
        <app-state title="Sin movimientos" message="Todavia no hay papeletas aprobadas que afecten el banco de horas."></app-state>
      } @else {
        <div class="table-wrap">
          <table class="data movimientos">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Movimiento</th>
                <th>Detalle</th>
                <th class="num">Horas</th>
                <th class="num">Saldo</th>
              </tr>
            </thead>
            <tbody>
              @for (m of d.movimientos; track $index) {
                <tr>
                  <td class="nowrap">{{ m.fecha | fecha }}</td>
                  <td class="nowrap">
                    <span class="tipo" [class]="'tipo tipo-' + m.tipo">{{ tipo(m.tipo) }}</span>
                    @if (m.referencia) {
                      <div class="muted text-sm">{{ m.referencia }}</div>
                    }
                  </td>
                  <td>
                    {{ m.detalle || '—' }}
                    @if (m.estimado) {
                      <span class="estimado" title="La papeleta no tiene hora de retorno: se estimo con el tiempo solicitado">estimado</span>
                    }
                  </td>
                  <td class="num" [class.positivo]="m.minutos > 0" [class.negativo]="m.minutos < 0">{{ duracion(m.minutos) }}</td>
                  <td class="num strong">{{ duracion(m.saldo) }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    }
    }
  `,
  styleUrl: './banco-horas.component.scss',
})
export class BancoHorasComponent implements OnChanges {
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);

  @Input({ required: true }) employeeId = '';
  @Input() puedeAjustar = false;
  @Output() cambiado = new EventEmitter<void>();

  readonly cargando = signal(true);
  readonly datos = signal<DetalleBanco | null>(null);
  readonly ajustando = signal(false);
  readonly guardando = signal(false);
  readonly signo = signal<1 | -1>(-1);
  readonly horas = signal(0);
  readonly minutos = signal(0);
  readonly motivo = signal('');
  readonly duracion = duracionConSigno;

  ngOnChanges(): void {
    if (this.employeeId) this.cargar();
  }

  tipo(t: MovimientoBanco['tipo']): string {
    return TIPO[t];
  }

  abrirAjuste(): void {
    this.signo.set(-1);
    this.horas.set(0);
    this.minutos.set(0);
    this.motivo.set('');
    this.ajustando.set(true);
  }

  guardarAjuste(evento: Event): void {
    evento.preventDefault();
    const total = (this.horas() || 0) * 60 + (this.minutos() || 0);
    if (total <= 0 || this.motivo().trim().length < 5) {
      this.toast.warn('Faltan datos', 'Indique las horas o minutos y un motivo de al menos 5 caracteres');
      return;
    }
    this.guardando.set(true);
    this.api
      .post(`/banco-horas/${this.employeeId}/ajustes`, { minutos: total * this.signo(), motivo: this.motivo().trim() })
      .subscribe({
        next: () => {
          this.guardando.set(false);
          this.ajustando.set(false);
          this.toast.success('Ajuste registrado');
          this.cargar();
          this.cambiado.emit();
        },
        error: (err) => {
          this.guardando.set(false);
          this.toast.error('No se pudo registrar', apiErrorMessage(err));
        },
      });
  }

  private cargar(): void {
    this.cargando.set(true);
    this.api.get<DetalleBanco>(`/banco-horas/${this.employeeId}`).subscribe({
      next: (r) => {
        this.datos.set(r.data);
        this.cargando.set(false);
      },
      error: (err) => {
        this.cargando.set(false);
        this.toast.error('No se pudo cargar el banco de horas', apiErrorMessage(err));
      },
    });
  }
}
