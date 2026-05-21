import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Pagination, LoadingSpinner, ErrorAlert } from '@/components';
import { AlertTriangle, CheckCircle2, TrendingUp } from 'lucide-react';
import * as inventoryApi from '@/api/inventory';
import * as warehousesApi from '@/api/warehouses';

const statusConfig = {
  low_stock: { label: 'Low', variant: 'destructive', icon: AlertTriangle },
  in_stock: { label: 'In Stock', variant: 'success', icon: CheckCircle2 },
  overstock: { label: 'Overstock', variant: 'warning', icon: TrendingUp },
} as const;

export default function InventoryPage() {
  const [items, setItems] = useState<inventoryApi.InventoryItem[]>([]);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 50, total: 0, totalPages: 0 });
  const [warehouseId, setWarehouseId] = useState<number | undefined>();
  const [status, setStatus] = useState<inventoryApi.InventoryItem['status'] | ''>('');
  const [warehouses, setWarehouses] = useState<warehousesApi.Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => { warehousesApi.getWarehouses().then(setWarehouses).catch(() => {}); }, []);
  useEffect(() => { loadInventory(); }, [pagination.page, warehouseId, status]);

  async function loadInventory() {
    setLoading(true);
    try {
      const res = await inventoryApi.getInventory({ page: pagination.page, pageSize: 50, warehouse_id: warehouseId, status: status || undefined });
      setItems(res.data);
      setPagination(res.pagination);
      setError('');
    } catch (e: any) { setError(e.message); }
    setLoading(false);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">Inventory</h1>
        <div className="flex flex-wrap gap-3">
          <Select value={status} onChange={(e) => { setStatus(e.target.value as typeof status); setPagination(p => ({ ...p, page: 1 })); }} className="w-48">
            <option value="">All Statuses</option>
            <option value="low_stock">Low Stock</option>
            <option value="in_stock">In Stock</option>
            <option value="overstock">Overstock</option>
          </Select>
          <Select value={warehouseId?.toString() || ''} onChange={(e) => { setWarehouseId(e.target.value ? Number(e.target.value) : undefined); setPagination(p => ({ ...p, page: 1 })); }} className="w-48">
            <option value="">All Warehouses</option>
            {warehouses.map((w) => <option key={w.warehouse_id} value={w.warehouse_id}>{w.name}</option>)}
          </Select>
        </div>
      </div>

      {error && <ErrorAlert message={error} />}
      {loading ? <LoadingSpinner /> : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>Warehouse</TableHead>
                  <TableHead>Lot</TableHead>
                  <TableHead className="text-right">Quantity</TableHead>
                  <TableHead className="text-right">Reorder Point</TableHead>
                  <TableHead className="text-right">Max Stock</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No inventory records</TableCell></TableRow>
                ) : items.map((item) => {
                  const config = statusConfig[item.status];
                  const StatusIcon = config.icon;
                  const isLow = item.status === 'low_stock';
                  return (
                    <TableRow key={item.inventory_id} className={isLow ? 'bg-red-50/50' : ''}>
                      <TableCell className="font-medium">{item.product_name}</TableCell>
                      <TableCell className="font-mono text-xs">{item.sku}</TableCell>
                      <TableCell>{item.warehouse_name}</TableCell>
                      <TableCell className="text-muted-foreground">{item.lot_number || '-'}</TableCell>
                      <TableCell className={`text-right font-mono ${isLow ? 'text-red-600 font-bold' : ''}`}>{item.quantity}</TableCell>
                      <TableCell className="text-right font-mono">{item.reorder_point}</TableCell>
                      <TableCell className="text-right font-mono">{item.max_stock_level ?? '-'}</TableCell>
                      <TableCell><Badge variant={config.variant} className="gap-1"><StatusIcon className="h-3 w-3" />{config.label}</Badge></TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
          <Pagination page={pagination.page} totalPages={pagination.totalPages} total={pagination.total} pageSize={pagination.pageSize} onPageChange={(p) => setPagination(prev => ({ ...prev, page: p }))} />
        </Card>
      )}
    </div>
  );
}
