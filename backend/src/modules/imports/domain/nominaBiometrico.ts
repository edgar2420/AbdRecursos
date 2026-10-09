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
  const [codigo, , ci, ext, sexo, nombre, cargo, ingreso] = celdas.map((c) => (c instanceof Date ? c : String(c ?? '').trim()));
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
