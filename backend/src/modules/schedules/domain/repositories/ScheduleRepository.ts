import { Paginated, PageQuery } from '../../../../shared/domain/pagination';
import {
  NewSchedule,
  NewScheduleAssignment,
  Schedule,
  ScheduleAssignment,
} from '../entities/Schedule';

export interface ScheduleRepository {
  findById(id: string): Promise<Schedule | null>;
  list(query: PageQuery & { isActive?: boolean }): Promise<Paginated<Schedule>>;
  create(data: NewSchedule): Promise<Schedule>;
  update(id: string, data: Partial<NewSchedule> & { isActive?: boolean }): Promise<Schedule>;

  listAssignments(
    query: PageQuery & { employeeId?: string; scheduleId?: string; departmentId?: string; at?: Date },
  ): Promise<Paginated<ScheduleAssignment>>;
  assign(data: NewScheduleAssignment): Promise<ScheduleAssignment>;
  endAssignment(id: string, validUntil: Date): Promise<ScheduleAssignment>;
  findActiveForEmployee(employeeId: string, at: Date): Promise<ScheduleAssignment | null>;
  findActiveForEmployees(employeeIds: string[], at: Date): Promise<ScheduleAssignment[]>;
  hasOverlappingAssignment(employeeId: string, from: Date, to: Date | null): Promise<boolean>;
}
