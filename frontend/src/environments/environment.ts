/**
 * La URL de la API se resuelve en tiempo de ejecucion a partir del host desde
 * el que se abrio la aplicacion. Asi la misma compilacion sirve para
 * http://localhost:4200 y para http://192.168.x.x:4200 (celular u otra maquina
 * de la red), sin recompilar ni tocar configuracion.
 */
const API_PORT = 3000;

function resolveApiUrl(): string {
  const { protocol, hostname } = window.location;
  return `${protocol}//${hostname}:${API_PORT}/api/v1`;
}

export const environment = {
  production: false,
  apiUrl: resolveApiUrl(),
};
