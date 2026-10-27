import { ImportPage } from './ImportPage';
import type { Feature } from '../../kernel/registry';

const feature: Feature = {
  id: 'import',
  path: '/import',
  label: 'Import',
  order: 50,
  component: ImportPage,
};

export default feature;
