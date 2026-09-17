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
