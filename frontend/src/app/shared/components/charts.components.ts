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
  styleUrl: './bar-list.component.scss',
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
  styleUrl: './stacked-bar.component.scss',
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
  styleUrl: './donut-chart.component.scss',
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
  styleUrl: './meter.component.scss',
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
