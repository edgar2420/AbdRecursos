import { ChangeDetectionStrategy, Component, EventEmitter, HostListener, Input, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
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
  imports: [CommonModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ng-template #contenido>
      <div class="kpi-top">
        <span class="kpi-label">{{ label }}</span>
        @if (icon?.length) {
          <span class="kpi-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              @for (d of icon; track $index) {
                <path [attr.d]="d" />
              }
            </svg>
          </span>
        }
      </div>
      <strong class="kpi-value">{{ value }}</strong>
      @if (status) {
        <span class="kpi-status">{{ status }}</span>
      }
      @if (hint) {
        <span class="kpi-hint">{{ hint }}</span>
      }
      @if (link) {
        <span class="kpi-more">
          {{ linkLabel }}
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </span>
      }
    </ng-template>

    @if (link) {
      <a class="kpi kpi-link" [ngClass]="'tone-' + tone" [routerLink]="link">
        <ng-container [ngTemplateOutlet]="contenido" />
      </a>
    } @else {
      <article class="kpi" [ngClass]="'tone-' + tone">
        <ng-container [ngTemplateOutlet]="contenido" />
      </article>
    }
  `,
  styleUrl: './kpi.component.scss',
})
export class KpiComponent {
  @Input({ required: true }) label = '';
  @Input({ required: true }) value: string | number = '';
  @Input() hint?: string;
  /** Texto de estado visible (no solo color), p. ej. "Requiere revision". */
  @Input() status?: string;
  @Input() tone: 'brand' | 'warn' | 'ok' = 'brand';
  /** Trazos SVG (viewBox 24x24). */
  @Input() icon?: string[];
  @Input() link?: string;
  @Input() linkLabel = 'Ver detalle';
}

@Component({
  selector: 'app-state',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="state" [attr.role]="mode === 'error' ? 'alert' : 'status'">
      <div class="state-icon" [class.state-icon-error]="mode === 'error'" *ngIf="mode !== 'loading'" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          @if (mode === 'error') {
            <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z" />
            <path d="M12 8v5M12 16h.01" />
          } @else {
            <path d="M22 12h-6l-2 3h-4l-2-3H2" />
            <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
          }
        </svg>
      </div>
      <div class="spinner" *ngIf="mode === 'loading'" aria-hidden="true"></div>
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
        <label class="row gap-xs">
          <span class="muted">Por pagina</span>
          <select class="select-compact limit-select"
            (change)="limitChange.emit(+$any($event.target).value)"
            aria-label="Registros por pagina"
          >
            <option *ngFor="let option of opciones" [value]="option" [selected]="option === meta.limit">{{ option }}</option>
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
  styleUrl: './paginator.component.scss',
})
export class PaginatorComponent {
  @Input() meta: PageMeta | null = null;
  @Output() pageChange = new EventEmitter<number>();
  @Output() limitChange = new EventEmitter<number>();
  readonly limits = [10, 25, 50, 100];

  get opciones(): number[] {
    const limit = this.meta?.limit;
    return limit && !this.limits.includes(limit) ? [...this.limits, limit].sort((a, b) => a - b) : this.limits;
  }

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
      <div class="modal" [class.modal-lg]="size === 'lg'" (click)="$event.stopPropagation()" role="dialog" aria-modal="true" [attr.aria-labelledby]="tituloId">
        <div class="modal-head">
          <h2 [id]="tituloId">{{ title }}</h2>
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
  @Input() size: 'md' | 'lg' = 'md';
  @Output() closed = new EventEmitter<void>();
  readonly tituloId = `modal-titulo-${++modalSeq}`;

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.closed.emit();
  }
}

let modalSeq = 0;

@Component({
  selector: 'app-toasts',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="toast-stack" role="status" aria-live="polite">
      @for (toast of toasts.toasts(); track toast.id) {
        <div class="toast" [class]="'toast ' + toast.kind" title="Clic para cerrar" (click)="toasts.dismiss(toast.id)">
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
