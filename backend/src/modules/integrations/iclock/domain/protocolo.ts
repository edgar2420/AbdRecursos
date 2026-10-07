/**
 * Protocolo PUSH (ADMS / "iclock") de los relojes ZKTeco.
 * El reloj llama por HTTP plano a:
 *   GET  /iclock/cdata?SN=...&options=all  -> pide su configuracion
 *   POST /iclock/cdata?SN=...&table=ATTLOG -> envia marcaciones, una por linea
 *   GET  /iclock/getrequest?SN=...         -> pregunta si hay comandos pendientes
 *   POST /iclock/devicecmd?SN=...          -> informa el resultado de un comando
 */

import { fechaHoraLocal, tipoDeMarcacion } from '../../zkbio/domain/nombres';

export interface MarcacionPush {
  codigo: string;
  timestamp: Date;
  type: 'CHECK_IN' | 'CHECK_OUT';
}

/** Cada linea de ATTLOG: PIN \t AAAA-MM-DD HH:MM:SS \t estado \t verificacion \t ... */
export function leerAttlog(cuerpo: string): MarcacionPush[] {
  return cuerpo
    .split(/\r?\n/)
    .map((linea) => linea.split('\t'))
    .filter((c) => c.length >= 2 && c[0].trim() && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(c[1].trim()))
    .map((c) => ({
      codigo: c[0].trim(),
      timestamp: fechaHoraLocal(c[1].trim()),
      type: tipoDeMarcacion(c[2]?.trim() || '0'),
    }));
}

/** Respuesta a "options=all": pide que envie marcaciones en tiempo real. */
export function opcionesParaReloj(sn: string, zonaHoraria: number): string {
  return [
    `GET OPTION FROM: ${sn}`,
    'ATTLOGStamp=None',
    'OPERLOGStamp=9999',
    'ATTPHOTOStamp=None',
    'ErrorDelay=30',
    'Delay=10',
    'TransTimes=00:00;14:05',
    'TransInterval=1',
    'TransFlag=TransData AttLog',
    `TimeZone=${zonaHoraria}`,
    'Realtime=1',
    'Encrypt=None',
  ].join('\n');
}
