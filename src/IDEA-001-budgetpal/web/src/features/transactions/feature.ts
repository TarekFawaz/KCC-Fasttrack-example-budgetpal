import { TransactionsPage } from './TransactionsPage';
import type { Feature } from '../../kernel/registry';

const feature: Feature = {
  id: 'transactions',
  path: '/transactions',
  label: 'Transactions',
  order: 40,
  component: TransactionsPage,
};

export default feature;
