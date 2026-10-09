import { NOMBRE_A_CORREGIR as NOMBRE_PENDIENTE } from '../../integrations/zkbio/domain/nombres';

/**
 * Reglas para leer la "NOMINA PARA EL BIOMETRICO" que prepara RRHH cada mes.
 * Columnas: N, CODIGO (el del reloj), PER, CARNET DE IDENTIDAD, expedicion, SEXO,
 * NOMBRE Y APELLIDOS (apellidos primero), OCUPACION QUE DESEMPEÑA, FECHA DE INGRESO (m/d/aaaa).
 */

export interface FilaNomina {
  codigo: string;
  ci: string;
  ciExtension: string | null;
  sexo: 'M' | 'F' | null;
  nombreCompleto: string;
  cargo: string;
  ingreso: Date;
}

/** Apellidos de mas de una palabra que se cuentan como uno solo. */
const APELLIDOS_COMPUESTOS = ['DE SOUZA PINTO', 'SANTA CRUZ', 'SORIA GALVARRO', 'DE LA'];
const PARTICULAS = new Set(['DE', 'DEL']);

function limpiar(texto: string): string {
  return texto.replace(/\s+/g, ' ').trim().toUpperCase();
}

/** Agrupa las palabras para que "SANTA CRUZ" o "DE ZAMBRANA" cuenten como un solo termino. */
function terminos(completo: string): string[] {
  let resto = limpiar(completo);
  const grupos: string[] = [];
  while (resto) {
    const compuesto = APELLIDOS_COMPUESTOS.find((c) => resto === c || resto.startsWith(`${c} `));
    if (compuesto && compuesto !== 'DE LA') {
      grupos.push(compuesto);
      resto = resto.slice(compuesto.length).trim();
      continue;
    }
    const partes = resto.split(' ');
    let toma = 1;
    if (compuesto === 'DE LA') toma = 3;
    else if (PARTICULAS.has(partes[0]) && partes.length > 1) toma = 2;
    grupos.push(partes.slice(0, toma).join(' '));
    resto = partes.slice(toma).join(' ');
  }
  return grupos;
}

/**
 * La nomina escribe "APELLIDOS NOMBRES". Si ya se sabe cuantas palabras tiene el nombre
 * (por la ficha existente) se usa eso; si no, se toman dos apellidos (uno si solo hay dos terminos)
 * y un termino que empiece con "DE" se cuenta como apellido (apellido de casada).
 */
export function separarApellidosNombres(
  completo: string,
  palabrasDelNombre?: number,
): { firstName: string; lastName: string } {
  const palabras = limpiar(completo).split(' ');
  if (palabrasDelNombre && palabrasDelNombre > 0 && palabrasDelNombre < palabras.length) {
    return {
      lastName: palabras.slice(0, palabras.length - palabrasDelNombre).join(' '),
      firstName: palabras.slice(-palabrasDelNombre).join(' '),
    };
  }

  const grupos = terminos(completo);
  if (grupos.length === 1) return { firstName: grupos[0], lastName: grupos[0] };
  let apellidos = grupos.length === 2 ? 1 : 2;
  while (apellidos < grupos.length - 1 && PARTICULAS.has(grupos[apellidos].split(' ')[0])) apellidos++;
  return { lastName: grupos.slice(0, apellidos).join(' '), firstName: grupos.slice(apellidos).join(' ') };
}

function sinTildes(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/** Mismas palabras sin importar orden, tildes ni mayusculas. */
export function mismoNombre(a: string, b: string): boolean {
  const clave = (s: string) => sinTildes(limpiar(s)).split(' ').sort().join(' ');
  return clave(a) === clave(b);
}

const ABREVIATURAS: [RegExp, string][] = [
  [/\bAUXIIAR\b/g, 'AUXILIAR'],
  [/\bTEC\b\.?/g, 'TECNICO '],
  [/\bENC\b\.?\/?/g, 'ENCARGADO '],
  [/\bENCARGADA\b/g, 'ENCARGADO'],
  [/\bADM\b\.?/g, 'ADMINISTRACION '],
  [/\bMANT\b\.?/g, 'MANTENIMIENTO '],
  [/\bCOMERC\b\.?/g, 'COMERCIAL '],
  [/\bDPTO\b\.?/g, 'DPTO. '],
  [/\bELECTRICISTA\b/g, 'ELECTRICO'],
  [/\bEJECUTIVOS\b/g, 'EJECUTIVO'],
  [/\bRECURSOS HUMANOS\b/g, 'RRHH'],
  [/\bSISTEMA\b/g, 'SISTEMAS'],
];

/** Nombre de cargo limpio, en mayusculas como el catalogo: "Tec. Electricista" -> "TECNICO ELECTRICO". */
export function nombreCargo(cargo: string): string {
  let texto = sinTildes(limpiar(cargo));
  for (const [patron, reemplazo] of ABREVIATURAS) texto = texto.replace(patron, reemplazo);
  return texto.replace(/\s*\(A\)/g, '(A)').replace(/\s+/g, ' ').trim();
}

/** Clave para comparar cargos escritos de distinta forma ("Jefe de Adm. Y Finanzas" = "JEFE DE ADMINISTRACION Y FINANZAS"). */
export function claveCargo(cargo: string): string {
  return nombreCargo(cargo)
    .replace(/\(A\)/g, '')
    .split(/[^A-Z]+/)
    .filter((p) => p && !['DE', 'DEL', 'LA', 'Y'].includes(p))
    .join('');
}

/** "3/25/2026" (mes/dia/año, como lo guarda Excel en ingles) o una fecha de Excel -> fecha local. */
export function fechaNomina(valor: unknown): Date | null {
  if (valor instanceof Date) return new Date(valor.getUTCFullYear(), valor.getUTCMonth(), valor.getUTCDate());
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(String(valor ?? '').trim());
  if (!m) return null;
  const fecha = new Date(Number(m[3]), Number(m[1]) - 1, Number(m[2]));
  return fecha.getMonth() === Number(m[1]) - 1 ? fecha : null;
}

/** Convierte una fila cruda (en el orden de la nomina, sin la columna N) en datos validados. */
export function leerFila(celdas: unknown[]): FilaNomina | null {
  const [codigo, , ci, ext, sexo, nombre, cargo, ingreso] = Array.from(celdas, (c) => (c instanceof Date ? c : String(c ?? '').trim()));
  const fecha = fechaNomina(ingreso);
  if (!/^\d+$/.test(String(codigo)) || !/^\d+$/.test(String(ci)) || !nombre || !fecha) return null;
  const s = String(sexo).toUpperCase();
  return {
    codigo: String(codigo),
    ci: String(ci),
    ciExtension: String(ext).toUpperCase() || null,
    sexo: s === 'M' || s === 'F' ? s : null,
    nombreCompleto: limpiar(String(nombre)),
    cargo: String(cargo),
    ingreso: fecha,
  };
}


export type CampoNomina = 'nombre' | 'ci' | 'ingreso' | 'cargo' | 'sexo';

/** Lo que el SGRH tiene hoy de cada ficha (solo lo que la nomina puede tocar). */
export interface FichaActual {
  id: string;
  codigo: string;
  firstName: string;
  lastName: string;
  ciHuella: string | null;
  ciExtension: string | null;
  hireDate: Date;
  gender: string | null;
  cargo: string | null;
  isActive: boolean;
}

export interface CambioCampo {
  campo: CampoNomina;
  antes: string | null;
  despues: string;
}

export interface DatosNuevos {
  firstName?: string;
  lastName?: string;
  ci?: string;
  ciHuella?: string;
  ciExtension?: string | null;
  hireDate?: Date;
  gender?: string;
  cargo?: string;
}

export interface CambioFicha {
  employeeId: string;
  codigo: string;
  nombre: string;
  campos: CambioCampo[];
  datos: DatosNuevos;
}

export interface PlanNomina {
  filas: number;
  cambios: CambioFicha[];
  resumen: Record<CampoNomina, number>;
  cargosNuevos: string[];
  sinFicha: { codigo: string; nombre: string; cargo: string }[];
  fueraDeNomina: { employeeId: string; codigo: string; nombre: string }[];
  avisos: string[];
}

function ddmmaaaa(fecha: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(fecha.getDate())}/${p(fecha.getMonth() + 1)}/${fecha.getFullYear()}`;
}

/**
 * Compara la nomina con las fichas y arma la lista de cambios, sin tocar nada.
 * La nomina manda en C.I., nombre, cargo y fecha de ingreso; el sexo solo se completa si falta.
 */
export function planificarNomina(
  filas: FilaNomina[],
  fichas: FichaActual[],
  cargosExistentes: string[],
  huella: (ci: string) => string,
): PlanNomina {
  const repetidos = filas.map((f) => f.codigo).filter((c, i, todos) => todos.indexOf(c) !== i);
  if (repetidos.length) throw new Error(`Codigos repetidos en la nomina: ${[...new Set(repetidos)].join(', ')}`);
  const ciRepetidas = filas.map((f) => f.ci).filter((c, i, todos) => todos.indexOf(c) !== i);
  if (ciRepetidas.length) throw new Error(`C.I. repetidas en la nomina: ${[...new Set(ciRepetidas)].join(', ')}`);

  const porCodigo = new Map(fichas.map((f) => [f.codigo, f]));
  const huellas = new Map(fichas.filter((f) => f.ciHuella).map((f) => [f.ciHuella!, f.codigo]));
  const cargos = new Map(cargosExistentes.map((c) => [claveCargo(c), c]));
  const cargosNuevos = new Map<string, string>();
  const resumen: Record<CampoNomina, number> = { nombre: 0, ci: 0, ingreso: 0, cargo: 0, sexo: 0 };
  const cambios: CambioFicha[] = [];
  const avisos: string[] = [];

  for (const f of filas) {
    const e = porCodigo.get(f.codigo);
    if (!e) continue;
    const campos: CambioCampo[] = [];
    const datos: DatosNuevos = {};
    const pendiente = e.firstName === NOMBRE_PENDIENTE;
    const actual = `${e.firstName} ${e.lastName}`;

    if (pendiente || !mismoNombre(actual, f.nombreCompleto)) {
      const { firstName, lastName } = separarApellidosNombres(
        f.nombreCompleto,
        pendiente ? undefined : e.firstName.trim().split(/\s+/).length,
      );
      Object.assign(datos, { firstName, lastName });
      campos.push({ campo: 'nombre', antes: pendiente ? null : actual, despues: `${firstName} ${lastName}` });
    }

    const h = huella(f.ci);
    const dueno = huellas.get(h);
    if (dueno && dueno !== f.codigo) {
      avisos.push(`${f.codigo} ${f.nombreCompleto}: la C.I. ${f.ci} ya pertenece a la ficha ${dueno}; no se cambio`);
    } else if (e.ciHuella !== h || e.ciExtension !== f.ciExtension) {
      Object.assign(datos, { ci: f.ci, ciHuella: h, ciExtension: f.ciExtension });
      huellas.set(h, f.codigo);
      campos.push({
        campo: 'ci',
        antes: e.ciHuella === h ? 'misma C.I., otra expedicion' : e.ciExtension ? 'otra C.I.' : null,
        despues: `${f.ci} ${f.ciExtension ?? ''}`.trim(),
      });
    }

    if (e.hireDate.getTime() !== f.ingreso.getTime()) {
      datos.hireDate = f.ingreso;
      campos.push({ campo: 'ingreso', antes: ddmmaaaa(e.hireDate), despues: ddmmaaaa(f.ingreso) });
    }

    if (f.sexo && !e.gender) {
      datos.gender = f.sexo;
      campos.push({ campo: 'sexo', antes: null, despues: f.sexo });
    } else if (f.sexo && e.gender !== f.sexo) {
      avisos.push(`${f.codigo} ${f.nombreCompleto}: sexo ${e.gender} en la ficha y ${f.sexo} en la nomina; se dejo ${e.gender}`);
    }

    const clave = claveCargo(f.cargo);
    if (clave && clave !== claveCargo(e.cargo ?? '')) {
      let nombre = cargos.get(clave);
      if (!nombre) {
        nombre = nombreCargo(f.cargo);
        cargos.set(clave, nombre);
        cargosNuevos.set(clave, nombre);
      }
      datos.cargo = nombre;
      campos.push({ campo: 'cargo', antes: e.cargo, despues: nombre });
    }

    if (campos.length) {
      campos.forEach((c) => resumen[c.campo]++);
      const nombre = datos.firstName ? `${datos.firstName} ${datos.lastName}` : actual;
      cambios.push({ employeeId: e.id, codigo: e.codigo, nombre, campos, datos });
    }
  }

  const enNomina = new Set(filas.map((f) => f.codigo));
  return {
    filas: filas.length,
    cambios,
    resumen,
    cargosNuevos: [...cargosNuevos.values()],
    sinFicha: filas.filter((f) => !porCodigo.has(f.codigo)).map((f) => ({ codigo: f.codigo, nombre: f.nombreCompleto, cargo: f.cargo })),
    fueraDeNomina: fichas
      .filter((e) => e.isActive && !enNomina.has(e.codigo))
      .map((e) => ({ employeeId: e.id, codigo: e.codigo, nombre: `${e.firstName} ${e.lastName}` })),
    avisos,
  };
}
