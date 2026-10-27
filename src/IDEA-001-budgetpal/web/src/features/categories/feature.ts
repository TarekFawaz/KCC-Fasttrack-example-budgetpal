import { CategoriesPage } from './CategoriesPage';
import type { Feature } from '../../kernel/registry';

/** Picked up by the kernel registry glob: one route plus one "Categories" nav entry, no shared file edited. */
const feature: Feature = { id: 'categories', path: '/categories', label: 'Categories', order: 20, component: CategoriesPage };

export default feature;
