/** Shared ports (DIP): defined here, implemented in infrastructure. */

export interface Clock {
  now(): Date;
}

export interface IdGenerator {
  next(): string;
}

export interface EmailMessage {
  to: string;
  subject: string;
  body: string;
}

export interface EmailSender {
  send(message: EmailMessage): Promise<void>;
}
