import { CambioFicha, FichaActual } from './nominaBiometrico';

export interface NominaRepository {
  fichas(): Promise<FichaActual[]>;
  cargos(): Promise<string[]>;
  /** Crea los cargos nuevos y guarda todos los cambios en una sola transaccion. */
  aplicar(cambios: CambioFicha[], cargosNuevos: string[]): Promise<void>;
}
