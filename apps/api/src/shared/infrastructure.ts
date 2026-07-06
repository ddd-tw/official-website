import { randomUUID } from "node:crypto";
import type { Clock, EmailMessage, EmailSender, IdGenerator } from "./ports";

export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
}

export class UuidGenerator implements IdGenerator {
  next(): string {
    return randomUUID();
  }
}

/** MVP email adapter — logs to the console. */
export class ConsoleEmailSender implements EmailSender {
  async send(message: EmailMessage): Promise<void> {
    console.log(
      `[email] to=${message.to} subject="${message.subject}"\n${message.body
        .split("\n")
        .map((l) => `[email]   ${l}`)
        .join("\n")}`,
    );
  }
}
