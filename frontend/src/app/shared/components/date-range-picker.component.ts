import { ChangeDetectionStrategy, Component, ElementRef, EventEmitter, HostListener, Input, Output, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface DateRange {
  from: string;
  to: string;
}

interface Preset {
  label: string;
  range: () => DateRange;
}

const PRESETS: Preset[] = [
  { label: 'Hoy', range: () => ({ from: iso(new Date()), to: iso(new Date()) }) },
  { label: 'Ayer', range: () => ({ from: iso(addDays(new Date(), -1)), to: iso(addDays(new Date(), -1)) }) },
  { label: 'Ultimos 7 dias', range: () => ({ from: iso(addDays(new Date(), -6)), to: iso(new Date()) }) },
  { label: 'Ultimos 30 dias', range: () => ({ from: iso(addDays(new Date(), -29)), to: iso(new Date()) }) },
  { label: 'Este mes', range: () => ({ from: iso(firstOfMonth(0)), to: iso(new Date()) }) },
  { label: 'Mes anterior', range: () => ({ from: iso(firstOfMonth(-1)), to: iso(lastOfMonth(-1)) }) },
];

/**
 * Selector de rango de fechas tipo BI: un boton que muestra el rango elegido
 * y despliega una lista de atajos comunes, con un rango personalizado al pie
 * (seccion "Filtros" del metodo de dataviz: presets arriba, custom detras de
 * una linea, seleccion marcada, sin reinventar un calendario propio).
 */
@Component({
  selector: 'app-date-range-picker',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="drp">
      <button type="button" class="drp-trigger" (click)="toggle()" [class.open]="open()">
        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <path d="M16 2v4M8 2v4M3 10h18" />
        </svg>
        <span>{{ etiqueta() }}</span>
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" class="drp-chev">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      @if (open()) {
        <div class="drp-panel">
          <ul class="drp-presets">
            @for (preset of presets; track preset.label) {
              <li>
                <button type="button" [class.selected]="preset.label === activePreset()" (click)="applyPreset(preset)">
                  @if (preset.label === activePreset()) {
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                  } @else {
                    <span class="drp-check-space"></span>
                  }
                  {{ preset.label }}
                </button>
              </li>
            }
          </ul>
          <div class="drp-custom">
            <span class="drp-custom-label">Rango personalizado</span>
            <div class="drp-custom-fields">
              <input type="date" [value]="customFrom()" (change)="customFrom.set($any($event.target).value)" />
              <span>-</span>
              <input type="date" [value]="customTo()" (change)="customTo.set($any($event.target).value)" />
            </div>
            <button type="button" class="btn btn-primary btn-sm" (click)="applyCustom()">Aplicar</button>
          </div>
        </div>
      }
    </div>
  `,
  styles: [
    `
      .drp {
        position: relative;
      }
      .drp-trigger {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 8px 12px;
        border-radius: 10px;
        border: 1px solid var(--ink-200);
        background: var(--surface);
        color: var(--ink-900);
        font-size: 12.5px;
        font-weight: 600;
        cursor: pointer;
      }
      .drp-trigger:hover,
      .drp-trigger.open {
        border-color: var(--brand-300);
        background: var(--brand-50);
      }
      .drp-chev {
        transition: transform 0.15s ease;
        color: var(--ink-500);
      }
      .drp-trigger.open .drp-chev {
        transform: rotate(180deg);
      }
      .drp-panel {
        position: absolute;
        top: calc(100% + 6px);
        right: 0;
        z-index: 40;
        width: 250px;
        background: var(--surface);
        border: 1px solid var(--ink-200);
        border-radius: 12px;
        box-shadow: var(--shadow-md);
        padding: 8px;
      }
      .drp-presets {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
      }
      .drp-presets button {
        width: 100%;
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 10px;
        border-radius: 8px;
        font-size: 12.5px;
        color: var(--ink-700);
        text-align: left;
      }
      .drp-presets button:hover {
        background: var(--ink-100);
      }
      .drp-presets button.selected {
        color: var(--brand-700);
        font-weight: 600;
      }
      .drp-check-space {
        width: 16px;
        flex: none;
      }
      .drp-custom {
        border-top: 1px solid var(--ink-200);
        margin-top: 6px;
        padding: 10px 10px 4px;
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .drp-custom-label {
        font-size: 11px;
        font-weight: 600;
        color: var(--ink-500);
        text-transform: uppercase;
        letter-spacing: 0.03em;
      }
      .drp-custom-fields {
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .drp-custom-fields input {
        flex: 1;
        min-width: 0;
      }
      .drp-custom .btn {
        align-self: flex-end;
      }
    `,
  ],
})
export class DateRangePickerComponent {
  private readonly host = inject(ElementRef<HTMLElement>);

  @Input({ required: true }) set from(value: string) {
    this._from = value;
    this.customFrom.set(value);
  }
  @Input({ required: true }) set to(value: string) {
    this._to = value;
    this.customTo.set(value);
  }
  @Output() rangeChange = new EventEmitter<DateRange>();

  private _from = '';
  private _to = '';

  readonly presets = PRESETS;
  readonly open = signal(false);
  readonly customFrom = signal('');
  readonly customTo = signal('');

  toggle(): void {
    this.open.set(!this.open());
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.host.nativeElement.contains(event.target as Node)) {
      this.open.set(false);
    }
  }

  activePreset(): string | null {
    const found = this.presets.find((p) => {
      const r = p.range();
      return r.from === this._from && r.to === this._to;
    });
    return found?.label ?? null;
  }

  etiqueta(): string {
    const activo = this.activePreset();
    if (activo) return activo;
    if (this._from === this._to) return formatoCorto(this._from);
    return `${formatoCorto(this._from)} - ${formatoCorto(this._to)}`;
  }

  applyPreset(preset: Preset): void {
    const range = preset.range();
    this.rangeChange.emit(range);
    this.open.set(false);
  }

  applyCustom(): void {
    if (!this.customFrom() || !this.customTo()) return;
    this.rangeChange.emit({ from: this.customFrom(), to: this.customTo() });
    this.open.set(false);
  }
}

function iso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number): Date {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function firstOfMonth(offsetMonths: number): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + offsetMonths, 1);
}

function lastOfMonth(offsetMonths: number): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + offsetMonths + 1, 0);
}

function formatoCorto(value: string): string {
  if (!value) return '-';
  const [year, month, day] = value.split('-');
  return `${day}/${month}/${year}`;
}
