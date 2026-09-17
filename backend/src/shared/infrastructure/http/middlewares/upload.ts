import multer from 'multer';
import { env } from '../../config/env';
import { ValidationError } from '../../../domain/errors';

const EXCEL_MIME = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
];

export const uploadExcel = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.UPLOAD_MAX_MB * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (!EXCEL_MIME.includes(file.mimetype) && !/\.xlsx?$/i.test(file.originalname)) {
      cb(new ValidationError('Solo se aceptan archivos Excel (.xlsx)'));
      return;
    }
    cb(null, true);
  },
});

export const uploadDocument = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.UPLOAD_MAX_MB * 1024 * 1024, files: 1 },
});

const ADJUNTO_MIME = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

export const uploadAttachment = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.UPLOAD_MAX_MB * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (!ADJUNTO_MIME.includes(file.mimetype)) {
      cb(new ValidationError('Solo se aceptan imagenes (jpg, png, webp) o PDF'));
      return;
    }
    cb(null, true);
  },
});
