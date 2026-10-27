import { DashboardPage } from './DashboardPage';
import type { Feature } from '../../kernel/registry';

const feature: Feature = {
  id: 'dashboard',
  path: '/',
  label: 'Dashboard',
  order: 0,
  component: DashboardPage,
};

export default feature;
