/** Cuenta de usuario vinculada al empleado: se bloquea con la baja y se habilita al reactivarlo. */
export interface AccesoEmpleadoPort {
  /** Bloquea el usuario y cierra sus sesiones. Devuelve true si el empleado tenia usuario. */
  bloquear(employeeId: string): Promise<boolean>;
  /** Vuelve a habilitar el usuario. Devuelve true si el empleado tenia usuario. */
  habilitar(employeeId: string): Promise<boolean>;
}
