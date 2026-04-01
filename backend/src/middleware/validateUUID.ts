import type { Request, Response, NextFunction } from "express";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** For use with router.param("id", validateUUID("id")) */
export function validateUUID(_paramName: string) {
  return (_req: Request, res: Response, next: NextFunction, value: string): void => {
    if (!UUID_REGEX.test(value)) {
      res.status(400).json({ error: "Invalid ID format" });
      return;
    }
    next();
  };
}
