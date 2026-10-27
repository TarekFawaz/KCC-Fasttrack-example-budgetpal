import { LoginPage, LogOutPage } from './LoginPage';
import { SignUpPage } from './SignUpPage';
import type { Feature } from '../../kernel/registry';

/**
 * The SPEC-001 registry reads exactly one `Feature` per `features/<x>/feature.ts` (the default
 * export), and the shell turns each into one route plus one nav link. Story-003 needs three
 * (`/login`, `/signup`, and a log-out entry), so only `/login` can be registered from this single
 * file today; the other two are defined here, complete and tested, and wait for the registry to
 * accept more than one feature per module (see the SPEC-002 wave 4 report).
 */
const feature: Feature = { id: 'auth-login', path: '/login', label: 'Log in', order: 90, component: LoginPage };

export const signUpFeature: Feature = { id: 'auth-signup', path: '/signup', label: 'Sign up', order: 91, component: SignUpPage };

export const logOutFeature: Feature = { id: 'auth-logout', path: '/logout', label: 'Log out', order: 99, component: LogOutPage };

export default feature;
