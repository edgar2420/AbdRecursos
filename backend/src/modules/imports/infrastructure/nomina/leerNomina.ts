import ExcelJS from 'exceljs';
import { FilaNomina, leerFila } from '../../domain/nominaBiometrico';

function valorCelda(valor: ExcelJS.CellValue): unknown {
  if (valor && typeof valor === 'object' && !(valor instanceof Date)) {
    if ('result' in valor) return valor.result;
    if ('richText' in valor) return valor.richText.map((t) => t.text).join('');
    if ('text' in valor) return valor.text;
  }
  return valor;
}

/**
 * Lee la nomina (xlsx o csv). Los titulos de arriba se saltan: los datos empiezan
 * despues de la fila que tiene la columna "CODIGO", y desde ahi se toman 8 columnas.
 */
export async function leerNomina(contenido: Buffer, nombreArchivo: string): Promise<FilaNomina[]> {
  const crudas: unknown[][] = [];
  if (/\.csv$/i.test(nombreArchivo)) {
    for (const linea of contenido.toString('utf8').split(/\r?\n/)) crudas.push(linea.split(',').slice(1));
  } else {
    const libro = new ExcelJS.Workbook();
    await libro.xlsx.load(contenido as unknown as ArrayBuffer);
    for (const hoja of libro.worksheets) {
      let columnaCodigo = 0;
      hoja.eachRow((fila) => {
        const celdas = (fila.values as ExcelJS.CellValue[]).map(valorCelda);
        if (!columnaCodigo) {
          const i = celdas.findIndex((c) => String(c ?? '').trim().toUpperCase() === 'CODIGO');
          if (i > 0) columnaCodigo = i;
          return;
        }
        crudas.push(celdas.slice(columnaCodigo, columnaCodigo + 8));
      });
    }
  }
  return crudas.map(leerFila).filter((f): f is FilaNomina => f !== null);
}
