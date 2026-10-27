import type { FastifyPluginAsync } from 'fastify';
import { registerBudgetRoutes } from './budgets.routes.js';

/** Budgets module; the module loader registers this default export (D-01). */
const budgetsModule: FastifyPluginAsync = async (app) => {
  registerBudgetRoutes(app);
};

export default budgetsModule;
