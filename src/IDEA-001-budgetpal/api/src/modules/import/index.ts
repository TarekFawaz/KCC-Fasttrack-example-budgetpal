import type { FastifyPluginAsync } from 'fastify';
import { registerMultipart, registerPreviewRoute } from './import.routes.js';

/** Import module; the module loader registers this default export (D-01). */
const importModule: FastifyPluginAsync = async (app) => {
  await registerMultipart(app);
  registerPreviewRoute(app);
};

export default importModule;
