import { Injectable, signal } from '@angular/core';

export interface Toast {
  id: number;
  kind: 'ok' | 'error' | 'warn' | 'info';
  title: string;
  message?: string;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  private counter = 0;
  readonly toasts = signal<Toast[]>([]);

  success(title: string, message?: string): void {
    this.push('ok', title, message);
  }

  error(title: string, message?: string): void {
    this.push('error', title, message, 7000);
  }

  warn(title: string, message?: string): void {
    this.push('warn', title, message);
  }

  info(title: string, message?: string): void {
    this.push('info', title, message);
  }

  dismiss(id: number): void {
    this.toasts.update((list) => list.filter((t) => t.id !== id));
  }

  private push(kind: Toast['kind'], title: string, message?: string, ttl = 4500): void {
    const id = ++this.counter;
    this.toasts.update((list) => [...list, { id, kind, title, message }]);
    setTimeout(() => this.dismiss(id), ttl);
  }
}
