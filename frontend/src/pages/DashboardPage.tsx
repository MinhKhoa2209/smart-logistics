import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorAlert } from '@/components';
import { Package, Warehouse, AlertTriangle, Truck, TrendingUp, TrendingDown, ArrowRight } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import * as dashboardApi from '@/api/dashboard';

const SHIPMENT_COLORS: Record<string, string> = {
  pending: '#f59e0b', in_transit: '#6366f1', delivered: '#10b981', failed: '#ef4444', returned: '#8b5cf6',
};

export default function DashboardPage() {
  const [metrics, setMetrics] = useState<dashboardApi.DashboardMetrics | null>(null);
  const [movements, setMovements] = useState<dashboardApi.RecentMovement[]>([]);
  const [lowStock, setLowStock] = useState<dashboardApi.LowStockAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    const errs: Record<string, string> = {};
    try { setMetrics(await dashboardApi.getMetrics()); } catch (e: any) { errs.metrics = e.message; }
    try { setMovements(await dashboardApi.getRecentMovements()); } catch (e: any) { errs.movements = e.message; }
    try { setLowStock(await dashboardApi.getLowStockAlerts()); } catch (e: any) { errs.lowStock = e.message; }
    setErrors(errs);
    setLoading(false);
  }

  if (loading) return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1,2,3,4].map(i => <Skeleton key={i} className="h-32 rounded-2xl" />)}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Skeleton className="h-72 rounded-2xl lg:col-span-2" />
        <Skeleton className="h-72 rounded-2xl" />
      </div>
    </div>
  );

  const shipmentChartData = metrics ? Object.entries(metrics.shipmentsByStatus).map(([name, value]) => ({ name, value })) : [];
  const totalShipments = shipmentChartData.reduce((a, b) => a + b.value, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">Warehouse operations overview</p>
      </div>

      {/* Metric Cards */}
      {errors.metrics ? <ErrorAlert message={errors.metrics} /> : metrics && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard icon={Package} label="Active Products" value={metrics.activeProducts} color="indigo" trend="+2 this week" />
          <MetricCard icon={Warehouse} label="Warehouses" value={metrics.activeWarehouses} color="violet" trend="All operational" />
          <MetricCard icon={AlertTriangle} label="Low Stock" value={metrics.lowStockCount} color="amber" trend="Needs attention" alert={metrics.lowStockCount > 0} />
          <MetricCard icon={Truck} label="Total Shipments" value={totalShipments} color="emerald" trend={`${metrics.shipmentsByStatus.in_transit || 0} in transit`} />
        </div>
      )}

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Shipment Status Chart */}
        {metrics && (
          <Card className="rounded-2xl border shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Shipment Status</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={shipmentChartData} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={3} dataKey="value">
                    {shipmentChartData.map((entry) => (
                      <Cell key={entry.name} fill={SHIPMENT_COLORS[entry.name] || '#94a3b8'} />
                    ))}
                  </Pie>
                  <RechartsTooltip formatter={(v, n) => [v, n]} />
                  <Legend iconType="circle" iconSize={8} formatter={(v) => <span className="text-xs capitalize">{v}</span>} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Low Stock Bar Chart */}
        <Card className="rounded-2xl border shadow-sm lg:col-span-2">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold">Low Stock Alerts</CardTitle>
              {lowStock.length > 0 && <Badge variant="destructive" className="text-xs">{lowStock.length} items</Badge>}
            </div>
          </CardHeader>
          <CardContent>
            {errors.lowStock ? <ErrorAlert message={errors.lowStock} /> : lowStock.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
                <TrendingUp className="h-8 w-8 mb-2 text-green-500" />
                <p className="text-sm font-medium">All stock levels healthy</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={lowStock.slice(0, 6)} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <XAxis dataKey="product_name" tick={{ fontSize: 10 }} tickFormatter={(v) => v.length > 12 ? v.slice(0, 12) + '…' : v} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <RechartsTooltip formatter={(v, n) => [v, n === 'quantity' ? 'Current' : 'Reorder Point']} />
                  <Bar dataKey="quantity" fill="#ef4444" radius={[4, 4, 0, 0]} name="quantity" />
                  <Bar dataKey="reorder_point" fill="#fca5a5" radius={[4, 4, 0, 0]} name="reorder_point" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Movements */}
      <Card className="rounded-2xl border shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold">Recent Stock Movements</CardTitle>
            <a href="/movements" className="text-xs text-primary flex items-center gap-1 hover:underline">View all <ArrowRight className="h-3 w-3" /></a>
          </div>
        </CardHeader>
        <CardContent>
          {errors.movements ? <ErrorAlert message={errors.movements} /> : movements.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No recent movements</p>
          ) : (
            <div className="space-y-2">
              {movements.slice(0, 8).map((m) => (
                <div key={m.movement_id} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-muted/50 transition-colors">
                  <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${m.change_amount > 0 ? 'bg-green-100' : 'bg-red-100'}`}>
                    {m.change_amount > 0 ? <TrendingUp className="h-4 w-4 text-green-600" /> : <TrendingDown className="h-4 w-4 text-red-600" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{m.product_name}</p>
                    <p className="text-xs text-muted-foreground">{m.warehouse_name}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`text-sm font-semibold tabular-nums ${m.change_amount > 0 ? 'text-green-600' : 'text-red-600'}`}>{m.change_amount > 0 ? '+' : ''}{m.change_amount}</p>
                    <p className="text-xs text-muted-foreground">{new Date(m.created_at).toLocaleDateString()}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function MetricCard({ icon: Icon, label, value, color, trend, alert }: { icon: any; label: string; value: number; color: string; trend: string; alert?: boolean }) {
  const colorMap: Record<string, { bg: string; icon: string; border: string }> = {
    indigo: { bg: 'bg-indigo-50 dark:bg-indigo-950/50', icon: 'text-indigo-600 dark:text-indigo-400', border: 'border-indigo-100 dark:border-indigo-900' },
    violet: { bg: 'bg-violet-50 dark:bg-violet-950/50', icon: 'text-violet-600 dark:text-violet-400', border: 'border-violet-100 dark:border-violet-900' },
    amber: { bg: 'bg-amber-50 dark:bg-amber-950/50', icon: 'text-amber-600 dark:text-amber-400', border: 'border-amber-100 dark:border-amber-900' },
    emerald: { bg: 'bg-emerald-50 dark:bg-emerald-950/50', icon: 'text-emerald-600 dark:text-emerald-400', border: 'border-emerald-100 dark:border-emerald-900' },
  };
  const c = colorMap[color];

  return (
    <Card className={`rounded-2xl border shadow-sm ${alert ? 'border-amber-200' : ''}`}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
            <p className="text-3xl font-bold mt-1.5 tabular-nums">{value}</p>
            <p className="text-xs text-muted-foreground mt-1">{trend}</p>
          </div>
          <div className={`h-10 w-10 rounded-xl ${c.bg} ${c.border} border flex items-center justify-center`}>
            <Icon className={`h-5 w-5 ${c.icon}`} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
