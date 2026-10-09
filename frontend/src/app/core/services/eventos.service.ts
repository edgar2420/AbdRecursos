import { Injectable, inject } from '@angular/core';
import { Observable, Subject, debounceTime, filter, firstValueFrom, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';

export type TipoEvento = 'marcaciones' | 'empleados' | 'papeletas' | 'vacaciones';

/**
 * Avisos en tiempo real del servidor (Server-Sent Events). Se usa fetch y no EventSource
 * porque hay que mandar el token en el encabezado. Si la conexion se corta, se reconecta sola.
 */
@Injectable({ providedIn: 'root' })
export class EventosService {
  private readonly auth = inject(AuthService);
  private readonly eventos$ = new Subject<TipoEvento>();
  private control: AbortController | null = null;
  private espera = 2000;
  private activo = false;

  /** Se dispara cuando llega alguno de los tipos indicados; varios seguidos se agrupan en uno. */
  en(tipos: TipoEvento[], agruparMs = 800): Observable<void> {
    return this.eventos$.pipe(
      filter((t) => tipos.includes(t)),
      debounceTime(agruparMs),
      map(() => undefined),
    );
  }

  iniciar(): void {
    if (this.activo) return;
    this.activo = true;
    void this.conectar();
  }

  detener(): void {
    this.activo = false;
    this.control?.abort();
    this.control = null;
  }

  private async conectar(): Promise<void> {
    while (this.activo) {
      const token = this.auth.token();
      if (!token) {
        this.activo = false;
        return;
      }
      this.control = new AbortController();
      try {
        const respuesta = await fetch(`${environment.apiUrl}/eventos`, {
          headers: { Authorization: `Bearer ${token}`, Accept: 'text/event-stream' },
          signal: this.control.signal,
        });
        if (respuesta.status === 401) {
          // Token vencido: se renueva y se vuelve a conectar.
          await firstValueFrom(this.auth.refresh()).catch(() => undefined);
        } else if (respuesta.ok && respuesta.body) {
          this.espera = 2000;
          await this.leer(respuesta.body);
        }
      } catch {
        if (!this.activo) return;
      }
      if (!this.activo) return;
      await new Promise((r) => setTimeout(r, this.espera));
      this.espera = Math.min(this.espera * 2, 60_000);
    }
  }

  private async leer(cuerpo: ReadableStream<Uint8Array>): Promise<void> {
    const lector = cuerpo.getReader();
    const decodificador = new TextDecoder();
    let pendiente = '';
    for (;;) {
      const { value, done } = await lector.read();
      if (done) return;
      pendiente += decodificador.decode(value, { stream: true });
      const bloques = pendiente.split('\n\n');
      pendiente = bloques.pop() ?? '';
      for (const bloque of bloques) {
        const linea = bloque.split('\n').find((l) => l.startsWith('event: '));
        if (linea) this.eventos$.next(linea.slice(7).trim() as TipoEvento);
      }
    }
  }
}
