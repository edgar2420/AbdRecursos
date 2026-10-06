export interface ZkEmpleado {
  emp_code: string;
  first_name: string | null;
  last_name: string | null;
  department?: { dept_name?: string | null } | null;
  hire_date?: string | null;
  gender?: string | null;
  email?: string | null;
}

export interface ZkMarcacion {
  id: number;
  emp_code: string;
  punch_time: string;
  punch_state: string | number;
  terminal_sn?: string | null;
  terminal_alias?: string | null;
}

export interface ZkConfig {
  url: string;
  usuario: string;
  clave: string;
}

const TAMANO_PAGINA = 500;
const TIEMPO_MAXIMO_MS = 20_000;

/** Cliente de solo lectura para la API REST de ZKBio Time (autenticacion JWT). */
export class ZkBioTimeClient {
  private token: string | null = null;

  constructor(private readonly config: ZkConfig) {}

  empleados(): Promise<ZkEmpleado[]> {
    return this.todo<ZkEmpleado>('/personnel/api/employees/');
  }

  marcaciones(desde: string, hasta: string): Promise<ZkMarcacion[]> {
    const q = new URLSearchParams({ start_time: desde, end_time: hasta });
    return this.todo<ZkMarcacion>(`/iclock/api/transactions/?${q.toString()}`);
  }

  private async autenticar(): Promise<string> {
    const r = await fetch(`${this.config.url}/jwt-api-token-auth/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: this.config.usuario, password: this.config.clave }),
      signal: AbortSignal.timeout(TIEMPO_MAXIMO_MS),
    });
    const json = (await r.json().catch(() => ({}))) as { token?: string };
    if (!r.ok || !json.token) throw new Error(`ZKBio Time rechazo el usuario (${r.status})`);
    this.token = json.token;
    return json.token;
  }

  private async pedir(url: string, reintentar = true): Promise<{ data?: unknown[]; next?: string | null }> {
    const token = this.token ?? (await this.autenticar());
    const r = await fetch(url, {
      headers: { Authorization: `JWT ${token}` },
      signal: AbortSignal.timeout(TIEMPO_MAXIMO_MS),
    });
    if (r.status === 401 && reintentar) {
      this.token = null;
      return this.pedir(url, false);
    }
    if (!r.ok) throw new Error(`ZKBio Time respondio ${r.status} en ${new URL(url).pathname}`);
    return (await r.json()) as { data?: unknown[]; next?: string | null };
  }

  private async todo<T>(ruta: string): Promise<T[]> {
    const filas: T[] = [];
    let url: string | null = `${this.config.url}${ruta}${ruta.includes('?') ? '&' : '?'}page_size=${TAMANO_PAGINA}`;
    while (url) {
      const pagina = await this.pedir(url);
      filas.push(...((pagina.data ?? []) as T[]));
      url = pagina.next ?? null;
    }
    return filas;
  }
}
