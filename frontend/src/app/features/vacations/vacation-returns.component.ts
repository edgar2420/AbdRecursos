import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import { CalendarEntry } from '../../core/models/api.models';
import { CardComponent } from '../../shared/components/ui.components';
import { FechaPipe, aFechaLocal } from '../../shared/pipes/format.pipes';
import { autoRefresh } from '../../shared/utils/auto-refresh';

interface Ausencia {
  requestId: string;
  nombre: string;
  area: string | null;
  inicio: Date;
  fin: Date;
  reincorporacion: Date;
  diasParaVolver: number;
  diasParaSalir: number;
  enCurso: boolean;
}

const DIA_MS = 24 * 60 * 60 * 1000;
const DIAS_ADELANTE = 30;

export function soloFecha(value: Date | string): Date {
  const d = aFechaLocal(value);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function siguienteDiaHabil(desde: Date): Date {
  const d = new Date(desde);
  d.setDate(d.getDate() + 1);
  while (d.getDay() === 0) d.setDate(d.getDate() + 1);
  return d;
}

export function diferenciaEnDias(desde: Date, hasta: Date): number {
  return Math.round((soloFecha(hasta).getTime() - soloFecha(desde).getTime()) / DIA_MS);
}

@Component({
  selector: 'app-vacation-returns',
  standalone: true,
  imports: [CommonModule, CardComponent, FechaPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (!cargando() && (enCurso().length > 0 || porSalir().length > 0)) {
      <app-card [heading]="esEmpleado() ? 'Sus vacaciones' : 'Ausencias y regresos'">
        <div class="contadores">
          <div class="contador">
            <strong>{{ enCurso().length }}</strong>
            <span>{{ esEmpleado() ? 'vacacion en curso' : 'de vacaciones ahora' }}</span>
          </div>
          <div class="contador" [class.alerta]="vuelvenPronto().length > 0">
            <strong>{{ vuelvenPronto().length }}</strong>
            <span>{{ esEmpleado() ? 'regreso esta semana' : 'se reincorporan en 7 dias' }}</span>
          </div>
          <div class="contador">
            <strong>{{ porSalir().length }}</strong>
            <span>{{ esEmpleado() ? 'vacacion por empezar' : 'salen proximamente' }}</span>
          </div>
        </div>

        @if (enCurso().length > 0) {
          <h3 class="bloque">{{ esEmpleado() ? 'Ahora' : 'De vacaciones ahora' }}</h3>
          <ul class="lista">
            @for (a of enCurso(); track a.requestId) {
              <li>
                <div class="quien">
                  <span class="strong">{{ esEmpleado() ? 'Sus vacaciones' : a.nombre }}</span>
                  @if (!esEmpleado() && a.area) {
                    <span class="muted">{{ a.area }}</span>
                  }
                </div>
                <div class="cuando">
                  <span class="muted">
                    {{ esEmpleado() ? 'Se reincorpora el' : 'Vuelve el' }}
                    {{ a.reincorporacion | fecha }}
                  </span>
                  <span [class]="badgeRegreso(a)">{{ textoRegreso(a) }}</span>
                </div>
              </li>
            }
          </ul>
        }

        @if (porSalir().length > 0) {
          <h3 class="bloque">{{ esEmpleado() ? 'Por empezar' : 'Salen proximamente' }}</h3>
          <ul class="lista">
            @for (a of porSalir(); track a.requestId) {
              <li>
                <div class="quien">
                  <span class="strong">{{ esEmpleado() ? 'Sus vacaciones' : a.nombre }}</span>
                  @if (!esEmpleado() && a.area) {
                    <span class="muted">{{ a.area }}</span>
                  }
                </div>
                <div class="cuando">
                  <span class="muted">
                    {{ a.inicio | fecha }} al {{ a.fin | fecha }} · vuelve el {{ a.reincorporacion | fecha }}
                  </span>
                  <span class="badge badge-info">{{ textoSalida(a) }}</span>
                </div>
              </li>
            }
          </ul>
        }
      </app-card>
    }
  `,
  styles: [
    `
      .contadores {
        display: flex;
        flex-wrap: wrap;
        gap: 26px;
        padding-bottom: 12px;
        border-bottom: 1px solid var(--ink-100);
      }
      .contador {
        display: flex;
        flex-direction: column;
        gap: 1px;
      }
      .contador strong {
        font-size: 24px;
        line-height: 1.1;
        font-variant-numeric: tabular-nums;
      }
      .contador span {
        font-size: 11.5px;
        color: var(--ink-500);
      }
      .contador.alerta strong {
        color: var(--warn-700);
      }
      .bloque {
        margin: 14px 0 6px;
        font-size: 11.5px;
        font-weight: 600;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        color: var(--ink-500);
      }
      .lista {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .lista li {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 14px;
        flex-wrap: wrap;
        font-size: 12.5px;
        padding-bottom: 8px;
        border-bottom: 1px solid var(--ink-100);
      }
      .lista li:last-child {
        border-bottom: 0;
        padding-bottom: 0;
      }
      .quien {
        display: flex;
        flex-direction: column;
        gap: 1px;
      }
      .quien .muted {
        font-size: 11px;
      }
      .cuando {
        display: flex;
        align-items: center;
        gap: 10px;
      }
    `,
  ],
})
export class VacationReturnsComponent implements OnInit, OnDestroy {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);

  readonly cargando = signal(true);
  readonly ausencias = signal<Ausencia[]>([]);

  private detenerRefresco?: () => void;

  ngOnInit(): void {
    this.cargar();
    this.detenerRefresco = autoRefresh(() => this.cargar());
  }

  ngOnDestroy(): void {
    this.detenerRefresco?.();
  }

  esEmpleado(): boolean {
    return this.auth.role() === 'EMPLOYEE';
  }

  enCurso(): Ausencia[] {
    return this.ausencias().filter((a) => a.enCurso);
  }

  vuelvenPronto(): Ausencia[] {
    return this.enCurso().filter((a) => a.diasParaVolver <= 7);
  }

  porSalir(): Ausencia[] {
    return this.ausencias().filter((a) => !a.enCurso);
  }

  textoRegreso(a: Ausencia): string {
    if (a.diasParaVolver <= 0) return this.esEmpleado() ? 'Vuelve hoy' : 'Se reincorpora hoy';
    if (a.diasParaVolver === 1) return 'Vuelve manana';
    return `Faltan ${a.diasParaVolver} dias`;
  }

  badgeRegreso(a: Ausencia): string {
    if (a.diasParaVolver <= 1) return 'badge badge-warn';
    if (a.diasParaVolver <= 7) return 'badge badge-info';
    return 'badge badge-neutral';
  }

  textoSalida(a: Ausencia): string {
    if (a.diasParaSalir <= 0) return 'Empieza hoy';
    if (a.diasParaSalir === 1) return 'Empieza manana';
    return `En ${a.diasParaSalir} dias`;
  }

  private cargar(): void {
    const hoy = soloFecha(new Date());
    const hasta = new Date(hoy);
    hasta.setDate(hasta.getDate() + DIAS_ADELANTE);

    this.api
      .get<CalendarEntry[]>('/vacations/calendar', {
        from: hoy.toISOString().slice(0, 10),
        to: hasta.toISOString().slice(0, 10),
      })
      .subscribe({
        next: (response) => {
          this.ausencias.set(this.aAusencias(response.data ?? [], hoy));
          this.cargando.set(false);
        },
        error: () => {
          this.ausencias.set([]);
          this.cargando.set(false);
        },
      });
  }

  private aAusencias(entradas: CalendarEntry[], hoy: Date): Ausencia[] {
    return entradas
      .filter((e) => e.status === 'APPROVED')
      .map((e) => {
        const inicio = soloFecha(e.startDate);
        const fin = soloFecha(e.endDate);
        const reincorporacion = siguienteDiaHabil(fin);
        return {
          requestId: e.requestId,
          nombre: e.employeeName,
          area: e.departmentName,
          inicio,
          fin,
          reincorporacion,
          diasParaVolver: diferenciaEnDias(hoy, reincorporacion),
          diasParaSalir: diferenciaEnDias(hoy, inicio),
          enCurso: inicio <= hoy && hoy <= fin,
        };
      })
      .filter((a) => a.enCurso || a.diasParaSalir >= 0)
      .sort((a, b) =>
        a.enCurso === b.enCurso
          ? (a.enCurso ? a.diasParaVolver - b.diasParaVolver : a.diasParaSalir - b.diasParaSalir)
          : Number(b.enCurso) - Number(a.enCurso),
      );
  }
}
