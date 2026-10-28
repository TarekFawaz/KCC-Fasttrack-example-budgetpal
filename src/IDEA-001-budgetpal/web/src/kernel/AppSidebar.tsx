import type { ReactNode } from 'react';
import {
  ArrowLeftRight,
  Circle,
  Landmark,
  LayoutDashboard,
  PanelLeftClose,
  PanelLeftOpen,
  PiggyBank,
  Tags,
  Upload,
  type LucideIcon,
} from 'lucide-react';
import { matchPath, NavLink, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';
import type { Feature } from './registry';

/**
 * Icons by feature id. A feature that is not listed gets `FALLBACK_ICON`, so a new
 * `features/<x>/feature.ts` never needs an edit here (D-01, GR-006).
 */
const ICONS: Record<string, LucideIcon> = {
  dashboard: LayoutDashboard,
  budgets: PiggyBank,
  transactions: ArrowLeftRight,
  accounts: Landmark,
  categories: Tags,
  import: Upload,
};
const FALLBACK_ICON: LucideIcon = Circle;

export function iconFor(feature: Feature): LucideIcon {
  return ICONS[feature.id] ?? FALLBACK_ICON;
}

/** Colour and size of the API status dot that sits in the footer (its own markup lives in HealthDot). */
const FOOTER_DOT_CLASSES = [
  '[&_.health-dot]:inline-flex [&_.health-dot]:min-h-6 [&_.health-dot]:min-w-6 [&_.health-dot]:items-center',
  '[&_.health-dot]:justify-center [&_.health-dot]:rounded-full [&_.health-dot]:border [&_.health-dot]:px-1.5',
  '[&_.health-dot]:font-bold [&_.health-dot]:text-muted-foreground',
  '[&_.health-dot[data-state=ok]]:border-status-ok [&_.health-dot[data-state=ok]]:text-status-ok',
  '[&_.health-dot[data-state=unavailable]]:border-status-warning [&_.health-dot[data-state=unavailable]]:text-status-warning',
].join(' ');

interface AppSidebarProps {
  features: Feature[];
  /** Content of the sidebar footer (the API status dot). */
  footer?: ReactNode;
}

/** The navigation built from the registry, in registry order. Collapse and mobile Sheet state is React state only. */
export function AppSidebar({ features, footer }: AppSidebarProps) {
  const { pathname } = useLocation();
  const { isMobile, state, toggleSidebar, setOpenMobile } = useSidebar();
  const collapsed = state === 'collapsed';
  const CollapseIcon = collapsed ? PanelLeftOpen : PanelLeftClose;

  return (
    <Sidebar collapsible="icon" mobileLabel="Main navigation">
      <SidebarHeader>
        <div className="flex items-center justify-between gap-2">
          <span className="truncate px-2 text-lg font-semibold group-data-[collapsible=icon]:hidden">BudgetPal</span>
          {isMobile ? null : (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="shrink-0"
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              aria-expanded={!collapsed}
              onClick={toggleSidebar}
            >
              <CollapseIcon aria-hidden="true" />
            </Button>
          )}
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <nav aria-label="Main">
              <SidebarMenu>
                {features.map((feature) => {
                  const Icon = iconFor(feature);
                  const active = matchPath({ path: feature.path, end: feature.path === '/' }, pathname) !== null;
                  return (
                    <SidebarMenuItem key={feature.id}>
                      <SidebarMenuButton asChild isActive={active} tooltip={feature.label}>
                        <NavLink
                          to={feature.path}
                          end={feature.path === '/'}
                          onClick={() => {
                            if (isMobile) setOpenMobile(false);
                          }}
                        >
                          <Icon aria-hidden="true" />
                          <span>{feature.label}</span>
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </nav>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      {footer ? <SidebarFooter className={FOOTER_DOT_CLASSES}>{footer}</SidebarFooter> : null}
    </Sidebar>
  );
}
