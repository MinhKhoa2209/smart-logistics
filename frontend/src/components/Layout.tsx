import { useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { TooltipProvider, Tooltip } from '@/components/ui/tooltip';
import {
  LayoutDashboard, Package, Warehouse as WarehouseIcon, ClipboardList,
  ArrowUpDown, ShoppingCart, ArrowLeftRight, Truck, ShoppingBag,
  Tag, FileText, Database, Menu, PanelLeftClose, PanelLeft,
  Bell, ChevronRight
} from 'lucide-react';

const navGroups = [
  {
    label: 'Overview',
    items: [{ path: '/', label: 'Dashboard', icon: LayoutDashboard }],
  },
  {
    label: 'Operations',
    items: [
      { path: '/products', label: 'Products', icon: Package },
      { path: '/warehouses', label: 'Warehouses', icon: WarehouseIcon },
      { path: '/inventory', label: 'Inventory', icon: ClipboardList },
      { path: '/movements', label: 'Stock Movements', icon: ArrowUpDown },
    ],
  },
  {
    label: 'Transactions',
    items: [
      { path: '/purchase-orders', label: 'Purchase Orders', icon: ShoppingCart },
      { path: '/transfers', label: 'Transfers', icon: ArrowLeftRight },
      { path: '/shipments', label: 'Shipments', icon: Truck },
      { path: '/customer-orders', label: 'Customer Orders', icon: ShoppingBag },
    ],
  },
  {
    label: 'Analytics',
    items: [
      { path: '/lots', label: 'Product Lots', icon: Tag },
      { path: '/audit-logs', label: 'Audit Logs', icon: FileText },
    ],
  },
  {
    label: 'Developer',
    items: [{ path: '/pg-features', label: 'PG Features', icon: Database }],
  },
];

const routeLabels: Record<string, string> = {
  '/': 'Dashboard', '/products': 'Products', '/warehouses': 'Warehouses',
  '/inventory': 'Inventory', '/movements': 'Stock Movements',
  '/purchase-orders': 'Purchase Orders', '/transfers': 'Transfers',
  '/shipments': 'Shipments', '/customer-orders': 'Customer Orders',
  '/lots': 'Product Lots', '/audit-logs': 'Audit Logs', '/pg-features': 'PG Features',
};

export default function Layout() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const pageTitle = routeLabels[location.pathname] || '';

  return (
    <TooltipProvider delayDuration={0}>
      <div className="flex h-screen overflow-hidden bg-background">
        {/* Mobile overlay */}
        {mobileOpen && (
          <div className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm lg:hidden" onClick={() => setMobileOpen(false)} />
        )}

        {/* Sidebar */}
        <aside className={cn(
          'fixed inset-y-0 left-0 z-40 flex flex-col transition-all duration-300 ease-in-out lg:relative lg:translate-x-0',
          'bg-background border-r border-border',
          collapsed ? 'w-[68px]' : 'w-[240px]',
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}>
          {/* Logo */}
          <div className={cn('flex items-center h-16 border-b border-border shrink-0', collapsed ? 'justify-center px-3' : 'px-5 gap-3')}>
            <div className="h-8 w-8 rounded-xl gradient-primary flex items-center justify-center shrink-0 shadow-md">
              <Database className="h-4 w-4 text-white" />
            </div>
            {!collapsed && (
              <div>
                <p className="text-sm font-bold leading-none">Smart Logistics</p>
                <p className="text-[10px] text-muted-foreground mt-0.5 leading-none">Warehouse Intelligence</p>
              </div>
            )}
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-5">
            {navGroups.map((group) => (
              <div key={group.label}>
                {!collapsed && (
                  <p className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{group.label}</p>
                )}
                <div className="space-y-0.5">
                  {group.items.map((item) => {
                    const isActive = item.path === '/' ? location.pathname === '/' : location.pathname.startsWith(item.path);
                    const navItem = (
                      <NavLink
                        key={item.path}
                        to={item.path}
                        end={item.path === '/'}
                        onClick={() => setMobileOpen(false)}
                        className={cn(
                          'flex items-center gap-3 rounded-lg text-sm font-medium transition-all duration-150',
                          collapsed ? 'justify-center p-2.5' : 'px-3 py-2',
                          isActive
                            ? 'bg-primary/10 text-primary'
                            : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                        )}
                      >
                        <item.icon className={cn('shrink-0', collapsed ? 'h-5 w-5' : 'h-4 w-4')} />
                        {!collapsed && <span className="truncate">{item.label}</span>}
                        {!collapsed && isActive && <ChevronRight className="h-3 w-3 ml-auto text-primary opacity-60" />}
                      </NavLink>
                    );
                    return collapsed ? (
                      <Tooltip key={item.path} content={item.label} side="right">{navItem}</Tooltip>
                    ) : navItem;
                  })}
                </div>
              </div>
            ))}
          </nav>

          {/* Bottom: collapse toggle + user */}
          <div className="border-t border-border p-2 space-y-1 shrink-0">
            {!collapsed && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg">
                <div className="h-7 w-7 rounded-full gradient-primary flex items-center justify-center shrink-0">
                  <span className="text-xs font-bold text-white">A</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold truncate">Admin</p>
                  <p className="text-[10px] text-muted-foreground truncate">admin@smartlogistics.vn</p>
                </div>
              </div>
            )}
            <div className="hidden lg:flex justify-center">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setCollapsed(!collapsed)}
                className="h-8 w-8"
              >
                {collapsed ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </aside>

        {/* Main content */}
        <div className="flex flex-1 flex-col overflow-hidden min-w-0">
          {/* Header */}
          <header className="flex items-center h-16 px-4 lg:px-6 bg-card border-b shrink-0 gap-4">
            <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobileOpen(!mobileOpen)}>
              <Menu className="h-5 w-5" />
            </Button>

            {/* Breadcrumb */}
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Smart Logistics</span>
              {pageTitle && pageTitle !== 'Dashboard' && (
                <>
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="font-semibold text-foreground">{pageTitle}</span>
                </>
              )}
            </div>

            <div className="flex-1" />

            {/* Header actions */}
            <div className="flex items-center gap-1">
              <ThemeToggle />
              <Button variant="ghost" size="icon" className="relative">
                <Bell className="h-4 w-4" />
                <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-destructive" />
              </Button>
              <div className="h-8 w-8 rounded-full gradient-primary flex items-center justify-center cursor-pointer ml-1">
                <span className="text-xs font-bold text-white">A</span>
              </div>
            </div>
          </header>

          {/* Page content */}
          <main className="flex-1 overflow-y-auto p-4 lg:p-6 page-enter">
            <Outlet />
          </main>
        </div>
      </div>
    </TooltipProvider>
  );
}
