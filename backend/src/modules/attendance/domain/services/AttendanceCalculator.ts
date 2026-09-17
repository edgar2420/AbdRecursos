import { isoWeekDay, timeToMinutes } from '../../../../shared/domain/dates';
import { round2 } from '../../../../shared/domain/money';
import { LEGAL_KEYS } from '../../../legal-parameters/domain/parameter-keys';
import { LegalParameterSet } from '../../../legal-parameters/domain/services/LegalParameterSet';
import { AttendanceRecord } from '../entities/AttendanceRecord';

export interface DaySchedule {
  startTime: string;
  endTime: string;
  toleranceMinutes: number;
  breakMinutes: number;
  weekDays: number[];
}

export type DayStatus = 'PRESENT' | 'LATE' | 'ABSENT' | 'INCOMPLETE' | 'REST' | 'JUSTIFIED';

export interface DaySummary {
  date: Date;
  firstIn: Date | null;
  lastOut: Date | null;
  workedHours: number;
  lateMinutes: number;
  overtimeHours: number;
  status: DayStatus;
}

export class AttendanceCalculator {
  constructor(private readonly params: LegalParameterSet) {}

  lateMinutesFor(timestamp: Date, schedule: DaySchedule | null): number {
    if (!schedule) return 0;
    const expected = timeToMinutes(schedule.startTime) + schedule.toleranceMinutes;
    const actual = timestamp.getHours() * 60 + timestamp.getMinutes();
    return Math.max(0, actual - expected);
  }

  summarizeDay(
    date: Date,
    records: AttendanceRecord[],
    schedule: DaySchedule | null,
    options: { isJustified?: boolean } = {},
  ): DaySummary {
    const ordered = [...records].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    const firstIn = ordered.find((r) => r.type === 'CHECK_IN')?.timestamp ?? null;
    const lastOut = [...ordered].reverse().find((r) => r.type === 'CHECK_OUT')?.timestamp ?? null;

    const isWorkDay = schedule ? schedule.weekDays.includes(isoWeekDay(date)) : isoWeekDay(date) <= 5;

    if (!firstIn && !lastOut) {
      return {
        date,
        firstIn: null,
        lastOut: null,
        workedHours: 0,
        lateMinutes: 0,
        overtimeHours: 0,
        status: !isWorkDay ? 'REST' : options.isJustified ? 'JUSTIFIED' : 'ABSENT',
      };
    }

    const lateMinutes = firstIn ? this.lateMinutesFor(firstIn, schedule) : 0;

    if (!firstIn || !lastOut) {
      return { date, firstIn, lastOut, workedHours: 0, lateMinutes, overtimeHours: 0, status: 'INCOMPLETE' };
    }

    const grossMinutes = (lastOut.getTime() - firstIn.getTime()) / 60000;
    const workedMinutes = Math.max(0, grossMinutes - (schedule?.breakMinutes ?? 0));
    const expectedMinutes = schedule
      ? this.scheduledMinutes(schedule)
      : this.params.number(LEGAL_KEYS.WORK_HOURS_PER_DAY, 8) * 60;

    return {
      date,
      firstIn,
      lastOut,
      workedHours: round2(workedMinutes / 60),
      lateMinutes,
      overtimeHours: round2(Math.max(0, workedMinutes - expectedMinutes) / 60),
      status: lateMinutes > 0 ? 'LATE' : 'PRESENT',
    };
  }

  private scheduledMinutes(schedule: DaySchedule): number {
    const start = timeToMinutes(schedule.startTime);
    let end = timeToMinutes(schedule.endTime);
    if (end <= start) end += 24 * 60;
    return end - start - schedule.breakMinutes;
  }
}
