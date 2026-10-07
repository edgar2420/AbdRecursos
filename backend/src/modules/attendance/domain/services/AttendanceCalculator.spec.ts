import { describe, expect, it } from 'vitest';
import { LegalParameterSet } from '../../../legal-parameters/domain/services/LegalParameterSet';
import { AttendanceRecord } from '../entities/AttendanceRecord';
import { AttendanceCalculator, DaySchedule } from './AttendanceCalculator';

const calc = new AttendanceCalculator(new LegalParameterSet([], new Date(2026, 9, 1)));
const dia = new Date(2026, 9, 7); // miercoles

const administrativo: DaySchedule = {
  startTime: '08:30',
  endTime: '17:00',
  toleranceMinutes: 10,
  breakMinutes: 60,
  weekDays: [1, 2, 3, 4, 5],
};

function marca(hora: string, type: 'CHECK_IN' | 'CHECK_OUT'): AttendanceRecord {
  const [h, m] = hora.split(':').map(Number);
  return { timestamp: new Date(2026, 9, 7, h, m), type } as AttendanceRecord;
}

describe('AttendanceCalculator: almuerzo', () => {
  it('descuenta el almuerzo del horario cuando no se marca', () => {
    const r = calc.summarizeDay(dia, [marca('08:30', 'CHECK_IN'), marca('17:00', 'CHECK_OUT')], administrativo);
    expect(r.workedHours).toBe(7.5);
    expect(r.overtimeHours).toBe(0);
  });

  it('con almuerzo de 2 horas descuenta 2 horas', () => {
    const r = calc.summarizeDay(dia, [marca('08:00', 'CHECK_IN'), marca('18:00', 'CHECK_OUT')], {
      ...administrativo,
      startTime: '08:00',
      endTime: '18:00',
      breakMinutes: 120,
    });
    expect(r.workedHours).toBe(8);
  });

  it('si se marca el almuerzo, descuenta la pausa real', () => {
    const r = calc.summarizeDay(
      dia,
      [marca('08:30', 'CHECK_IN'), marca('12:00', 'CHECK_OUT'), marca('13:30', 'CHECK_IN'), marca('17:00', 'CHECK_OUT')],
      administrativo,
    );
    expect(r.workedHours).toBe(7); // 8.5 h brutas - 1.5 h de pausa real
  });

  it('sin horario no descuenta almuerzo', () => {
    const r = calc.summarizeDay(dia, [marca('08:30', 'CHECK_IN'), marca('17:00', 'CHECK_OUT')], null);
    expect(r.workedHours).toBe(8.5);
  });

  it('las horas extra no cuentan el almuerzo', () => {
    const r = calc.summarizeDay(dia, [marca('08:30', 'CHECK_IN'), marca('18:00', 'CHECK_OUT')], administrativo);
    expect(r.workedHours).toBe(8.5);
    expect(r.overtimeHours).toBe(1);
  });
});
