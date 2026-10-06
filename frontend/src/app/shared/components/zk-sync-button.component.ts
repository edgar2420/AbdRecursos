import { ChangeDetectionStrategy, Component, EventEmitter, Input, OnInit, Output, inject, signal } from '@angular/core';
import { ApiService } from '../../core/services/api.service';
import { ToastService } from '../../core/services/toast.service';
import { apiErrorMessage } from '../../core/interceptors/auth.interceptor';

interface ResultadoPersonal {
  leidos: number;
  creados: number;
  actualizados: number;
  nombresACorregir: number;
}

interface ResultadoMarcaciones {
  leidas: number;
  nuevas: number;
  sinEmpleado: number;
}

/** Boton para traer personal o marcaciones desde ZKBio Time. Solo aparece si el servidor lo tiene configurado. */
@Component({
  selector: 'app-zk-sync',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (configurado()) {
      <button type="button" class="btn btn-secondary btn-sm zk" [disabled]="trabajando()" (click)="sincronizar()">
        <svg [class.girando]="trabajando()" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M21 2v6h-6M3 22v-6h6" />
          <path d="M3.51 9a9 9 0 0 1 14.85-3.36L21 8M3 16l2.64 2.36A9 9 0 0 0 20.49 15" />
        </svg>
        {{ trabajando() ? 'Sincronizando...' : etiqueta }}
      </button>
    }
  `,
  styleUrl: './zk-sync-button.component.scss',
})
export class ZkSyncButtonComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);

  @Input({ required: true }) modo: 'personal' | 'marcaciones' = 'marcaciones';
  @Input() etiqueta = 'Sincronizar con ZKBio Time';
  @Output() completado = new EventEmitter<void>();

  readonly configurado = signal(false);
  readonly trabajando = signal(false);

  ngOnInit(): void {
    this.api.get<{ configurado: boolean }>('/integrations/zkbio/estado').subscribe({
      next: (r) => this.configurado.set(r.data.configurado),
      error: () => this.configurado.set(false),
    });
  }

  sincronizar(): void {
    this.trabajando.set(true);
    const fin = () => this.trabajando.set(false);

    if (this.modo === 'personal') {
      this.api.post<ResultadoPersonal>('/integrations/zkbio/personal', {}).subscribe({
        next: (r) => {
          fin();
          const d = r.data;
          const corregir = d.nombresACorregir ? ` · ${d.nombresACorregir} con nombre a corregir` : '';
          this.toast.success('Personal sincronizado', `${d.creados} nuevos, ${d.actualizados} actualizados${corregir}`);
          this.completado.emit();
        },
        error: (err) => {
          fin();
          this.toast.error('No se pudo sincronizar', apiErrorMessage(err));
        },
      });
      return;
    }

    this.api.post<ResultadoMarcaciones>('/integrations/zkbio/marcaciones', {}).subscribe({
      next: (r) => {
        fin();
        const d = r.data;
        const sinEmpleado = d.sinEmpleado ? ` · ${d.sinEmpleado} de personas que no estan en el sistema` : '';
        this.toast.success('Marcaciones actualizadas', `${d.nuevas} nuevas de ${d.leidas} leidas${sinEmpleado}`);
        this.completado.emit();
      },
      error: (err) => {
        fin();
        this.toast.error('No se pudo sincronizar', apiErrorMessage(err));
      },
    });
  }
}
