import type { FastifyPluginAsync } from 'fastify';
import { registerCommitRoute, registerMultipart, registerPreviewRoute } from './import.routes.js';

/** Import module; the module loader registers this default export (D-01). */
const importModule: FastifyPluginAsync = async (app) => {
  await registerMultipart(app);
  registerPreviewRoute(app);
  registerCommitRoute(app);
};

export default importModule;
