import { HomePage } from './HomePage';
import type { Feature } from '../../kernel/registry';

const feature: Feature = { id: 'home', path: '/', label: 'Home', order: 0, component: HomePage };

export default feature;
