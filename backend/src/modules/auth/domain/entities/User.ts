export type Role = 'EMPLOYEE' | 'SUPERVISOR' | 'HR' | 'ADMIN';

export const ROLES: Role[] = ['EMPLOYEE', 'SUPERVISOR', 'HR', 'ADMIN'];

export interface User {
  id: string;
  email: string;
  role: Role;
  isActive: boolean;
  mustChangePassword: boolean;
  employeeId: string | null;
  lastLoginAt: Date | null;
  createdAt: Date;
}

export interface UserWithSecret extends User {
  passwordHash: string;
}

export interface NewUser {
  email: string;
  passwordHash: string;
  role: Role;
  employeeId?: string | null;
}
