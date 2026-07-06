import { ValidationError } from "../../../shared/errors";

/** Attendee value object — validated at construction, immutable. */
export interface AttendeeProps {
  name: string;
  email: string;
  phone?: string;
  diet?: string;
  note?: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class Attendee {
  private constructor(
    public readonly name: string,
    public readonly email: string,
    public readonly phone: string | undefined,
    public readonly diet: string | undefined,
    public readonly note: string | undefined,
  ) {}

  static create(props: AttendeeProps): Attendee {
    const name = props.name?.trim();
    const email = props.email?.trim().toLowerCase();
    if (!name) throw new ValidationError("attendee.name is required");
    if (!email || !EMAIL_RE.test(email)) throw new ValidationError("attendee.email must be a valid email");
    return new Attendee(name, email, props.phone?.trim() || undefined, props.diet?.trim() || undefined, props.note?.trim() || undefined);
  }

  emailMatches(email: string): boolean {
    return this.email === email.trim().toLowerCase();
  }
}
