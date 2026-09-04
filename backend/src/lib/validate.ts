import { NextFunction, Request, Response } from 'express';
import { ZodSchema } from 'zod';

/**
 * Validates req.body against a zod schema. On success, req.body is replaced
 * with the parsed (and — for object schemas — allow-listed, since zod strips
 * unrecognized keys by default) result, so downstream handlers never see raw,
 * unvalidated client input.
 */
export function validateBody(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error.issues.map(i => `${i.path.join('.') || 'body'}: ${i.message}`).join('; '),
        timestamp: new Date().toISOString(),
      });
    }
    req.body = result.data;
    next();
  };
}
