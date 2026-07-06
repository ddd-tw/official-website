import type { Context } from "hono";
import type { ApiError } from "@dddtw/contracts";
import {
  ConflictError,
  DomainError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from "../shared/errors";

type ErrorStatus = 401 | 404 | 409 | 422 | 500;

function statusOf(error: DomainError): ErrorStatus {
  if (error instanceof NotFoundError) return 404;
  if (error instanceof ValidationError) return 422;
  if (error instanceof UnauthorizedError) return 401;
  if (error instanceof ConflictError) return 409;
  return 500;
}

/** Maps domain errors to the contract's ApiError envelope. */
export function handleError(error: Error, c: Context): Response {
  if (error instanceof DomainError) {
    const body: ApiError = { error: { code: error.code, message: error.message } };
    return c.json(body, statusOf(error));
  }
  console.error("[api] unhandled error:", error);
  const body: ApiError = { error: { code: "INTERNAL_ERROR", message: "Internal server error" } };
  return c.json(body, 500);
}
