import type { FastifyPluginAsync } from 'fastify';
import { registerProblemHandler } from '../../kernel/problem.js';
import { registerCategoryRoutes } from './categories.routes.js';

/** Categories module; the module loader registers this default export (D-01). */
const categories: FastifyPluginAsync = async (app) => {
  registerProblemHandler(app);
  registerCategoryRoutes(app);
};

export default categories;
