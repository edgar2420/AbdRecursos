import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

const FLAME_PATH =
  'M32 4C21 17 13 27 13 40a19 19 0 0 0 38 0c0-9-5-15-9-20 2 7-3 11-7 8-4-3-2-13-3-24z';

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
  styleUrl: './flame-gauge.component.scss',
})
export class FlameGaugeComponent {
  @Input({ required: true }) label = '';
  @Input({ required: true }) value = 0;
  @Input({ required: true }) max = 1;

  readonly FLAME_PATH = FLAME_PATH;

  porcentaje(): number {
    if (this.max <= 0) return 0;
    return Math.max(0.06, Math.min(1, this.value / this.max));
  }

  estado(): 'critico' | 'normal' {
    return this.porcentaje() <= 0.15 ? 'critico' : 'normal';
  }
}
