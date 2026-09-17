import { Paginated, PageQuery } from '../../../../shared/domain/pagination';
import {
  NuevaPapeletaHorasExtras,
  NuevaPapeletaSalida,
  Papeleta,
  PapeletaEstado,
  PapeletaTipo,
} from '../entities/Papeleta';

export interface PapeletaFilters extends PageQuery {
  tipo?: PapeletaTipo;
  estado?: PapeletaEstado;
  employeeId?: string;
  employeeIds?: string[];
  departmentId?: string;
  dateFrom?: Date;
  dateTo?: Date;
}

export interface PapeletaRepository {
  findById(id: string): Promise<Papeleta | null>;
  list(filters: PapeletaFilters): Promise<Paginated<Papeleta>>;
  crearHorasExtras(data: NuevaPapeletaHorasExtras & { numero: string; totalHoras: number }): Promise<Papeleta>;
  crearSalida(data: NuevaPapeletaSalida & { numero: string }): Promise<Papeleta>;
  registrarFirma(
    id: string,
    data: {
      firmante: 'JEFE_AREA' | 'RRHH';
      userId: string;
      fecha: Date;
      sello: string;
      estado: PapeletaEstado;
    },
  ): Promise<Papeleta>;
  rechazar(id: string, data: { userId: string; motivo: string }): Promise<Papeleta>;
  anular(id: string): Promise<Papeleta>;
  siguienteNumero(tipo: PapeletaTipo, anio: number): Promise<string>;
  horasAprobadasEnPeriodo(
    employeeIds: string[],
    desde: Date,
    hasta: Date,
  ): Promise<{ employeeId: string; recargo: string; horas: number }[]>;
}
