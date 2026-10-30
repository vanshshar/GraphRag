import { Router, type Request, type Response, type NextFunction } from 'express';
import { validateBody } from '../middleware/validate.js';
import { chatQueryRequestSchema } from '../schemas/chat.schema.js';
import type { AnsweringService } from '../services/answering.service.js';

export function createChatRouter(answeringService: AnsweringService): Router {
  const router = Router();

  // POST /api/v1/chat/query
  router.post(
    '/query',
    validateBody(chatQueryRequestSchema),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const { question, topK, maxHops } = req.body;
        const result = await answeringService.answerQuestion(question, req.id, {
          topK,
          maxHops,
        });
        res.status(200).json(result);
      } catch (err) {
        next(err);
      }
    }
  );

  return router;
}

