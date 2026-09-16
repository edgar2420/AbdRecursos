import { logger } from '../../../shared/infrastructure/logger/logger';
import { Notification, NotifierPort } from '../application/ports/NotifierPort';

/** Adaptador inicial: deja la notificacion en el log estructurado. */
export class LogNotifier implements NotifierPort {
  async notify(notification: Notification): Promise<void> {
    logger.info({ notification }, 'Notificacion emitida');
  }
}
