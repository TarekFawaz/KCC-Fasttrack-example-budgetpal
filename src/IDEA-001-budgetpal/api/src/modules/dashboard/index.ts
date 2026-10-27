import type { FastifyPluginAsync } from 'fastify';
import { registerSpendingRoutes } from './spending.routes.js';
import { registerTrendRoutes } from './trend.routes.js';

/** Dashboard module; the module loader registers this default export (D-01). */
const dashboardModule: FastifyPluginAsync = async (app) => {
  registerSpendingRoutes(app);
  registerTrendRoutes(app);
};

export default dashboardModule;
