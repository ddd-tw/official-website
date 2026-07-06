/**
 * Domain error hierarchy. The HTTP layer maps `code` → status; domain and
 * application layers never know about HTTP.
 */
export class DomainError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class NotFoundError extends DomainError {
  constructor(message = "Resource not found") {
    super("NOT_FOUND", message);
  }
}

export class ValidationError extends DomainError {
  constructor(message: string) {
    super("VALIDATION_ERROR", message);
  }
}

export class UnauthorizedError extends DomainError {
  constructor(message = "Unauthorized") {
    super("UNAUTHORIZED", message);
  }
}

/** Business-rule conflicts (HTTP 409). `code` carries the specific rule. */
export class ConflictError extends DomainError {}

export class SoldOutError extends ConflictError {
  constructor(message = "Ticket type is sold out") {
    super("SOLD_OUT", message);
  }
}

export class SalesClosedError extends ConflictError {
  constructor(message = "Ticket sales are not open") {
    super("SALES_CLOSED", message);
  }
}

export class AlreadyCancelledError extends ConflictError {
  constructor(message = "Registration is already cancelled") {
    super("ALREADY_CANCELLED", message);
  }
}

export class InvalidStateError extends ConflictError {
  constructor(message: string) {
    super("INVALID_STATE", message);
  }
}
