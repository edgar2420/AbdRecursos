/**
 * Puerto de notificaciones (2.2: avisos de solicitud y aprobacion/rechazo).
 * El adaptador por defecto solo registra en el log; se puede sustituir por
 * correo o push sin tocar los casos de uso.
 */
export interface Notification {
  type: string;
  employeeId: string;
  title: string;
  message: string;
  referenceId?: string;
}

export interface NotifierPort {
  notify(notification: Notification): Promise<void>;
}
