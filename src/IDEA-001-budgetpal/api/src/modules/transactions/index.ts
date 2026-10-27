import type { FastifyPluginAsync } from 'fastify';
import { registerTransactionRoutes } from './transactions.routes.js';

/** Transactions module; the module loader registers this default export (D-01). */
const transactionsModule: FastifyPluginAsync = async (app) => {
  registerTransactionRoutes(app);
};

export default transactionsModule;
