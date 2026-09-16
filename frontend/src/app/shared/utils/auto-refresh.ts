/**
 * Refresco automatico para listas que otro usuario puede cambiar (una
 * solicitud que le llega al supervisor, una aprobacion que ve el empleado):
 * sin esto, la pantalla queda desactualizada hasta que alguien recarga la
 * pagina a mano. Refresca por dos vias:
 *  - Al volver a la pestana/ventana (visibilitychange + focus): cubre el caso
 *    tipico de dejar la pestana abierta y volver despues.
 *  - Cada `seconds` mientras la pestana esta visible: cubre el caso de
 *    dejarla abierta y mirarla fijo esperando una respuesta.
 *
 * Uso en un componente:
 *   private detenerRefresco = autoRefresh(() => this.load());
 *   ngOnDestroy(): void { this.detenerRefresco(); }
 */
export function autoRefresh(callback: () => void, seconds = 25): () => void {
  const onVisible = () => {
    if (document.visibilityState === 'visible') callback();
  };

  document.addEventListener('visibilitychange', onVisible);
  window.addEventListener('focus', onVisible);

  const intervalId = window.setInterval(() => {
    if (document.visibilityState === 'visible') callback();
  }, seconds * 1000);

  return () => {
    document.removeEventListener('visibilitychange', onVisible);
    window.removeEventListener('focus', onVisible);
    window.clearInterval(intervalId);
  };
}
