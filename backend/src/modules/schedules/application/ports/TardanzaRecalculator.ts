/**
 * Recalcula la tardanza guardada de las marcaciones de entrada cuando cambia el horario que les aplica
 * (las marcaciones del biometrico pueden haberse importado antes de que el empleado tuviera horario).
 */
export interface TardanzaRecalculator {
  /** Devuelve cuantas marcaciones cambiaron. */
  recalcularEmpleados(employeeIds: string[], desde: Date): Promise<number>;
  recalcularHorario(scheduleId: string): Promise<number>;
}
