import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ToastService } from '../../core/services/toast.service';
import { PageMeta } from '../../core/models/api.models';

@Component({
  selector: 'app-eye-toggle',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      type="button"
      class="eye-toggle"
      [attr.aria-label]="visible ? 'Ocultar contraseña' : 'Mostrar contraseña'"
      [attr.aria-pressed]="visible"
      (click)="toggled.emit(!visible)"
    >
      @if (visible) {
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a19.4 19.4 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a19.5 19.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
          <line x1="1" y1="1" x2="23" y2="23" />
        </svg>
      } @else {
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      }
    </button>
  `,
})
export class EyeToggleComponent {
  @Input() visible = false;
  @Output() toggled = new EventEmitter<boolean>();
}

@Component({
  selector: 'app-page-header',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="page-head">
      <div>
        <h1>{{ title }}</h1>
        <p *ngIf="subtitle">{{ subtitle }}</p>
      </div>
      <div class="row"><ng-content></ng-content></div>
    </header>
  `,
})
export class PageHeaderComponent {
  @Input({ required: true }) title = '';
  @Input() subtitle?: string;
}

@Component({
  selector: 'app-card',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="card">
      <div class="card-head" *ngIf="heading">
        <h2>{{ heading }}</h2>
        <div class="row"><ng-content select="[actions]"></ng-content></div>
      </div>
      <div [class.card-body]="padded">
        <ng-content></ng-content>
      </div>
    </section>
  `,
})
export class CardComponent {
  @Input() heading?: string;
  @Input() padded = true;
}

@Component({
  selector: 'app-kpi',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <article class="kpi">
      <span class="kpi-label">{{ label }}</span>
      <strong class="kpi-value">{{ value }}</strong>
      <span class="kpi-hint" *ngIf="hint">{{ hint }}</span>
    </article>
  `,
  styles: [
    `
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
    `,
  ],
})
export class KpiComponent {
  @Input({ required: true }) label = '';
  @Input({ required: true }) value: string | number = '';
  @Input() hint?: string;
}

@Component({
  selector: 'app-state',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="state">
      <div class="state-icon" *ngIf="mode !== 'loading'">{{ icon }}</div>
      <div class="spinner" *ngIf="mode === 'loading'"></div>
      <h3>{{ title }}</h3>
      <p *ngIf="message">{{ message }}</p>
      <ng-content></ng-content>
    </div>
  `,
})
export class StateComponent {
  @Input() mode: 'empty' | 'loading' | 'error' = 'empty';
  @Input() title = 'Sin resultados';
  @Input() message?: string;

  get icon(): string {
    return this.mode === 'error' ? '!' : '—';
  }
}

@Component({
  selector: 'app-paginator',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <nav class="paginator" *ngIf="meta">
      <span class="muted">
        {{ from }}–{{ to }} de {{ meta.total }} registro{{ meta.total === 1 ? '' : 's' }}
      </span>
      <div class="row">
        <label class="row" style="gap:6px">
          <span class="muted">Por pagina</span>
          <select
            [value]="meta.limit"
            (change)="limitChange.emit(+$any($event.target).value)"
            style="width:78px;height:31px"
          >
            <option *ngFor="let option of limits" [value]="option">{{ option }}</option>
          </select>
        </label>
        <button class="btn btn-ghost btn-sm" [disabled]="meta.page <= 1" (click)="pageChange.emit(meta.page - 1)">
          Anterior
        </button>
        <span class="page-chip">{{ meta.page }} / {{ meta.totalPages }}</span>
        <button
          class="btn btn-ghost btn-sm"
          [disabled]="meta.page >= meta.totalPages"
          (click)="pageChange.emit(meta.page + 1)"
        >
          Siguiente
        </button>
      </div>
    </nav>
  `,
  styles: [
    `
      .paginator {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 12px 16px;
        border-top: 1px solid var(--ink-200);
        font-size: 12.5px;
      }
      .page-chip {
        padding: 4px 10px;
        border-radius: 8px;
        background: var(--brand-50);
        color: var(--brand-800);
        font-weight: 600;
      }
    `,
  ],
})
export class PaginatorComponent {
  @Input() meta: PageMeta | null = null;
  @Output() pageChange = new EventEmitter<number>();
  @Output() limitChange = new EventEmitter<number>();
  readonly limits = [10, 25, 50, 100];

  get from(): number {
    return this.meta && this.meta.total > 0 ? (this.meta.page - 1) * this.meta.limit + 1 : 0;
  }

  get to(): number {
    return this.meta ? Math.min(this.meta.page * this.meta.limit, this.meta.total) : 0;
  }
}

@Component({
  selector: 'app-modal',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="modal-backdrop" (click)="closed.emit()">
      <div class="modal" (click)="$event.stopPropagation()" role="dialog" aria-modal="true">
        <div class="modal-head">
          <h2>{{ title }}</h2>
          <button class="btn btn-ghost btn-sm" type="button" (click)="closed.emit()" aria-label="Cerrar">
            Cerrar
          </button>
        </div>
        <div class="modal-body"><ng-content></ng-content></div>
        <div class="modal-foot"><ng-content select="[footer]"></ng-content></div>
      </div>
    </div>
  `,
})
export class ModalComponent {
  @Input({ required: true }) title = '';
  @Output() closed = new EventEmitter<void>();
}

@Component({
  selector: 'app-toasts',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="toast-stack" aria-live="polite">
      @for (toast of toasts.toasts(); track toast.id) {
        <div class="toast" [class]="'toast ' + toast.kind" (click)="toasts.dismiss(toast.id)">
          <div>
            <strong>{{ toast.title }}</strong>
            <span *ngIf="toast.message">{{ toast.message }}</span>
          </div>
        </div>
      }
    </div>
  `,
})
export class ToastContainerComponent {
  readonly toasts = inject(ToastService);
}
