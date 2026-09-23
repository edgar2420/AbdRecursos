import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Input,
  NgZone,
  OnDestroy,
  computed,
  inject,
  signal,
} from '@angular/core';

export interface TrendPoint {
  /** Etiqueta corta del eje X, p. ej. "09/09". */
  label: string;
  /** Texto largo para el tooltip, p. ej. "mar 09/09". */
  detail: string;
  current: number;
  previous: number | null;
  previousDetail?: string;
}

const H = 240;
const PAD = { t: 22, r: 16, b: 30, l: 44 };

@Component({
  selector: 'app-trend-chart',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="legend">
      <span class="key"><i class="k k-cur" aria-hidden="true"></i>{{ currentLabel }}</span>
      @if (hasPrevious()) {
        <span class="key"><i class="k k-prev" aria-hidden="true"></i>{{ previousLabel }}</span>
      }
    </div>

    <div class="plot" (pointermove)="onMove($event)" (pointerleave)="salir()">
      @if (width() > 0 && puntos().length) {
        <svg
          [attr.width]="width()"
          [attr.height]="alto"
          [attr.viewBox]="'0 0 ' + width() + ' ' + alto"
          role="img"
          tabindex="0"
          [attr.aria-label]="ariaLabel()"
          (keydown)="onKey($event)"
          (focus)="onFocus()"
          (blur)="salir()"
        >
          @for (t of ticks(); track t) {
            <line class="grid" [attr.x1]="pad.l" [attr.x2]="width() - pad.r" [attr.y1]="y(t)" [attr.y2]="y(t)" />
            <text class="tick" [attr.x]="pad.l - 8" [attr.y]="y(t) + 4" text-anchor="end">{{ formatTick(t) }}</text>
          }
          @for (i of xIdx(); track i) {
            <text class="tick" [attr.x]="x(i)" [attr.y]="alto - 8" [attr.text-anchor]="anclaX(i)">{{ puntos()[i].label }}</text>
          }

          @if (hasPrevious()) {
            <path class="prev" [attr.d]="linea('previous')" />
          }
          <path class="area" [attr.d]="area()" />
          <path class="cur" [attr.d]="linea('current')" />

          @if (activo() === null) {
            <circle class="dot-cur" [attr.cx]="x(ultimo())" [attr.cy]="y(puntos()[ultimo()].current)" r="4" />
            <text class="end-label" [attr.x]="x(ultimo())" [attr.y]="y(puntos()[ultimo()].current) - 10" text-anchor="end">
              {{ format(puntos()[ultimo()].current) }}
            </text>
          }

          @if (activo(); as i) {
            <line class="cross" [attr.x1]="x(i - 1)" [attr.x2]="x(i - 1)" [attr.y1]="pad.t" [attr.y2]="alto - pad.b" />
            @if (hasPrevious() && puntos()[i - 1].previous !== null) {
              <circle class="dot-prev" [attr.cx]="x(i - 1)" [attr.cy]="y(puntos()[i - 1].previous!)" r="4" />
            }
            <circle class="dot-cur" [attr.cx]="x(i - 1)" [attr.cy]="y(puntos()[i - 1].current)" r="4" />
          }
        </svg>

        @if (activo(); as i) {
          <div class="tip" role="status" [class.flip]="x(i - 1) > width() - 200" [style.left.px]="x(i - 1)">
            <div class="tip-head">{{ puntos()[i - 1].detail }}</div>
            <div class="tip-row">
              <i class="k k-cur" aria-hidden="true"></i>
              <strong>{{ format(puntos()[i - 1].current) }}</strong>
              <span>{{ currentLabel }}</span>
            </div>
            @if (hasPrevious() && puntos()[i - 1].previous !== null) {
              <div class="tip-row">
                <i class="k k-prev" aria-hidden="true"></i>
                <strong>{{ format(puntos()[i - 1].previous!) }}</strong>
                <span>{{ puntos()[i - 1].previousDetail ?? previousLabel }}</span>
              </div>
            }
          </div>
        }
      }
    </div>
  `,
  styleUrl: './trend-chart.component.scss',
})
export class TrendChartComponent implements AfterViewInit, OnDestroy {
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly zone = inject(NgZone);
  private observer?: ResizeObserver;

  readonly alto = H;
  readonly pad = PAD;

  @Input() currentLabel = 'Este periodo';
  @Input() previousLabel = 'Periodo anterior';
  @Input() ariaDescription = '';
  @Input() format: (value: number) => string = (v) => String(v);
  @Input({ required: true }) set points(value: TrendPoint[]) {
    this.puntos.set(value ?? []);
    this.activo.set(null);
  }

  readonly puntos = signal<TrendPoint[]>([]);
  readonly width = signal(0);
  /** Indice activo + 1 (0 queda libre para que @if trate el primer dia como verdadero). */
  readonly activo = signal<number | null>(null);

  readonly hasPrevious = computed(() => this.puntos().some((p) => p.previous !== null));
  readonly ultimo = computed(() => Math.max(0, this.puntos().length - 1));

  private readonly escala = computed(() => {
    const valores = this.puntos().flatMap((p) => [p.current, p.previous ?? 0]);
    const max = Math.max(0, ...valores);
    if (max === 0) return { max: 4, paso: 1 };
    const bruto = max / 4;
    const mag = Math.pow(10, Math.floor(Math.log10(bruto)));
    const norm = bruto / mag;
    const paso = Math.max(1, (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10) * mag);
    return { max: paso * Math.ceil(max / paso), paso };
  });

  readonly ticks = computed(() => {
    const { max, paso } = this.escala();
    const lista: number[] = [];
    for (let v = 0; v <= max + 1e-9; v += paso) lista.push(v);
    return lista;
  });

  readonly xIdx = computed(() => {
    const n = this.puntos().length;
    if (n === 0) return [];
    const maxEtiquetas = Math.max(2, Math.floor((this.width() - PAD.l - PAD.r) / 64));
    const salto = Math.max(1, Math.ceil(n / maxEtiquetas));
    const idx: number[] = [];
    for (let i = 0; i < n; i += salto) idx.push(i);
    const ultimo = n - 1;
    if (idx[idx.length - 1] !== ultimo) {
      if (ultimo - idx[idx.length - 1] < salto / 2) idx.pop();
      idx.push(ultimo);
    }
    return idx;
  });

  readonly ariaLabel = computed(() => {
    const total = this.puntos().reduce((acc, p) => acc + p.current, 0);
    return `${this.currentLabel}: ${this.format(total)} en total. ${this.ariaDescription} Use las flechas izquierda y derecha para recorrer los dias.`;
  });

  ngAfterViewInit(): void {
    this.zone.runOutsideAngular(() => {
      this.observer = new ResizeObserver((entries) => {
        const w = Math.floor(entries[0].contentRect.width);
        if (w !== this.width()) this.zone.run(() => this.width.set(w));
      });
      this.observer.observe(this.host.nativeElement);
    });
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
  }

  x(i: number): number {
    const n = this.puntos().length;
    const ancho = this.width() - PAD.l - PAD.r;
    return n <= 1 ? PAD.l + ancho / 2 : PAD.l + (i * ancho) / (n - 1);
  }

  y(v: number): number {
    const alto = H - PAD.t - PAD.b;
    return PAD.t + alto - (v / this.escala().max) * alto;
  }

  anclaX(i: number): string {
    if (i === 0) return 'start';
    if (i === this.puntos().length - 1) return 'end';
    return 'middle';
  }

  formatTick(v: number): string {
    return this.format(v);
  }

  linea(serie: 'current' | 'previous'): string {
    return this.puntos()
      .map((p, i) => {
        const v = serie === 'current' ? p.current : (p.previous ?? 0);
        return `${i === 0 ? 'M' : 'L'}${this.x(i).toFixed(1)},${this.y(v).toFixed(1)}`;
      })
      .join('');
  }

  area(): string {
    const n = this.puntos().length;
    if (n === 0) return '';
    const base = this.y(0).toFixed(1);
    return `${this.linea('current')}L${this.x(n - 1).toFixed(1)},${base}L${this.x(0).toFixed(1)},${base}Z`;
  }

  onMove(event: PointerEvent): void {
    const n = this.puntos().length;
    if (n === 0) return;
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const px = event.clientX - rect.left;
    const ancho = this.width() - PAD.l - PAD.r;
    const i = n <= 1 ? 0 : Math.round(((px - PAD.l) / ancho) * (n - 1));
    this.activo.set(Math.min(n - 1, Math.max(0, i)) + 1);
  }

  onKey(event: KeyboardEvent): void {
    const n = this.puntos().length;
    const actual = (this.activo() ?? n) - 1;
    let siguiente: number | null = null;
    if (event.key === 'ArrowLeft') siguiente = Math.max(0, actual - 1);
    else if (event.key === 'ArrowRight') siguiente = Math.min(n - 1, actual + 1);
    else if (event.key === 'Home') siguiente = 0;
    else if (event.key === 'End') siguiente = n - 1;
    else if (event.key === 'Escape') {
      this.salir();
      return;
    }
    if (siguiente === null) return;
    event.preventDefault();
    this.activo.set(siguiente + 1);
  }

  onFocus(): void {
    if (this.activo() === null && this.puntos().length) this.activo.set(this.puntos().length);
  }

  salir(): void {
    this.activo.set(null);
  }
}
