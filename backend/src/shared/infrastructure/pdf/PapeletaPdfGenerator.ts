import PDFDocument from 'pdfkit';
import path from 'node:path';

const LOGO_PATH = path.join(__dirname, 'assets', 'logo-abd.png');

export interface PapeletaFirmaView {
  rol: string;
  nombre: string;
  fecha: string;
  sello: string;
}

export interface PapeletaView {
  numero: string;
  tipo: 'HORAS_EXTRAS' | 'SALIDA';
  estado: string;
  empleado: string;
  codigo: string;
  area: string;
  fechaTexto: string;
  trabajoRealizado?: string | null;
  desde?: string | null;
  hasta?: string | null;
  totalHoras?: string | null;
  recargo?: string | null;
  salidaMotivo?: 'PARTICULAR' | 'OFICIAL' | 'MEDICA' | null;
  motivo?: string | null;
  tiempoSolicitado?: string | null;
  horaSalida?: string | null;
  horaRetorno?: string | null;
  firmas: PapeletaFirmaView[];
  attachmentImage?: Buffer | null;
  attachmentUrl?: string | null;
}

const AZUL = '#2c3a8c';
const TINTA = '#1f2933';
const GRIS = '#6b7280';
const RESALTE = '#e8e7c8';

export class PapeletaPdfGenerator {
  render(view: PapeletaView): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: [595, 420], margin: 28 });
      const chunks: Buffer[] = [];
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const x = 28;
      const ancho = 539;

      doc.rect(x, 24, ancho, 372).lineWidth(1.4).strokeColor(TINTA).stroke();

      try {
        doc.image(LOGO_PATH, x + 14, 34, { height: 30 });
      } catch {
        doc.fillColor(GRIS).fontSize(6.5).font('Helvetica').text('LABORATORIOS', x + 14, 36);
        doc.fillColor(AZUL).fontSize(22).font('Helvetica-Bold').text('ABD', x + 14, 44);
      }

      doc
        .fillColor(TINTA)
        .fontSize(13)
        .font('Helvetica-Bold')
        .text('Departamento de RRHH', x + 150, 44, { width: ancho - 170, align: 'center' });

      doc.rect(x + 90, 66, ancho - 104, 22).fill(RESALTE);
      doc
        .fillColor(TINTA)
        .fontSize(13)
        .font('Helvetica-BoldOblique')
        .text(
          view.tipo === 'HORAS_EXTRAS' ? 'PAPELETA DE HORAS EXTRAS' : 'PAPELETA DE SALIDA',
          x + 90,
          71,
          { width: ancho - 104, align: 'center' },
        );

      doc.moveTo(x, 96).lineTo(x + ancho, 96).lineWidth(1.2).strokeColor(TINTA).stroke();

      doc.rect(x + ancho - 150, 104, 136, 30).lineWidth(1).strokeColor(TINTA).stroke();
      doc.fillColor(GRIS).fontSize(6.5).font('Helvetica').text('N.o DE PAPELETA', x + ancho - 146, 108);
      doc.fillColor(AZUL).fontSize(11).font('Helvetica-Bold').text(view.numero, x + ancho - 146, 118);

      let y = 112;
      const campo = (etiqueta: string, valor: string, ancho2 = 300): void => {
        doc.fillColor(TINTA).fontSize(9.5).font('Helvetica-Oblique').text(etiqueta, x + 14, y);
        const dx = doc.widthOfString(etiqueta) + 6;
        doc.font('Helvetica-Bold').fontSize(9.5).text(valor || '-', x + 14 + dx, y, { width: ancho2 });
        doc
          .moveTo(x + 14 + dx, y + 12)
          .lineTo(x + 14 + dx + ancho2, y + 12)
          .lineWidth(0.4)
          .strokeColor('#9ca3af')
          .stroke();
        y += 24;
      };

      if (view.tipo === 'HORAS_EXTRAS') {
        campo('NOMBRE:', view.empleado, 300);
        campo('AREA:', view.area, 380);
        campo('TRABAJO REALIZADO:', view.trabajoRealizado ?? '', 300);
        campo('TIEMPO:   de', `${view.desde ?? ''}    a    ${view.hasta ?? ''}`, 320);
        y += 6;
        doc.fillColor(TINTA).fontSize(10).font('Helvetica-Oblique').text('TOTAL HORAS', x + 14, y);
        doc
          .font('Helvetica-Bold')
          .fontSize(12)
          .text(`${view.totalHoras ?? '-'}  (${view.recargo ?? ''})`, x + 110, y - 1);
        y += 26;
      } else {
        const casillas: ('PARTICULAR' | 'OFICIAL' | 'MEDICA')[] = ['PARTICULAR', 'OFICIAL', 'MEDICA'];
        casillas.forEach((casilla, i) => {
          const cx = x + 14 + i * 120;
          doc.rect(cx, y, 92, 24).lineWidth(1).strokeColor(TINTA).stroke();
          if (view.salidaMotivo === casilla) {
            doc.fillColor(AZUL).fontSize(15).font('Helvetica-Bold').text('X', cx + 38, y + 5);
          }
          doc.fillColor(TINTA).fontSize(8.5).font('Helvetica-Oblique').text(casilla, cx, y + 28, {
            width: 92,
            align: 'center',
          });
        });
        y += 50;
        campo('NOMBRE:', view.empleado, 320);
        campo('DEPENDENCIA:', view.area, 300);
        campo('TIEMPO SOLICITADO:', view.tiempoSolicitado ?? '', 280);
        campo('MOTIVO:', view.motivo ?? '', 330);

        doc.fillColor(TINTA).fontSize(9).font('Helvetica-Bold').text(view.horaSalida ?? '-', x + 20, y);
        doc.text(view.horaRetorno ?? '-', x + 130, y);
        doc.fontSize(8).font('Helvetica-Oblique').fillColor(GRIS);
        doc.text('HORA DE SALIDA', x + 14, y + 14);
        doc.text('HORA DE RETORNO', x + 124, y + 14);
        y += 34;

        if (view.salidaMotivo === 'MEDICA' && (view.attachmentImage || view.attachmentUrl)) {
          const cajaX = x + ancho - 168;
          const cajaY = 150;
          doc.rect(cajaX, cajaY, 150, 108).lineWidth(1).dash(2, { space: 2 }).strokeColor('#9ca3af').stroke();
          doc.undash();
          if (view.attachmentImage) {
            try {
              doc.image(view.attachmentImage, cajaX + 5, cajaY + 5, { fit: [140, 84], align: 'center', valign: 'center' });
            } catch {
              doc.fillColor(GRIS).fontSize(7.5).font('Helvetica-Oblique').text('No se pudo mostrar la imagen', cajaX + 10, cajaY + 40, { width: 130, align: 'center' });
            }
          } else {
            doc.fillColor(GRIS).fontSize(7.5).font('Helvetica-Oblique').text('Certificado en PDF adjunto al registro digital', cajaX + 10, cajaY + 40, { width: 130, align: 'center' });
          }
          doc.fillColor(TINTA).fontSize(7).font('Helvetica-Bold').text('CERTIFICADO MEDICO ADJUNTO', cajaX, cajaY + 94, { width: 150, align: 'center' });
        }
      }

      const yFirmas = 320;
      doc.fillColor(TINTA).fontSize(8.5).font('Helvetica-Oblique').text('Autorizado por:', x + 14, yFirmas + 14);

      const posiciones = [x + 150, x + 350];
      view.firmas.slice(0, 2).forEach((firma, i) => {
        const fx = posiciones[i];
        doc
          .moveTo(fx, yFirmas + 12)
          .lineTo(fx + 170, yFirmas + 12)
          .lineWidth(0.8)
          .strokeColor(TINTA)
          .stroke();
        doc.fillColor(AZUL).fontSize(8).font('Helvetica-Bold').text(firma.nombre, fx, yFirmas - 12, {
          width: 170,
          align: 'center',
        });
        doc.fillColor(GRIS).fontSize(6.5).font('Helvetica').text(`firmado ${firma.fecha}`, fx, yFirmas - 2, {
          width: 170,
          align: 'center',
        });
        doc.fillColor(TINTA).fontSize(8.5).font('Helvetica-Oblique').text(firma.rol, fx, yFirmas + 15, {
          width: 170,
          align: 'center',
        });
        doc.fillColor(GRIS).fontSize(6).font('Courier').text(`sello ${firma.sello}`, fx, yFirmas + 26, {
          width: 170,
          align: 'center',
        });
      });

      if (view.firmas.length === 0) {
        doc
          .fillColor(GRIS)
          .fontSize(8)
          .font('Helvetica-Oblique')
          .text('Sin firmas todavia', x + 150, yFirmas + 14, { width: 370, align: 'center' });
      }

      doc
        .fillColor(TINTA)
        .fontSize(9)
        .font('Helvetica-Oblique')
        .text(view.fechaTexto, x + 14, 372);

      doc
        .fillColor(GRIS)
        .fontSize(6.5)
        .font('Helvetica')
        .text(
          `Documento digital · estado: ${view.estado} · verificable por su numero y sello de firma`,
          x + 14,
          384,
          { width: ancho - 28, align: 'right' },
        );

      doc.end();
    });
  }
}
