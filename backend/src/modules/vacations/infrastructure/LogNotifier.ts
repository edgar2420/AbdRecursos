import { logger } from '../../../shared/infrastructure/logger/logger';
import { Notification, NotifierPort } from '../application/ports/NotifierPort';

export class LogNotifier implements NotifierPort {
  async notify(notification: Notification): Promise<void> {
    logger.info({ notification }, 'Notificacion emitida');
  }
}
