import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ChevronDown, LogOut, Menu, User } from 'lucide-react';
import { matchPath, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SidebarInset, SidebarProvider, useSidebar } from '@/components/ui/sidebar';
import { AppSidebar } from './AppSidebar';
import type { Feature } from './registry';

interface ShellProps {
  features: Feature[];
  /** The signed-in user; the user menu in the top bar renders only when given. */
  user?: { email: string };
  /** Ends the session. Resolves when the session is gone; rejects when it could not be ended. */
  onSignOut?: () => Promise<unknown> | void;
  /** Optional sidebar footer content (the API status dot). */
  footer?: ReactNode;
}

const APP_TITLE = 'BudgetPal';

/** The label of the feature that owns the current URL (longest matching path wins), or the app name. */
function pageTitle(features: Feature[], pathname: string): string {
  let best: Feature | undefined;
  for (const feature of features) {
    if (matchPath({ path: feature.path, end: feature.path === '/' }, pathname) === null) continue;
    if (best === undefined || feature.path.length > best.path.length) best = feature;
  }
  return best?.label ?? APP_TITLE;
}

function UserMenu({ user, onSignOut }: { user: { email: string }; onSignOut?: ShellProps['onSignOut'] }) {
  const navigate = useNavigate();
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  const logOut = () => {
    setFailed(false);
    setPending(true);
    // The promise still resolves after the Shell unmounts (the session turns anonymous first).
    Promise.resolve(onSignOut?.()).then(
      () => navigate('/login', { replace: true }),
      () => {
        setPending(false);
        setFailed(true);
      },
    );
  };

  return (
    <div className="flex min-w-0 items-center gap-2">
      {failed ? (
        <p role="alert" className="m-0 text-sm font-medium text-destructive">
          Log out failed. Try again.
        </p>
      ) : null}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="outline" className="min-w-0 max-w-[14rem] gap-2" disabled={pending}>
            <User aria-hidden="true" />
            <span className="truncate">{user.email}</span>
            <ChevronDown aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-48">
          <DropdownMenuLabel className="break-all font-normal">{user.email}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={logOut} className="gap-2">
            <LogOut aria-hidden="true" className="h-4 w-4" />
            Log out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function TopBar({ features, user, onSignOut }: Pick<ShellProps, 'features' | 'user' | 'onSignOut'>) {
  const { pathname } = useLocation();
  const { isMobile, openMobile, setOpenMobile } = useSidebar();
  const menuButton = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);

  // The kit's Sheet has no trigger element, so Radix cannot hand focus back by itself: do it here when it closes.
  useEffect(() => {
    if (wasOpen.current && !openMobile) menuButton.current?.focus();
    wasOpen.current = openMobile;
  }, [openMobile]);

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b bg-background px-4">
      {isMobile ? (
        <Button
          ref={menuButton}
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Open menu"
          onClick={() => setOpenMobile(true)}
        >
          <Menu aria-hidden="true" />
        </Button>
      ) : null}
      {/* Plain text on purpose: each page owns its single h1. */}
      <span className="min-w-0 flex-1 truncate text-base font-semibold">{pageTitle(features, pathname)}</span>
      {user ? <UserMenu user={user} onSignOut={onSignOut} /> : null}
    </header>
  );
}

/**
 * Landmark layout: skip link, a sidebar with the nav built from the registry (a Sheet below 768 px), a top
 * bar with the page title and the user menu, and `main#main` with the routes. Nothing here is persisted.
 */
export function Shell({ features, user, onSignOut, footer }: ShellProps) {
  return (
    <SidebarProvider>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-background focus:px-4 focus:py-2 focus:text-foreground"
      >
        Skip to content
      </a>
      <AppSidebar features={features} footer={footer} />
      <SidebarInset>
        <TopBar features={features} user={user} onSignOut={onSignOut} />
        <main id="main" className="min-w-0 flex-1 p-4 md:p-6" tabIndex={-1}>
          <Routes>
            {features.map((feature) => (
              <Route key={feature.id} path={feature.path} element={<feature.component />} />
            ))}
            <Route
              path="*"
              element={
                <section>
                  <h1 className="text-2xl font-semibold">Page not found</h1>
                  <p>That page does not exist.</p>
                </section>
              }
            />
          </Routes>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
