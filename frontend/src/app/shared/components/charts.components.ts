import { ChangeDetectionStrategy, Component, Input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

export const PALETA_CATEGORICA = [
  '#2a78d6',
  '#eb6834',
  '#1baf7a',
  '#eda100',
  '#e87ba4',
  '#008300',
  '#4a3aa7',
  '#e34948',
] as const;

export interface BarListRow {
  label: string;
  value: number;
}

@Component({
  selector: 'app-bar-list',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="bar-list">
      @for (row of filas(); track row.label) {
        <div class="bar-row" [attr.title]="row.label + ': ' + row.value">
          <span class="bar-label">{{ row.label }}</span>
          <div class="bar-track">
            <div class="bar-fill" [style.width.%]="porcentaje(row.value)"></div>
          </div>
          <span class="bar-value">{{ row.value }}</span>
        </div>
      }
    </div>
  `,
  styles: [
    `
      .bar-list {
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      .bar-row {
        display: grid;
        grid-template-columns: 132px 1fr 34px;
        align-items: center;
        gap: 10px;
        font-size: 12.5px;
      }
      .bar-label {
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        color: var(--ink-700);
      }
      .bar-track {
        height: 10px;
        background: var(--ink-100);
        border-radius: 999px;
        overflow: hidden;
      }
      .bar-fill {
        height: 100%;
        border-radius: 999px;
        background: linear-gradient(90deg, var(--brand-700), var(--brand-500));
        transition: width 0.4s ease;
      }
      .bar-value {
        text-align: right;
        font-weight: 600;
        font-variant-numeric: tabular-nums;
        color: var(--ink-900);
      }
    `,
  ],
})
export class BarListComponent {
  @Input({ required: true }) set rows(value: BarListRow[]) {
    const ordenadas = [...value].sort((a, b) => b.value - a.value);
    const limite = 7;
    if (ordenadas.length <= limite + 1) {
      this.filas.set(ordenadas);
      return;
    }
    const visibles = ordenadas.slice(0, limite);
    const resto = ordenadas.slice(limite).reduce((sum, r) => sum + r.value, 0);
    this.filas.set([...visibles, { label: 'Otros', value: resto }]);
  }

  filas = signal<BarListRow[]>([]);

  porcentaje(value: number): number {
    const max = Math.max(...this.filas().map((r) => r.value), 1);
    return Math.round((value / max) * 100);
  }
}

export interface StackedSegment {
  label: string;
  value: number;
}

@Component({
  selector: 'app-stacked-bar',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="stacked">
      <div class="stacked-track">
        @for (seg of segmentos(); track seg.label) {
          <div
            class="stacked-fill"
            [style.width.%]="porcentaje(seg.value)"
            [style.background]="seg.color"
            [attr.title]="seg.label + ': ' + seg.value + ' (' + porcentaje(seg.value) + '%)'"
          ></div>
        }
      </div>
      <div class="legend">
        @for (seg of segmentos(); track seg.label) {
          <div class="legend-item">
            <span class="dot" [style.background]="seg.color"></span>
            <span class="legend-label">{{ seg.label }}</span>
            <span class="legend-value">{{ seg.value }} · {{ porcentaje(seg.value) }}%</span>
          </div>
        }
      </div>
    </div>
  `,
  styles: [
    `
      .stacked-track {
        display: flex;
        height: 28px;
        border-radius: 8px;
        overflow: hidden;
        background: var(--ink-100);
        gap: 2px;
      }
      .stacked-fill {
        height: 100%;
        min-width: 3px;
        transition: width 0.4s ease;
      }
      .legend {
        display: flex;
        flex-wrap: wrap;
        gap: 12px 18px;
        margin-top: 14px;
      }
      .legend-item {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 12.5px;
      }
      .dot {
        width: 10px;
        height: 10px;
        border-radius: 999px;
        flex: none;
      }
      .legend-label {
        color: var(--ink-700);
      }
      .legend-value {
        font-weight: 600;
        color: var(--ink-900);
        font-variant-numeric: tabular-nums;
      }
    `,
  ],
})
export class StackedBarComponent {
  @Input({ required: true }) set segments(value: StackedSegment[]) {
    this.segmentos.set(
      value.filter((s) => s.value > 0).map((s, i) => ({ ...s, color: PALETA_CATEGORICA[i % PALETA_CATEGORICA.length] })),
    );
  }

  segmentos = signal<(StackedSegment & { color: string })[]>([]);
  private total = 0;

  porcentaje(value: number): number {
    if (!this.total) this.total = this.segmentos().reduce((sum, s) => sum + s.value, 0) || 1;
    return Math.round((value / this.total) * 100);
  }
}

export interface DonutSlice {
  label: string;
  value: number;
}

@Component({
  selector: 'app-donut-chart',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="donut-wrap">
      <svg viewBox="0 0 120 120" class="donut" role="img" [attr.aria-label]="centerLabel + ': ' + total()">
        <circle cx="60" cy="60" r="45" fill="none" stroke="var(--ink-100)" stroke-width="18" />
        <g transform="rotate(-90 60 60)">
          @for (slice of slices(); track slice.label) {
            <circle
              cx="60"
              cy="60"
              r="45"
              fill="none"
              [attr.stroke]="slice.color"
              stroke-width="18"
              [attr.stroke-dasharray]="slice.dash"
              [attr.stroke-dashoffset]="slice.offset"
              stroke-linecap="butt"
              class="donut-slice"
              [class.hovered]="hovered() === slice.label"
              [class.dimmed]="hovered() !== null && hovered() !== slice.label"
              [style.--tx.px]="slice.tx"
              [style.--ty.px]="slice.ty"
              (mouseenter)="hovered.set(slice.label)"
              (mouseleave)="hovered.set(null)"
            >
              <title>{{ slice.label }}: {{ slice.value }} ({{ slice.percent }}%)</title>
            </circle>
          }
        </g>
        <text x="60" y="57" text-anchor="middle" class="donut-total">{{ total() }}</text>
        <text x="60" y="72" text-anchor="middle" class="donut-caption">{{ centerLabel }}</text>
      </svg>
      <div class="legend">
        @for (slice of slices(); track slice.label) {
          <div
            class="legend-item"
            [class.hovered]="hovered() === slice.label"
            [class.dimmed]="hovered() !== null && hovered() !== slice.label"
            (mouseenter)="hovered.set(slice.label)"
            (mouseleave)="hovered.set(null)"
          >
            <span class="dot" [style.background]="slice.color"></span>
            <span class="legend-label">{{ slice.label }}</span>
            <span class="legend-value">{{ slice.value }} · {{ slice.percent }}%</span>
          </div>
        }
      </div>
    </div>
  `,
  styles: [
    `
      .donut-wrap {
        display: flex;
        align-items: center;
        gap: 22px;
        flex-wrap: wrap;
      }
      .donut {
        width: 148px;
        height: 148px;
        flex: none;
      }
      .donut-slice {
        transition: stroke-dasharray 0.4s ease, transform 0.15s ease, opacity 0.15s ease, stroke-width 0.15s ease;
        transform-box: fill-box;
        transform-origin: center;
        cursor: pointer;
      }
      .donut-slice.hovered {
        transform: translate(var(--tx), var(--ty));
        stroke-width: 20;
      }
      .donut-slice.dimmed {
        opacity: 0.35;
      }
      .legend-item {
        transition: opacity 0.15s ease, background 0.15s ease;
        border-radius: 6px;
        padding: 3px 4px;
        margin: -3px -4px;
        cursor: default;
      }
      .legend-item.hovered {
        background: var(--ink-100);
      }
      .legend-item.dimmed {
        opacity: 0.45;
      }
      .donut-total {
        font-size: 22px;
        font-weight: 700;
        fill: var(--ink-900);
      }
      .donut-caption {
        font-size: 8.5px;
        fill: var(--ink-500);
        text-transform: uppercase;
        letter-spacing: 0.04em;
      }
      .legend {
        display: flex;
        flex-direction: column;
        gap: 8px;
        min-width: 160px;
        flex: 1;
      }
      .legend-item {
        display: flex;
        align-items: center;
        gap: 7px;
        font-size: 12.5px;
      }
      .dot {
        width: 10px;
        height: 10px;
        border-radius: 999px;
        flex: none;
      }
      .legend-label {
        color: var(--ink-700);
        flex: 1;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .legend-value {
        font-weight: 600;
        color: var(--ink-900);
        font-variant-numeric: tabular-nums;
        white-space: nowrap;
      }
    `,
  ],
})
export class DonutChartComponent {
  @Input() centerLabel = 'Total';

  @Input({ required: true }) set data(value: DonutSlice[]) {
    const ordenadas = [...value].filter((s) => s.value > 0).sort((a, b) => b.value - a.value);
    const limite = 8;
    const plegadas =
      ordenadas.length <= limite
        ? ordenadas
        : [...ordenadas.slice(0, limite - 1), { label: 'Otros', value: ordenadas.slice(limite - 1).reduce((s, r) => s + r.value, 0) }];

    const totalValor = plegadas.reduce((s, r) => s + r.value, 0) || 1;
    const circunferencia = 2 * Math.PI * 45;
    let acumulado = 0;
    this.total.set(totalValor);
    this.slices.set(
      plegadas.map((s, i) => {
        const percent = Math.round((s.value / totalValor) * 100);
        const largo = (s.value / totalValor) * circunferencia;
        const dash = `${largo} ${circunferencia - largo}`;
        const offset = -acumulado;
        const anguloMedioRad = ((acumulado + largo / 2) / circunferencia) * 2 * Math.PI;
        acumulado += largo;
        return {
          ...s,
          percent,
          dash,
          offset,
          tx: Math.round(Math.cos(anguloMedioRad) * 6 * 100) / 100,
          ty: Math.round(Math.sin(anguloMedioRad) * 6 * 100) / 100,
          color: PALETA_CATEGORICA[i % PALETA_CATEGORICA.length],
        };
      }),
    );
  }

  readonly hovered = signal<string | null>(null);
  total = signal(0);
  slices = signal<(DonutSlice & { percent: number; dash: string; offset: number; tx: number; ty: number; color: string })[]>([]);
}

@Component({
  selector: 'app-meter',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="meter">
      <div class="meter-head">
        <span class="meter-label">{{ label }}</span>
        <span class="meter-state" [style.color]="estadoColor()">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
            @if (estado() === 'good') {
              <path d="M20 6 9 17l-5-5" />
            } @else if (estado() === 'warning') {
              <path d="M12 9v4M12 17h.01M10.3 3.86 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.86a2 2 0 0 0-3.4 0Z" />
            } @else {
              <circle cx="12" cy="12" r="9" />
              <path d="M12 8v5M12 16h.01" />
            }
          </svg>
          {{ estadoTexto() }}
        </span>
      </div>
      <div class="meter-value">{{ value }}<span class="meter-unit">{{ unit }}</span></div>
      <div class="meter-track">
        <div class="meter-fill" [style.width.%]="porcentaje()" [style.background]="estadoColor()"></div>
      </div>
      @if (hint) {
        <p class="meter-hint">{{ hint }}</p>
      }
    </div>
  `,
  styles: [
    `
      .meter {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .meter-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
      }
      .meter-label {
        font-size: 12px;
        font-weight: 600;
        color: var(--ink-500);
        text-transform: uppercase;
        letter-spacing: 0.03em;
      }
      .meter-state {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        font-size: 11.5px;
        font-weight: 600;
      }
      .meter-value {
        font-size: 26px;
        font-weight: 700;
        color: var(--ink-900);
      }
      .meter-unit {
        font-size: 14px;
        font-weight: 600;
        color: var(--ink-500);
        margin-left: 2px;
      }
      .meter-track {
        height: 8px;
        background: var(--ink-100);
        border-radius: 999px;
        overflow: hidden;
      }
      .meter-fill {
        height: 100%;
        border-radius: 999px;
        transition: width 0.4s ease;
      }
      .meter-hint {
        margin: 0;
        font-size: 11.5px;
        color: var(--ink-500);
      }
    `,
  ],
})
export class MeterComponent {
  @Input({ required: true }) label = '';
  @Input({ required: true }) value = 0;
  @Input() unit = '%';
  @Input() hint?: string;
  @Input() warningAt = 5;
  @Input() criticalAt = 10;
  @Input() scaleMax = 20;

  estado(): 'good' | 'warning' | 'critical' {
    if (this.value >= this.criticalAt) return 'critical';
    if (this.value >= this.warningAt) return 'warning';
    return 'good';
  }

  estadoTexto(): string {
    return { good: 'En rango', warning: 'Atencion', critical: 'Critico' }[this.estado()];
  }

  estadoColor(): string {
    return { good: '#0ca30c', warning: '#c98500', critical: '#d03b3b' }[this.estado()];
  }

  porcentaje(): number {
    return Math.min(100, Math.round((this.value / this.scaleMax) * 100));
  }
}
