import { CookieOptions, Response } from 'express';
import { z } from 'zod';
import { env } from '../../../../shared/infrastructure/config/env';
import { AuthenticatedRequest, requireActor } from '../../../../shared/infrastructure/http/types';
import { validated } from '../../../../shared/infrastructure/http/middlewares/validate';
import { Login } from '../../application/use-cases/Login';
import { RefreshSession } from '../../application/use-cases/RefreshSession';
import { Logout } from '../../application/use-cases/Logout';
import { ChangePassword } from '../../application/use-cases/ChangePassword';
import {
  CreateUser,
  ListUsers,
  ResetUserPassword,
  SetUserActive,
  UpdateUserRole,
} from '../../application/use-cases/ManageUsers';
import { UserRepository } from '../../domain/repositories/UserRepository';
import { listUsersSchema } from './auth.validators';

export const REFRESH_COOKIE = 'sgrh_refresh';

function refreshCookieOptions(expiresAt: Date): CookieOptions {
  return {
    httpOnly: true,
    secure: env.useSecureCookies,
    sameSite: 'strict',
    expires: expiresAt,
    path: `${env.API_PREFIX}/auth`,
  };
}

export class AuthController {
  constructor(
    private readonly loginUseCase: Login,
    private readonly refreshUseCase: RefreshSession,
    private readonly logoutUseCase: Logout,
    private readonly changePasswordUseCase: ChangePassword,
    private readonly listUsersUseCase: ListUsers,
    private readonly createUserUseCase: CreateUser,
    private readonly updateRoleUseCase: UpdateUserRole,
    private readonly setActiveUseCase: SetUserActive,
    private readonly resetPasswordUseCase: ResetUserPassword,
    private readonly users: UserRepository,
  ) {}

  login = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const result = await this.loginUseCase.execute({
      username: req.body.username,
      password: req.body.password,
      ip: req.ip,
      userAgent: req.header('user-agent'),
    });
    res.cookie(REFRESH_COOKIE, result.refreshToken, refreshCookieOptions(result.refreshExpiresAt));
    res.json({ data: { accessToken: result.accessToken, user: result.user } });
  };

  refresh = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const raw = req.cookies?.[REFRESH_COOKIE] as string | undefined;
    const result = await this.refreshUseCase.execute(raw ?? '', {
      ip: req.ip,
      userAgent: req.header('user-agent'),
    });
    res.cookie(REFRESH_COOKIE, result.refreshToken, refreshCookieOptions(result.refreshExpiresAt));
    res.json({ data: { accessToken: result.accessToken } });
  };

  logout = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    await this.logoutUseCase.execute(req.cookies?.[REFRESH_COOKIE]);
    res.clearCookie(REFRESH_COOKIE, { path: `${env.API_PREFIX}/auth` });
    res.status(204).send();
  };

  me = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const user = await this.users.findById(actor.userId);
    res.json({
      data: {
        id: actor.userId,
        email: actor.email,
        role: actor.role,
        employeeId: actor.employeeId,
        lastLoginAt: user?.lastLoginAt ?? null,
      },
    });
  };

  changePassword = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const actor = requireActor(req);
    await this.changePasswordUseCase.execute(actor.userId, req.body.currentPassword, req.body.newPassword);
    res.clearCookie(REFRESH_COOKIE, { path: `${env.API_PREFIX}/auth` });
    res.status(204).send();
  };

  listUsers = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const query = validated<z.infer<typeof listUsersSchema>>(req, 'query');
    res.json(await this.listUsersUseCase.execute(query));
  };

  createUser = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const user = await this.createUserUseCase.execute(req.body, actor.userId);
    res.status(201).json({ data: user });
  };

  updateRole = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const actor = requireActor(req);
    res.json({ data: await this.updateRoleUseCase.execute(req.params.id, req.body.role, actor.userId) });
  };

  setActive = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const actor = requireActor(req);
    res.json({ data: await this.setActiveUseCase.execute(req.params.id, req.body.isActive, actor.userId) });
  };

  resetPassword = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const actor = requireActor(req);
    await this.resetPasswordUseCase.execute(req.params.id, req.body.newPassword, actor.userId);
    res.status(204).send();
  };
}
