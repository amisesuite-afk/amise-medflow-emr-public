import { type Request, type Response, type NextFunction } from 'express';

export const AI_DISABLED = process.env.DISABLE_AI === 'true';

export function aiDisabledMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (AI_DISABLED) {
    res.status(503).json({
      error: 'AI features are temporarily disabled (DISABLE_AI=true). Re-enable the service to use this feature.',
      disabled: true,
    });
    return;
  }
  next();
}
