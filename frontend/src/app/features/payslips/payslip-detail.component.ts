import { ChangeDetectionStrategy, Component, ElementRef, Input, OnDestroy, OnInit, ViewChild, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/services/api.service';
import { ToastService } from '../../core/services/toast.service';
import { Payslip } from '../../core/models/api.models';
import { CardComponent, ModalComponent, PageHeaderComponent, StateComponent } from '../../shared/components/ui.components';
import { BadgeClasePipe, BolivianosPipe, EtiquetaPipe, FechaPipe } from '../../shared/pipes/format.pipes';

const MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

@Component({
  selector: 'app-payslip-detail',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    PageHeaderComponent,
    CardComponent,
    StateComponent,
    ModalComponent,
    BolivianosPipe,
    FechaPipe,
    EtiquetaPipe,
    BadgeClasePipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      @if (loading()) {
        <app-state mode="loading" title="Cargando boleta"></app-state>
      } @else if (!payslip()) {
        <app-state
          mode="error"
          title="Boleta no disponible"
          message="La boleta no existe o pertenece a otro empleado."
        >
          <a class="btn btn-secondary btn-sm" routerLink="/boletas">Volver a mis boletas</a>
        </app-state>
      } @else {
      @if (payslip(); as p) {
        <app-page-header
          [title]="'Boleta de ' + monthName(p.periodMonth) + ' ' + p.periodYear"
          [subtitle]="p.employeeName + ' · ' + p.employeeCode"
        >
          <a class="btn btn-ghost btn-sm" routerLink="/boletas">Volver</a>
          <button class="btn btn-primary btn-sm" (click)="verPdf(p)">Ver PDF e imprimir</button>
        </app-page-header>

        <div class="grid cols-3">
          <app-card heading="Resumen">
            <dl>
              <div><dt>Estado</dt><dd><span [class]="p.status | badgeClase">{{ p.status | etiqueta }}</span></dd></div>
              <div><dt>Dias trabajados</dt><dd>{{ p.workedDays }}</dd></div>
              <div><dt>Haber basico</dt><dd>{{ p.baseSalary | bs }}</dd></div>
              <div><dt>Emitida</dt><dd>{{ p.issuedAt | fecha }}</dd></div>
              <div><dt>Firma autorizada</dt><dd>{{ p.issuedByName ?? 'Pendiente de emision' }}</dd></div>
            </dl>
          </app-card>

          <app-card heading="Haberes" [padded]="false">
            <table class="data">
              <tbody>
                @for (line of earnings(); track line.code + line.concept) {
                  <tr>
                    <td>
                      {{ line.concept }}
                      @if (line.quantity) {
                        <span class="muted">({{ line.quantity }})</span>
                      }
                    </td>
                    <td class="num">{{ line.amount | bs }}</td>
                  </tr>
                }
                <tr class="total">
                  <td class="strong">Total ganado</td>
                  <td class="num strong">{{ p.totalEarnings | bs }}</td>
                </tr>
              </tbody>
            </table>
          </app-card>

          <app-card heading="Descuentos" [padded]="false">
            <table class="data">
              <tbody>
                @for (line of deductions(); track line.code + line.concept) {
                  <tr>
                    <td>{{ line.concept }}</td>
                    <td class="num">{{ line.amount | bs }}</td>
                  </tr>
                }
                <tr class="total">
                  <td class="strong">Total descuentos</td>
                  <td class="num strong">{{ p.totalDeductions | bs }}</td>
                </tr>
              </tbody>
            </table>
          </app-card>
        </div>

        <section class="net">
          <span>Liquido pagable</span>
          <strong>{{ p.netPay | bs }}</strong>
        </section>

        <p class="muted" style="font-size:12px">
          El aporte laboral a la AFP y el RC-IVA se calculan con los parametros legales vigentes en
          el periodo de la boleta, que quedan guardados junto al documento para poder reconstruir el
          calculo en cualquier momento.
        </p>
      }
      }
    </div>

    @if (docPreview(); as doc) {
      <app-modal [title]="doc.titulo" (closed)="cerrarDocPreview()">
        <iframe #pdfFrame [src]="doc.url" class="pdf-frame" title="Vista previa de la boleta"></iframe>
        <div footer>
          <button class="btn btn-ghost" (click)="cerrarDocPreview()">Cerrar</button>
          <button class="btn btn-primary" (click)="imprimir()">Imprimir</button>
        </div>
      </app-modal>
    }
  `,
  styles: [
    `
      dl {
        margin: 0;
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      dl > div {
        display: flex;
        justify-content: space-between;
        font-size: 13px;
      }
      dt {
        color: var(--ink-500);
      }
      dd {
        margin: 0;
      }
      table.data {
        min-width: 0;
      }
      tr.total td {
        background: var(--brand-50);
      }
      .net {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 14px;
        padding: 18px 24px;
        border-radius: var(--radius-lg);
        background: linear-gradient(120deg, var(--brand-800), var(--brand-600));
        color: #fff;
      }
      .net span {
        font-size: 13px;
        letter-spacing: 0.04em;
        text-transform: uppercase;
      }
      .net strong {
        font-size: 27px;
        color: #fff;
      }
      .pdf-frame {
        width: 100%;
        height: 68vh;
        border: 0;
        border-radius: 8px;
        background: var(--ink-100);
      }
    `,
  ],
})
export class PayslipDetailComponent implements OnInit, OnDestroy {
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);
  private readonly sanitizer = inject(DomSanitizer);

  @Input() id = '';

  readonly loading = signal(true);
  readonly payslip = signal<Payslip | null>(null);

  readonly earnings = computed(() => this.payslip()?.details.filter((d) => d.type === 'EARNING') ?? []);
  readonly deductions = computed(() => this.payslip()?.details.filter((d) => d.type === 'DEDUCTION') ?? []);

  readonly docPreview = signal<{ titulo: string; url: SafeResourceUrl } | null>(null);
  private docObjectUrl: string | null = null;
  @ViewChild('pdfFrame') private pdfFrame?: ElementRef<HTMLIFrameElement>;

  ngOnInit(): void {
    this.api.get<Payslip>(`/payslips/${this.id}`).subscribe({
      next: (response) => {
        this.payslip.set(response.data);
        this.loading.set(false);
      },
      error: () => {
        this.payslip.set(null);
        this.loading.set(false);
      },
    });
  }

  monthName(month: number): string {
    return MONTHS[month - 1] ?? '';
  }

  verPdf(payslip: Payslip): void {
    this.api.download(`/payslips/${payslip.id}/pdf`).subscribe({
      next: (response) => this.mostrarEnVisor(response.body as Blob, `Boleta de ${payslip.employeeName}`),
      error: () => this.toast.error('No se pudo generar el PDF'),
    });
  }

  private mostrarEnVisor(blob: Blob, titulo: string): void {
    this.cerrarDocPreview();
    this.docObjectUrl = URL.createObjectURL(blob);
    this.docPreview.set({ titulo, url: this.sanitizer.bypassSecurityTrustResourceUrl(this.docObjectUrl) });
  }

  cerrarDocPreview(): void {
    if (this.docObjectUrl) {
      URL.revokeObjectURL(this.docObjectUrl);
      this.docObjectUrl = null;
    }
    this.docPreview.set(null);
  }

  imprimir(): void {
    const ventana = this.pdfFrame?.nativeElement.contentWindow;
    if (!ventana) {
      this.toast.error('El documento todavia no termino de cargar');
      return;
    }
    ventana.focus();
    ventana.print();
  }

  ngOnDestroy(): void {
    this.cerrarDocPreview();
  }
}
