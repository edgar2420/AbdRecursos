import { Response } from 'express';
import { z } from 'zod';
import { ValidationError } from '../../../../shared/domain/errors';
import { AuthenticatedRequest, requireActor } from '../../../../shared/infrastructure/http/types';
import { validated } from '../../../../shared/infrastructure/http/middlewares/validate';
import { UploadImportFile } from '../../application/use-cases/UploadImportFile';
import { ConfirmImport } from '../../application/use-cases/ConfirmImport';
import {
  DownloadImportLog,
  DownloadImportTemplate,
  GetImportPreview,
  ListImports,
} from '../../application/use-cases/ListImports';
import { listImportsSchema, templateQuerySchema } from './import.validators';

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export class ImportController {
  constructor(
    private readonly uploadUseCase: UploadImportFile,
    private readonly confirmUseCase: ConfirmImport,
    private readonly listUseCase: ListImports,
    private readonly previewUseCase: GetImportPreview,
    private readonly logUseCase: DownloadImportLog,
    private readonly templateUseCase: DownloadImportTemplate,
  ) {}

  list = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const query = validated<z.infer<typeof listImportsSchema>>(req, 'query');
    res.json(await this.listUseCase.execute(requireActor(req), query));
  };

  upload = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const file = (req as unknown as { file?: Express.Multer.File }).file;
    if (!file) throw new ValidationError('Adjunte un archivo Excel en el campo "file"');
    const preview = await this.uploadUseCase.execute(requireActor(req), req.body.type, file);
    res.status(201).json({ data: preview });
  };

  preview = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    res.json({ data: await this.previewUseCase.execute(requireActor(req), req.params.id) });
  };

  confirm = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    res.json({ data: await this.confirmUseCase.execute(requireActor(req), req.params.id) });
  };

  log = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { buffer, fileName } = await this.logUseCase.execute(requireActor(req), req.params.id);
    res.setHeader('Content-Type', XLSX_MIME);
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(buffer);
  };

  template = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { type } = validated<z.infer<typeof templateQuerySchema>>(req, 'query');
    const { buffer, fileName } = await this.templateUseCase.execute(requireActor(req), type);
    res.setHeader('Content-Type', XLSX_MIME);
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(buffer);
  };
}
