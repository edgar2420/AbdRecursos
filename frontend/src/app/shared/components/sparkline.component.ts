import { ChangeDetectionStrategy, Component, Input, computed, signal } from '@angular/core';

const W = 96;
const H = 28;
const PAD = 3;

@Component({
  selector: 'app-sparkline',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg [attr.width]="ancho" [attr.height]="alto" [attr.viewBox]="'0 0 ' + ancho + ' ' + alto" aria-hidden="true">
      <line class="base" [attr.x1]="0" [attr.x2]="ancho" [attr.y1]="alto - pad" [attr.y2]="alto - pad" />
      @if (valores().length > 1) {
        <path class="area" [attr.d]="area()" />
        <path class="linea" [attr.d]="linea()" />
        <circle class="fin" [attr.cx]="x(valores().length - 1)" [attr.cy]="y(valores()[valores().length - 1])" r="2.5" />
      }
    </svg>
  `,
  styleUrl: './sparkline.component.scss',
})
export class SparklineComponent {
  readonly ancho = W;
  readonly alto = H;
  readonly pad = PAD;

  @Input({ required: true }) set values(v: number[]) {
    this.valores.set(v ?? []);
  }

  readonly valores = signal<number[]>([]);
  private readonly max = computed(() => Math.max(1, ...this.valores()));

  x(i: number): number {
    const n = this.valores().length;
    return n <= 1 ? W / 2 : PAD + (i * (W - PAD * 2)) / (n - 1);
  }

  y(v: number): number {
    return H - PAD - (v / this.max()) * (H - PAD * 2);
  }

  linea(): string {
    return this.valores()
      .map((v, i) => `${i === 0 ? 'M' : 'L'}${this.x(i).toFixed(1)},${this.y(v).toFixed(1)}`)
      .join('');
  }

  area(): string {
    const n = this.valores().length;
    const base = (H - PAD).toFixed(1);
    return `${this.linea()}L${this.x(n - 1).toFixed(1)},${base}L${this.x(0).toFixed(1)},${base}Z`;
  }
}
