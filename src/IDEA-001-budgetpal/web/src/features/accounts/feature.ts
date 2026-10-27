import { AccountsPage } from './AccountsPage';
import type { Feature } from '../../kernel/registry';

const feature: Feature = { id: 'accounts', path: '/accounts', label: 'Accounts', order: 20, component: AccountsPage };

export default feature;
