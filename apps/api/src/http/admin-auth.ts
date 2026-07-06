import type { MiddlewareHandler } from "hono";
import { ADMIN_TOKEN_HEADER } from "@dddtw/contracts";
import { UnauthorizedError } from "../shared/errors";

/** Admin & check-in routes share the x-admin-token guard (MVP 決議). */
export function adminAuth(adminToken: string): MiddlewareHandler {
  return async (c, next) => {
    if (c.req.header(ADMIN_TOKEN_HEADER) !== adminToken) {
      throw new UnauthorizedError("Missing or invalid admin token");
    }
    await next();
  };
}
