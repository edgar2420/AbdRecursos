import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

/** Silueta de llama, reutilizada para el trazo de fondo y el relleno encendido. */
const FLAME_PATH =
  'M32 4C21 17 13 27 13 40a19 19 0 0 0 38 0c0-9-5-15-9-20 2 7-3 11-7 8-4-3-2-13-3-24z';

/**
 * El saldo de vacaciones como una llama: mientras mas dias disponibles, mas
 * alta y viva se ve; a medida que pide vacaciones (o se le acercan a
 * agotarse), se va apagando. Nunca es solo el color: siempre lleva el numero
 * y una etiqueta de texto al lado.
 */
@Component({
  selector: 'app-flame-gauge',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <article class="kpi flame-gauge" [class.critico]="estado() === 'critico'">
      <span class="kpi-label">{{ label }}</span>
      <div class="flame-row">
        <svg viewBox="0 0 64 80" class="flame-svg" role="img" [attr.aria-label]="label + ': ' + value + ' de ' + max">
          <defs>
            <linearGradient id="flameGrad" x1="0" y1="1" x2="0" y2="0">
              <stop offset="0%" stop-color="#c2410c" />
              <stop offset="55%" stop-color="#f97316" />
              <stop offset="100%" stop-color="#fde047" />
            </linearGradient>
            <linearGradient id="flameGradFrio" x1="0" y1="1" x2="0" y2="0">
              <stop offset="0%" stop-color="#475569" />
              <stop offset="100%" stop-color="#94a3b8" />
            </linearGradient>
          </defs>

          <!-- silueta de referencia: el 100% de la capacidad -->
          <path [attr.d]="FLAME_PATH" class="flame-track" />

          <g class="flame-fill" [style.transform]="'scaleY(' + porcentaje() + ')'">
            <g class="flame-flicker">
              <path [attr.d]="FLAME_PATH" [attr.fill]="estado() === 'critico' ? 'url(#flameGradFrio)' : 'url(#flameGrad)'" />
            </g>
          </g>
        </svg>

        <strong class="kpi-value">{{ value }}</strong>
      </div>
      <span class="kpi-hint" [class.flame-hint]="estado() === 'critico'">
        {{ estado() === 'critico' ? 'Se te esta por apagar la llama' : 'Saldo actual' }}
      </span>
    </article>
  `,
  styles: [
    `
      /* Angular encapsula los estilos por componente: .kpi definido en
         ui.components.ts no le llega a este. Se repite aca a proposito para
         que la forma sea identica (mismo padding, borde y sombra) y solo
         cambie el acento superior, a color fuego, para distinguirla sin
         romper la fila de KPIs. */
      .kpi {
        display: flex;
        flex-direction: column;
        gap: 4px;
        padding: 16px 18px;
        background: var(--surface);
        border: 1px solid var(--ink-200);
        border-radius: var(--radius-lg);
        box-shadow: var(--shadow-xs);
        border-top: 3px solid var(--brand-600);
      }
      .kpi-label {
        font-size: 11.5px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: var(--ink-500);
      }
      .kpi-value {
        font-size: 26px;
        font-weight: 700;
        letter-spacing: -0.03em;
        font-variant-numeric: tabular-nums;
      }
      .kpi-hint {
        font-size: 12px;
        color: var(--ink-500);
      }
      .kpi.flame-gauge {
        border-top-color: #f97316;
      }
      .kpi.flame-gauge.critico {
        border-top-color: #64748b;
      }
      .flame-row {
        display: flex;
        align-items: center;
        gap: 10px;
      }
      .flame-svg {
        width: 34px;
        height: 42px;
        flex: none;
      }
      .flame-track {
        fill: none;
        stroke: var(--ink-200);
        stroke-width: 2;
      }
      .flame-fill {
        transform-box: fill-box;
        transform-origin: bottom;
        transition: transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
      }
      .flame-flicker {
        transform-box: fill-box;
        transform-origin: center;
        animation: flame-flicker 2.4s ease-in-out infinite;
      }
      .critico .flame-flicker {
        animation-duration: 3.6s;
      }
      @keyframes flame-flicker {
        0%,
        100% {
          transform: scale(1) rotate(0deg);
        }
        25% {
          transform: scale(1.02, 0.98) rotate(-1deg);
        }
        50% {
          transform: scale(0.98, 1.03) rotate(1deg);
        }
        75% {
          transform: scale(1.01, 0.99) rotate(-0.5deg);
        }
      }
      .flame-hint {
        color: var(--warn-700);
        font-weight: 600;
      }
    `,
  ],
})
export class FlameGaugeComponent {
  @Input({ required: true }) label = '';
  @Input({ required: true }) value = 0;
  /** Referencia del 100%: normalmente los dias que le corresponden por gestion. */
  @Input({ required: true }) max = 1;

  readonly FLAME_PATH = FLAME_PATH;

  porcentaje(): number {
    if (this.max <= 0) return 0;
    // Piso del 6%: una brasa siempre visible en vez de desaparecer del todo.
    return Math.max(0.06, Math.min(1, this.value / this.max));
  }

  estado(): 'critico' | 'normal' {
    return this.porcentaje() <= 0.15 ? 'critico' : 'normal';
  }
}
