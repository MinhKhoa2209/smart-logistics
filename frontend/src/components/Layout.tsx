import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  LayoutDashboard, Package, Warehouse as WarehouseIcon, ClipboardList,
  ArrowUpDown, ShoppingCart, ArrowLeftRight, Truck, ShoppingBag,
  Tag, FileText, Database, Menu, PanelLeftClose, PanelLeft
} from 'lucide-react';

const navItems = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/products', label: 'Products', icon: Package },
  { path: '/warehouses', label: 'Warehouses', icon: WarehouseIcon },
  { path: '/inventory', label: 'Inventory', icon: ClipboardList },
  { path: '/movements', label: 'Stock Movements', icon: ArrowUpDown },
  { path: '/purchase-orders', label: 'Purchase Orders', icon: ShoppingCart },
  { path: '/transfers', label: 'Transfers', icon: ArrowLeftRight },
  { path: '/shipments', label: 'Shipments', icon: Truck },
  { path: '/customer-orders', label: 'Customer Orders', icon: ShoppingBag },
  { path: '/lots', label: 'Product Lots', icon: Tag },
  { path: '/audit-logs', label: 'Audit Logs', icon: FileText },
  { path: '/pg-features', label: 'PG Features', icon: Database },
];

export default function Layout() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Mobile overlay */}
      {mobileOpen && <div className="fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={() => setMobileOpen(false)} />}

      {/* Sidebar */}
      <aside className={cn(
        'fixed inset-y-0 left-0 z-40 bg-card border-r transition-all duration-200 lg:relative lg:translate-x-0 flex flex-col',
        collapsed ? 'w-16' : 'w-60',
        mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      )}>
        <div className={cn('flex items-center h-14 border-b px-3', collapsed ? 'justify-center' : 'gap-2 px-4')}>
          <Database className="h-6 w-6 text-primary shrink-0" />
          {!collapsed && <span className="text-sm font-bold truncate">Smart Logistics</span>}
        </div>

        <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              onClick={() => setMobileOpen(false)}
              title={collapsed ? item.label : undefined}
              className={({ isActive }) => cn(
                'flex items-center gap-3 rounded-md text-sm font-medium transition-colors',
                collapsed ? 'justify-center px-2 py-2.5' : 'px-3 py-2',
                isActive ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-accent hover:text-foreground'
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* Collapse toggle (desktop only) */}
        <div className="hidden lg:flex border-t p-2 justify-center">
          <Button variant="ghost" size="icon" onClick={() => setCollapsed(!collapsed)} title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
            {collapsed ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </Button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex items-center h-14 px-4 bg-card border-b lg:px-6">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobileOpen(!mobileOpen)}>
            <Menu className="h-5 w-5" />
          </Button>
          <div className="flex-1" />
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
              <span className="text-xs font-semibold text-primary">A</span>
            </div>
            <span className="hidden sm:block text-sm font-medium">Admin</span>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
