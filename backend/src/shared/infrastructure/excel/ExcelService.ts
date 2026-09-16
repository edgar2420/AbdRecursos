import ExcelJS from 'exceljs';

export interface ColumnSpec {
  key: string;
  header: string;
  width?: number;
  required?: boolean;
  example?: string | number;
  note?: string;
}

export interface ParsedRow {
  rowNumber: number;
  data: Record<string, unknown>;
}

/** Puerto de hojas de calculo usado por el modulo generico de importacion (2.8). */
export interface SpreadsheetPort {
  buildTemplate(sheetName: string, columns: ColumnSpec[]): Promise<Buffer>;
  parse(buffer: Buffer, columns: ColumnSpec[]): Promise<ParsedRow[]>;
  export(sheetName: string, columns: ColumnSpec[], rows: Record<string, unknown>[]): Promise<Buffer>;
}

const HEADER_FILL = 'FF0E7490';

export class ExcelService implements SpreadsheetPort {
  async buildTemplate(sheetName: string, columns: ColumnSpec[]): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'SGRH';
    const ws = wb.addWorksheet(sheetName);
    ws.columns = columns.map((c) => ({ header: c.header, key: c.key, width: c.width ?? 22 }));
    this.styleHeader(ws, columns);

    // Fila de ejemplo para que el usuario vea el formato esperado.
    if (columns.some((c) => c.example !== undefined)) {
      const example: Record<string, unknown> = {};
      columns.forEach((c) => (example[c.key] = c.example ?? ''));
      const row = ws.addRow(example);
      row.font = { italic: true, color: { argb: 'FF64748B' } };
    }

    const notes = wb.addWorksheet('Instrucciones');
    notes.columns = [
      { header: 'Columna', key: 'col', width: 26 },
      { header: 'Obligatoria', key: 'req', width: 14 },
      { header: 'Formato / Notas', key: 'note', width: 70 },
    ];
    this.styleHeader(notes, [{ key: 'col', header: '' }, { key: 'req', header: '' }, { key: 'note', header: '' }]);
    columns.forEach((c) =>
      notes.addRow({ col: c.header, req: c.required ? 'SI' : 'No', note: c.note ?? '' }),
    );

    return Buffer.from(await wb.xlsx.writeBuffer());
  }

  async parse(buffer: Buffer, columns: ColumnSpec[]): Promise<ParsedRow[]> {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer as unknown as ArrayBuffer);
    const ws = wb.worksheets[0];
    if (!ws) return [];

    // Se mapea por encabezado (no por posicion) para tolerar columnas movidas.
    const headerRow = ws.getRow(1);
    const indexByKey = new Map<string, number>();
    headerRow.eachCell((cell, colNumber) => {
      const header = String(cell.value ?? '').trim().toLowerCase();
      const spec = columns.find((c) => c.header.toLowerCase() === header || c.key.toLowerCase() === header);
      if (spec) indexByKey.set(spec.key, colNumber);
    });

    const rows: ParsedRow[] = [];
    ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (rowNumber === 1) return;
      const data: Record<string, unknown> = {};
      let hasValue = false;
      for (const col of columns) {
        const idx = indexByKey.get(col.key);
        const raw = idx ? row.getCell(idx).value : undefined;
        const value = normalizeCell(raw);
        if (value !== null && value !== '') hasValue = true;
        data[col.key] = value;
      }
      if (hasValue) rows.push({ rowNumber, data });
    });
    return rows;
  }

  async export(
    sheetName: string,
    columns: ColumnSpec[],
    rows: Record<string, unknown>[],
  ): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'SGRH';
    const ws = wb.addWorksheet(sheetName);
    ws.columns = columns.map((c) => ({ header: c.header, key: c.key, width: c.width ?? 22 }));
    this.styleHeader(ws, columns);
    rows.forEach((r) => ws.addRow(r));
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columns.length } };
    ws.views = [{ state: 'frozen', ySplit: 1 }];
    return Buffer.from(await wb.xlsx.writeBuffer());
  }

  private styleHeader(ws: ExcelJS.Worksheet, _columns: ColumnSpec[]): void {
    const header = ws.getRow(1);
    header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL } };
    header.alignment = { vertical: 'middle', horizontal: 'center' };
    header.height = 22;
  }
}

/** Normaliza celdas de ExcelJS (formulas, hipervinculos, rich text) a valores simples. */
function normalizeCell(raw: unknown): string | number | Date | boolean | null {
  if (raw === null || raw === undefined) return null;
  if (raw instanceof Date) return raw;
  if (typeof raw === 'object') {
    const obj = raw as Record<string, unknown>;
    if ('text' in obj) return String(obj.text).trim();
    if ('result' in obj) return normalizeCell(obj.result);
    if ('richText' in obj) {
      return (obj.richText as { text: string }[]).map((t) => t.text).join('').trim();
    }
    return null;
  }
  if (typeof raw === 'string') return raw.trim();
  return raw as number | boolean;
}
