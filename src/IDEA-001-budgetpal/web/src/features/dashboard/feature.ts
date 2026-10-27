import { DashboardPage } from './DashboardPage';
import type { Feature } from '../../kernel/registry';

const feature: Feature = {
  id: 'dashboard',
  path: '/dashboard',
  label: 'Dashboard',
  order: 50,
  component: DashboardPage,
};

export default feature;
