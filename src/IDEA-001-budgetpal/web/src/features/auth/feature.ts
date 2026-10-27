import { LoginPage, LogOutPage } from './LoginPage';
import { SignUpPage } from './SignUpPage';
import type { Feature } from '../../kernel/registry';

/**
 * The three auth routes, all `public` so the route guard serves them without a session. One
 * `features` array export is what the registry accepts for several features in one module.
 * `/logout` is public but is not a nav entry: the guard keeps public features out of the nav and
 * puts a log-out control in the shell header instead.
 */
export const features: Feature[] = [
  { id: 'auth-login', path: '/login', label: 'Log in', order: 90, component: LoginPage, public: true },
  { id: 'auth-signup', path: '/signup', label: 'Sign up', order: 91, component: SignUpPage, public: true },
  { id: 'auth-logout', path: '/logout', label: 'Log out', order: 99, component: LogOutPage, public: true },
];
