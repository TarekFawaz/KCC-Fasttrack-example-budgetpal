import { BudgetsPage } from './BudgetsPage';
import type { Feature } from '../../kernel/registry';

const feature: Feature = {
  id: 'budgets',
  path: '/budgets',
  label: 'Budgets',
  order: 50,
  component: BudgetsPage,
};

export default feature;
