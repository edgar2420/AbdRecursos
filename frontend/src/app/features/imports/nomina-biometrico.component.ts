import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/services/api.service';
import { ToastService } from '../../core/services/toast.service';
import { apiErrorMessage } from '../../core/interceptors/auth.interceptor';
import { CardComponent, StateComponent } from '../../shared/components/ui.components';

type Campo = 'nombre' | 'ci' | 'ingreso' | 'cargo' | 'sexo';

interface CambioFicha {
  employeeId: string;
  codigo: string;
  nombre: string;
  campos: { campo: Campo; antes: string | null; despues: string }[];
}

interface VistaNomina {
  filas: number;
  cambios: CambioFicha[];
  resumen: Record<Campo, number>;
  cargosNuevos: string[];
  sinFicha: { codigo: string; nombre: string; cargo: string }[];
  fueraDeNomina: { employeeId: string; codigo: string; nombre: string }[];
  avisos: string[];
}

const CAMPOS: { campo: Campo; etiqueta: string }[] = [
  { campo: 'nombre', etiqueta: 'Nombre' },
  { campo: 'ci', etiqueta: 'C.I.' },
  { campo: 'ingreso', etiqueta: 'Fecha de ingreso' },
  { campo: 'cargo', etiqueta: 'Cargo' },
  { campo: 'sexo', etiqueta: 'Sexo' },
];

/** Nomina mensual de RRHH para el biometrico: subir, revisar ficha por ficha y aplicar. */
@Component({
  selector: 'app-nomina-biometrico',
  standalone: true,
  imports: [CardComponent, StateComponent, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-card heading="Nomina para el biometrico">
      <p class="intro">
        Suba la nomina que prepara RRHH cada mes. Se cruza por el <b>codigo del reloj</b> y actualiza
        C.I., nombre, cargo y fecha de ingreso. El sexo solo se completa si la ficha no lo tiene.
        No se crean ni se dan de baja empleados.
      </p>
      <div class="subida">
        <div class="field flex-1">
          <label for="archivo-nomina">Archivo de la nomina (.xlsx)</label>
          <input id="archivo-nomina" type="file" accept=".xlsx,.csv" (change)="elegir($event)" />
        </div>
        <button class="btn btn-primary" [disabled]="!archivo() || revisando()" (click)="revisar()">
          {{ revisando() ? 'Revisando...' : 'Revisar cambios' }}
        </button>
      </div>

      @if (vista(); as v) {
        <div class="resumen" aria-live="polite">
          <div class="dato"><span>Filas en la nomina</span><strong>{{ v.filas }}</strong></div>
          <div class="dato destacado"><span>Fichas a actualizar</span><strong>{{ v.cambios.length }}</strong></div>
          @for (c of campos; track c.campo) {
            @if (v.resumen[c.campo]) {
              <div class="dato"><span>{{ c.etiqueta }}</span><strong>{{ v.resumen[c.campo] }}</strong></div>
            }
          }
        </div>

        @if (v.cambios.length === 0) {
          <app-state title="Todo coincide con la nomina" message="Las fichas ya tienen estos datos; no hay nada que aplicar."></app-state>
        } @else {
          <div class="filtros" role="group" aria-label="Filtrar por dato">
            <button type="button" [attr.aria-pressed]="filtro() === null" (click)="filtro.set(null)">Todos</button>
            @for (c of campos; track c.campo) {
              @if (v.resumen[c.campo]) {
                <button type="button" [attr.aria-pressed]="filtro() === c.campo" (click)="filtro.set(c.campo)">
                  {{ c.etiqueta }} ({{ v.resumen[c.campo] }})
                </button>
              }
            }
            <input class="buscar" type="search" placeholder="Buscar codigo o nombre" aria-label="Buscar codigo o nombre"
              (input)="busqueda.set($any($event.target).value)" />
          </div>

          <div class="table-wrap cambios">
            <table class="data">
              <thead>
                <tr>
                  <th class="col-codigo">Codigo</th>
                  <th>Empleado</th>
                  <th>Que cambia</th>
                </tr>
              </thead>
              <tbody>
                @for (c of visibles(); track c.employeeId) {
                  <tr>
                    <td class="num">{{ c.codigo }}</td>
                    <td class="nowrap">{{ c.nombre }}</td>
                    <td>
                      <ul class="campos">
                        @for (x of c.campos; track x.campo) {
                          <li>
                            <span class="campo">{{ etiqueta(x.campo) }}</span>
                            @if (x.antes) {
                              <span class="antes">{{ x.antes }}</span><span class="flecha" aria-hidden="true">→</span>
                            } @else {
                              <span class="vacio">vacio</span><span class="flecha" aria-hidden="true">→</span>
                            }
                            <span class="despues">{{ x.despues }}</span>
                          </li>
                        }
                      </ul>
                    </td>
                  </tr>
                } @empty {
                  <tr><td colspan="3" class="muted">Ninguna ficha coincide con el filtro.</td></tr>
                }
              </tbody>
            </table>
          </div>
        }

        @if (v.cargosNuevos.length) {
          <p class="nota"><b>Cargos nuevos que se agregan al catalogo:</b> {{ v.cargosNuevos.join(', ') }}</p>
        }

        @if (v.avisos.length) {
          <div class="aviso">
            <b>Para revisar a mano ({{ v.avisos.length }})</b>
            <ul>
              @for (a of v.avisos; track a) {
                <li>{{ a }}</li>
              }
            </ul>
          </div>
        }

        @if (v.sinFicha.length || v.fueraDeNomina.length) {
          <div class="no-cruzan">
            @if (v.sinFicha.length) {
              <details>
                <summary>En la nomina pero no en el reloj ({{ v.sinFicha.length }})</summary>
                <p class="muted text-sm">Registrelos en el biometrico; la ficha se crea sola en la siguiente sincronizacion.</p>
                <ul>
                  @for (s of v.sinFicha; track s.codigo) {
                    <li>{{ s.codigo }} · {{ s.nombre }} · {{ s.cargo }}</li>
                  }
                </ul>
              </details>
            }
            @if (v.fueraDeNomina.length) {
              <details>
                <summary>Fichas activas que no estan en esta nomina ({{ v.fueraDeNomina.length }})</summary>
                <p class="muted text-sm">Pueden ser de otra sucursal o personal que ya salio. Si salieron, de de baja la ficha.</p>
                <ul>
                  @for (f of v.fueraDeNomina; track f.employeeId) {
                    <li><a [routerLink]="['/empleados', f.employeeId]">{{ f.codigo }} · {{ f.nombre }}</a></li>
                  }
                </ul>
              </details>
            }
          </div>
        }

        <div class="acciones">
          <button class="btn btn-ghost" (click)="descartar()">Descartar</button>
          @if (v.cambios.length) {
            <button class="btn btn-primary" [disabled]="aplicando()" (click)="aplicar(v)">
              {{ aplicando() ? 'Aplicando...' : 'Aplicar cambios a ' + fichas(v.cambios.length) }}
            </button>
          }
        </div>
      }
    </app-card>
  `,
  styleUrl: './nomina-biometrico.component.scss',
})
export class NominaBiometricoComponent {
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);

  readonly campos = CAMPOS;
  readonly archivo = signal<File | null>(null);
  readonly vista = signal<VistaNomina | null>(null);
  readonly revisando = signal(false);
  readonly aplicando = signal(false);
  readonly filtro = signal<Campo | null>(null);
  readonly busqueda = signal('');

  readonly visibles = computed(() => {
    const v = this.vista();
    if (!v) return [];
    const campo = this.filtro();
    const texto = this.busqueda().trim().toUpperCase();
    return v.cambios.filter(
      (c) =>
        (!campo || c.campos.some((x) => x.campo === campo)) &&
        (!texto || c.codigo.includes(texto) || c.nombre.toUpperCase().includes(texto)),
    );
  });

  fichas(n: number): string {
    return n === 1 ? '1 ficha' : `${n} fichas`;
  }

  etiqueta(campo: Campo): string {
    return CAMPOS.find((c) => c.campo === campo)?.etiqueta ?? campo;
  }

  elegir(evento: Event): void {
    this.archivo.set((evento.target as HTMLInputElement).files?.[0] ?? null);
    this.vista.set(null);
  }

  revisar(): void {
    const form = this.formulario();
    if (!form) return;
    this.revisando.set(true);
    this.api.upload<VistaNomina>('/nomina-biometrico/revisar', form).subscribe({
      next: (r) => {
        this.revisando.set(false);
        this.filtro.set(null);
        this.vista.set(r.data);
      },
      error: (err) => {
        this.revisando.set(false);
        this.toast.error('No se pudo leer la nomina', apiErrorMessage(err));
      },
    });
  }

  aplicar(v: VistaNomina): void {
    const form = this.formulario();
    if (!form) return;
    if (!window.confirm(`Se actualizaran ${this.fichas(v.cambios.length)} con los datos de la nomina. ¿Continuar?`)) return;
    this.aplicando.set(true);
    this.api.upload<{ fichas: number; cargosNuevos: number }>('/nomina-biometrico/aplicar', form).subscribe({
      next: (r) => {
        this.aplicando.set(false);
        this.toast.success(
          `${this.fichas(r.data.fichas)} ${r.data.fichas === 1 ? 'actualizada' : 'actualizadas'}`,
          r.data.cargosNuevos ? `${r.data.cargosNuevos} cargos nuevos en el catalogo` : 'Queda registrado en la auditoria',
        );
        this.revisar();
      },
      error: (err) => {
        this.aplicando.set(false);
        this.toast.error('No se pudieron aplicar los cambios', apiErrorMessage(err));
      },
    });
  }

  descartar(): void {
    this.vista.set(null);
  }

  private formulario(): FormData | null {
    const archivo = this.archivo();
    if (!archivo) return null;
    const form = new FormData();
    form.append('file', archivo);
    return form;
  }
}
