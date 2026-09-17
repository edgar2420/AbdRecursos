import PDFDocument from 'pdfkit';
import { env } from '../config/env';

export interface PayslipLineView {
  concept: string;
  quantity?: number | null;
  amount: number;
}

export interface PayslipView {
  periodLabel: string;
  employee: {
    fullName: string;
    ci: string;
    employeeCode: string;
    position: string;
    department: string;
    hireDate: string;
    afpName: string;
    bankAccount: string;
  };
  workedDays: number;
  earnings: PayslipLineView[];
  deductions: PayslipLineView[];
  totalEarnings: number;
  totalDeductions: number;
  netPay: number;
  authorizedByName?: string | null;
}

export interface PayslipPdfPort {
  render(view: PayslipView): Promise<Buffer>;
}

const BLUE = '#0e7490';
const DARK = '#0f172a';
const GRAY = '#64748b';

export class PayslipPdfGenerator implements PayslipPdfPort {
  render(view: PayslipView): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 40 });
      const chunks: Buffer[] = [];
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      this.header(doc, view);
      this.employeeBlock(doc, view);
      const tableTop = doc.y + 10;
      const leftEnd = this.linesTable(doc, 40, tableTop, 250, 'HABERES', view.earnings, view.totalEarnings);
      const rightEnd = this.linesTable(doc, 305, tableTop, 250, 'DESCUENTOS', view.deductions, view.totalDeductions);

      doc.y = Math.max(leftEnd, rightEnd) + 24;
      this.netBlock(doc, view);
      this.footer(doc, view);
      doc.end();
    });
  }

  private header(doc: PDFKit.PDFDocument, view: PayslipView): void {
    doc.rect(40, 40, 515, 56).fill(BLUE);
    doc.fillColor('#ffffff').fontSize(15).font('Helvetica-Bold').text(env.COMPANY_NAME, 54, 54);
    doc.fontSize(9).font('Helvetica').text(`NIT ${env.COMPANY_NIT}  |  ${env.COMPANY_CITY}`, 54, 74);
    doc
      .fontSize(12)
      .font('Helvetica-Bold')
      .text('BOLETA DE PAGO', 300, 56, { width: 240, align: 'right' })
      .fontSize(10)
      .font('Helvetica')
      .text(view.periodLabel, 300, 74, { width: 240, align: 'right' });
    doc.fillColor(DARK).moveDown(2);
    doc.y = 112;
  }

  private employeeBlock(doc: PDFKit.PDFDocument, view: PayslipView): void {
    const e = view.employee;
    const rows: [string, string][] = [
      ['Empleado', e.fullName],
      ['Codigo', e.employeeCode],
      ['C.I.', e.ci],
      ['Cargo', e.position],
      ['Departamento', e.department],
      ['Fecha de ingreso', e.hireDate],
      ['AFP', e.afpName],
      ['Cuenta bancaria', e.bankAccount],
      ['Dias trabajados', String(view.workedDays)],
    ];
    const startY = doc.y;
    rows.forEach((row, i) => {
      const col = i % 2;
      const line = Math.floor(i / 2);
      const x = 40 + col * 258;
      const y = startY + line * 16;
      doc.fontSize(8).fillColor(GRAY).font('Helvetica').text(row[0].toUpperCase(), x, y, { width: 90 });
      doc.fontSize(9).fillColor(DARK).font('Helvetica-Bold').text(row[1] || '-', x + 92, y - 1, { width: 160 });
    });
    doc.y = startY + Math.ceil(rows.length / 2) * 16 + 8;
  }

  private linesTable(
    doc: PDFKit.PDFDocument,
    x: number,
    y: number,
    width: number,
    title: string,
    lines: PayslipLineView[],
    total: number,
  ): number {
    doc.rect(x, y, width, 20).fill('#e0f2fe');
    doc.fillColor(BLUE).fontSize(9).font('Helvetica-Bold').text(title, x + 8, y + 6);
    let cursor = y + 26;
    doc.font('Helvetica').fontSize(9).fillColor(DARK);
    lines.forEach((line) => {
      doc.text(line.concept, x + 8, cursor, { width: width - 100 });
      doc.text(money(line.amount), x + width - 92, cursor, { width: 84, align: 'right' });
      cursor += 15;
    });
    if (lines.length === 0) {
      doc.fillColor(GRAY).text('Sin registros', x + 8, cursor);
      cursor += 15;
    }
    doc.moveTo(x, cursor + 2).lineTo(x + width, cursor + 2).strokeColor('#cbd5e1').stroke();
    doc.font('Helvetica-Bold').fillColor(DARK);
    doc.text('TOTAL', x + 8, cursor + 8);
    doc.text(money(total), x + width - 92, cursor + 8, { width: 84, align: 'right' });
    return cursor + 24;
  }

  private netBlock(doc: PDFKit.PDFDocument, view: PayslipView): void {
    const y = doc.y;
    doc.rect(40, y, 515, 34).fill(BLUE);
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(11).text('LIQUIDO PAGABLE', 54, y + 11);
    doc.fontSize(13).text(money(view.netPay) + ' Bs', 300, y + 9, { width: 240, align: 'right' });
    doc.fillColor(DARK);
    doc.y = y + 50;
  }

  private footer(doc: PDFKit.PDFDocument, view: PayslipView): void {
    const y = doc.y + 40;
    doc.strokeColor('#94a3b8');
    doc.moveTo(70, y).lineTo(230, y).stroke();
    doc.moveTo(330, y).lineTo(490, y).stroke();

    if (view.authorizedByName) {
      doc.fontSize(9).fillColor(DARK).font('Helvetica-Bold').text(view.authorizedByName, 330, y - 13, {
        width: 160,
        align: 'center',
      });
    }

    doc.fontSize(8).fillColor(GRAY).font('Helvetica');
    doc.text('Firma del empleado', 70, y + 6, { width: 160, align: 'center' });
    doc.text('Firma autorizada · RRHH', 330, y + 6, { width: 160, align: 'center' });
    doc.fontSize(7).text(
      'Documento generado por el sistema SGRH. Los importes estan expresados en bolivianos (Bs).',
      40,
      y + 40,
      { width: 515, align: 'center' },
    );
  }
}

function money(value: number): string {
  return value.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
