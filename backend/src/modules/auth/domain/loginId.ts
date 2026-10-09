/** El usuario para entrar es "codigo + apellido" (ej. "502 Rafael Ala"), sin importar tildes, mayusculas ni espacios. */
export function normalizeLoginId(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[\s\-_.]+/g, '');
}

const LARGO_MAXIMO_CODIGO = 20;

/**
 * Codigos de empleado que podrian estar al inicio del usuario: cada prefijo, tal cual y en mayusculas.
 * Asi el login busca por el indice unico del codigo en vez de recorrer todos los usuarios.
 */
export function codigosCandidatos(loginNormalizado: string): string[] {
  const candidatos = new Set<string>();
  for (let largo = 1; largo <= Math.min(loginNormalizado.length, LARGO_MAXIMO_CODIGO); largo++) {
    const prefijo = loginNormalizado.slice(0, largo);
    candidatos.add(prefijo);
    candidatos.add(prefijo.toUpperCase());
  }
  return [...candidatos];
}
