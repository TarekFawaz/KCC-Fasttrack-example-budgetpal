import type { FastifyPluginAsync } from 'fastify';
import { registerAccountRoutes } from './accounts.routes.js';

/** Accounts module; the module loader registers this default export (D-01). */
const accountsModule: FastifyPluginAsync = async (app) => {
  registerAccountRoutes(app);
};

export default accountsModule;
