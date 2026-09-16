import { Router } from 'express';
import { asyncHandler } from './middlewares/async-handler';
import { uploadAttachment } from './middlewares/upload';
import { UploadController } from './upload.controller';

export function uploadRoutes(controller: UploadController): Router {
  const router = Router();
  router.post('/', uploadAttachment.single('file'), asyncHandler(controller.subir));
  router.get('/:nombre', asyncHandler(controller.obtener));
  return router;
}
