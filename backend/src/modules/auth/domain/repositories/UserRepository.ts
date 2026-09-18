import { Paginated, PageQuery } from '../../../../shared/domain/pagination';
import { NewUser, Role, User, UserWithSecret } from '../entities/User';

export interface UserRepository {
  findByEmail(email: string): Promise<UserWithSecret | null>;
  findById(id: string): Promise<UserWithSecret | null>;
  findByEmployeeId(employeeId: string): Promise<User | null>;
  findForLogin(employeeCode: string, lastName: string): Promise<UserWithSecret | null>;
  list(query: PageQuery & { role?: Role; isActive?: boolean }): Promise<Paginated<User>>;
  create(data: NewUser): Promise<User>;
  updatePassword(id: string, passwordHash: string, mustChangePassword: boolean): Promise<void>;
  updateRole(id: string, role: Role): Promise<User>;
  setActive(id: string, isActive: boolean): Promise<User>;
  touchLastLogin(id: string): Promise<void>;
}
