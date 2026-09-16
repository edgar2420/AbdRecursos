import PDFDocument from 'pdfkit';
import { env } from '../config/env';

export interface ReportColumn {
  key: string;
  header: string;
  width: number;
  align?: 'left' | 'right' | 'center';
}

/** Exportacion a PDF de cualquier listado/reporte (seccion 2.7). */
export class ReportPdfGenerator {
  render(
    title: string,
    subtitle: string,
    columns: ReportColumn[],
    rows: Record<string, unknown>[],
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 32 });
      const chunks: Buffer[] = [];
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      doc.fillColor('#0e7490').fontSize(16).font('Helvetica-Bold').text(title);
      doc.fillColor('#64748b').fontSize(9).font('Helvetica').text(subtitle);
      doc.text(`${env.COMPANY_NAME} - generado ${new Date().toLocaleString('es-BO')}`);
      doc.moveDown(0.8);

      const startX = 32;
      let y = doc.y;

      const drawHeader = () => {
        doc.rect(startX, y, columns.reduce((a, c) => a + c.width, 0), 18).fill('#e0f2fe');
        let x = startX;
        doc.fillColor('#0e7490').fontSize(8).font('Helvetica-Bold');
        columns.forEach((c) => {
          doc.text(c.header, x + 4, y + 5, { width: c.width - 8, align: c.align ?? 'left' });
          x += c.width;
        });
        y += 20;
        doc.fillColor('#0f172a').font('Helvetica');
      };

      drawHeader();
      rows.forEach((row, index) => {
        if (y > 520) {
          doc.addPage({ size: 'A4', layout: 'landscape', margin: 32 });
          y = 40;
          drawHeader();
        }
        if (index % 2 === 1) {
          doc.rect(startX, y - 3, columns.reduce((a, c) => a + c.width, 0), 16).fill('#f8fafc');
          doc.fillColor('#0f172a');
        }
        let x = startX;
        doc.fontSize(8);
        columns.forEach((c) => {
          doc.text(String(row[c.key] ?? '-'), x + 4, y, { width: c.width - 8, align: c.align ?? 'left' });
          x += c.width;
        });
        y += 16;
      });

      if (rows.length === 0) {
        doc.fillColor('#64748b').fontSize(9).text('No hay datos para los filtros seleccionados', startX + 4, y + 6);
      }

      doc.end();
    });
  }
}
