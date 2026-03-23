import type { Request, Response, NextFunction, RequestHandler } from "express";

/**
 * Wraps an async route handler to catch rejected promises and forward to Express error handler.
 * Express 4 does not natively catch async errors - this prevents unhandled promise rejections.
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>
): RequestHandler {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
}
