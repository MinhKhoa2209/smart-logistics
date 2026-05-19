import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorAlert } from '@/components';
import { Package, Warehouse, AlertTriangle, Truck } from 'lucide-react';
import * as dashboardApi from '@/api/dashboard';

export default function DashboardPage() {
  const [metrics, setMetrics] = useState<dashboardApi.DashboardMetrics | null>(null);
  const [movements, setMovements] = useState<dashboardApi.RecentMovement[]>([]);
  const [lowStock, setLowStock] = useState<dashboardApi.LowStockAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState<{ metrics?: string; movements?: string; lowStock?: string }>({});

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    const errs: typeof errors = {};
    try { setMetrics(await dashboardApi.getMetrics()); } catch (e: any) { errs.metrics = e.message; }
    try { setMovements(await dashboardApi.getRecentMovements()); } catch (e: any) { errs.movements = e.message; }
    try { setLowStock(await dashboardApi.getLowStockAlerts()); } catch (e: any) { errs.lowStock = e.message; }
    setErrors(errs);
    setLoading(false);
  }

  if (loading) return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1,2,3,4].map(i => <Skeleton key={i} className="h-28 rounded-xl" />)}
      </div>
      <Skeleton className="h-64 rounded-xl" />
    </div>
  );

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>

      {errors.metrics ? <ErrorAlert message={errors.metrics} /> : metrics && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard icon={<Package className="h-5 w-5" />} title="Active Products" value={metrics.activeProducts} />
          <MetricCard icon={<Warehouse className="h-5 w-5" />} title="Warehouses" value={metrics.activeWarehouses} />
          <MetricCard icon={<AlertTriangle className="h-5 w-5" />} title="Low Stock" value={metrics.lowStockCount} variant="warning" />
          <MetricCard icon={<Truck className="h-5 w-5" />} title="Shipments" value={Object.values(metrics.shipmentsByStatus).reduce((a, b) => a + b, 0)} />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-base">Recent Stock Movements</CardTitle></CardHeader>
          <CardContent>
            {errors.movements ? <ErrorAlert message={errors.movements} /> : movements.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No recent movements</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>Warehouse</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {movements.slice(0, 8).map((m) => (
                    <TableRow key={m.movement_id}>
                      <TableCell className="font-medium">{m.product_name}</TableCell>
                      <TableCell>{m.warehouse_name}</TableCell>
                      <TableCell><Badge variant={m.movement_type === 'inbound' ? 'success' : 'destructive'}>{m.movement_type}</Badge></TableCell>
                      <TableCell className={`text-right font-mono ${m.change_amount > 0 ? 'text-green-600' : 'text-red-600'}`}>{m.change_amount > 0 ? '+' : ''}{m.change_amount}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Low Stock Alerts</CardTitle></CardHeader>
          <CardContent>
            {errors.lowStock ? <ErrorAlert message={errors.lowStock} /> : lowStock.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">All stock levels healthy</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>Warehouse</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Reorder</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lowStock.slice(0, 8).map((item, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{item.product_name}</TableCell>
                      <TableCell>{item.warehouse_name}</TableCell>
                      <TableCell className="text-right text-red-600 font-mono">{item.quantity}</TableCell>
                      <TableCell className="text-right font-mono">{item.reorder_point}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function MetricCard({ icon, title, value, variant }: { icon: React.ReactNode; title: string; value: number; variant?: string }) {
  return (
    <Card className={variant === 'warning' && value > 0 ? 'border-yellow-200 bg-yellow-50/50' : ''}>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-3xl font-bold mt-1">{value}</p>
          </div>
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
