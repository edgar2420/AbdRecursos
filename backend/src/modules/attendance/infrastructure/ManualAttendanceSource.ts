import { NewAttendanceRecord } from '../domain/entities/AttendanceRecord';
import { AttendanceSourcePort, RawPunch } from '../application/ports/AttendanceSourcePort';

export class ManualAttendanceSource implements AttendanceSourcePort {
  readonly name = 'manual-web';

  async fetchPunches(): Promise<RawPunch[]> {
    return [];
  }

  toRecords(
    punches: RawPunch[],
    resolveEmployeeId: (code: string) => string | undefined,
  ): NewAttendanceRecord[] {
    const records: NewAttendanceRecord[] = [];
    const seen = new Map<string, number>();
    for (const punch of [...punches].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())) {
      const employeeId = resolveEmployeeId(punch.employeeCode);
      if (!employeeId) continue;
      const key = `${employeeId}:${punch.timestamp.toISOString().slice(0, 10)}`;
      const count = seen.get(key) ?? 0;
      seen.set(key, count + 1);
      records.push({
        employeeId,
        timestamp: punch.timestamp,
        type: punch.type ?? (count % 2 === 0 ? 'CHECK_IN' : 'CHECK_OUT'),
        source: 'IMPORT',
        deviceId: punch.deviceId ?? null,
      });
    }
    return records;
  }
}
