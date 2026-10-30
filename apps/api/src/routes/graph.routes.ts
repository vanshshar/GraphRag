import { Router, type Request, type Response, type NextFunction } from 'express';
import type { IGraphRepository } from '../repositories/types.js';

export function createGraphRouter(graphRepo: IGraphRepository): Router {
  const router = Router();

  // GET /api/v1/graph/stats
  router.get('/stats', async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const stats = await graphRepo.getStats();
      res.status(200).json({ stats });
    } catch (err) {
      next(err);
    }
  });

  return router;
}

