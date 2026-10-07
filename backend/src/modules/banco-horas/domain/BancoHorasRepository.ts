export interface PapeletaParaBanco {
  employeeId: string;
  numero: string;
  tipo: 'HORAS_EXTRAS' | 'SALIDA';
  fecha: Date;
  totalHoras: number | null;
  recargo: string | null;
  trabajoRealizado: string | null;
  salidaMotivo: string | null;
  motivo: string | null;
  horaSalida: string | null;
  horaRetorno: string | null;
  tiempoSolicitado: string | null;
}

export interface AjusteBanco {
  id: string;
  employeeId: string;
  minutos: number;
  motivo: string;
  fecha: Date;
}

export interface BancoHorasRepository {
  /** Papeletas APROBADAS de horas extra y de salida PARTICULAR. */
  papeletasQueCuentan(employeeIds: string[]): Promise<PapeletaParaBanco[]>;
  ajustes(employeeIds: string[]): Promise<AjusteBanco[]>;
  crearAjuste(data: { employeeId: string; minutos: number; motivo: string; creadoPor: string }): Promise<AjusteBanco>;
}
