import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Modal, LoadingSpinner, ErrorAlert } from '@/components';
import * as warehousesApi from '@/api/warehouses';

export default function WarehousesPage() {
  const [warehouses, setWarehouses] = useState<warehousesApi.Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<warehousesApi.Warehouse | null>(null);
  const [inventory, setInventory] = useState<warehousesApi.WarehouseInventory[]>([]);
  const [invLoading, setInvLoading] = useState(false);

  useEffect(() => { loadWarehouses(); }, []);

  async function loadWarehouses() {
    setLoading(true);
    try { setWarehouses(await warehousesApi.getWarehouses()); setError(''); }
    catch (e: any) { setError(e.message); }
    setLoading(false);
  }

  async function viewWarehouse(wh: warehousesApi.Warehouse) {
    setSelected(wh);
    setInvLoading(true);
    try { setInventory(await warehousesApi.getWarehouseInventory(wh.warehouse_id)); }
    catch (e: any) { setError(e.message); }
    setInvLoading(false);
  }

  const typeColors: Record<string, string> = {
    distribution_center: 'bg-blue-100 text-blue-800',
    returns: 'bg-orange-100 text-orange-800',
    cold_storage: 'bg-cyan-100 text-cyan-800',
  };

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorAlert message={error} />;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Warehouses</h1>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Location</TableHead>
                <TableHead className="text-right">Capacity</TableHead>
                <TableHead>Manager</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {warehouses.map((w) => (
                <TableRow key={w.warehouse_id} className="cursor-pointer" onClick={() => viewWarehouse(w)}>
                  <TableCell className="font-medium">{w.name}</TableCell>
                  <TableCell><span className={`px-2 py-0.5 rounded text-xs font-medium ${typeColors[w.warehouse_type] || 'bg-gray-100'}`}>{w.warehouse_type.replace('_', ' ')}</span></TableCell>
                  <TableCell className="text-muted-foreground">{w.location}</TableCell>
                  <TableCell className="text-right font-mono">{w.capacity?.toLocaleString()}</TableCell>
                  <TableCell>{w.manager_name || '-'}</TableCell>
                  <TableCell>{w.is_active ? <Badge variant="success">Active</Badge> : <Badge variant="destructive">Inactive</Badge>}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Modal isOpen={!!selected} onClose={() => setSelected(null)} title={`${selected?.name} — Inventory`} size="xl">
        {invLoading ? <LoadingSpinner /> : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>Lot</TableHead>
                <TableHead className="text-right">Quantity</TableHead>
                <TableHead className="text-right">Reorder</TableHead>
                <TableHead className="text-right">Max</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {inventory.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground">No inventory</TableCell></TableRow>
              ) : inventory.map((item, i) => (
                <TableRow key={i}>
                  <TableCell className="font-medium">{item.product_name}</TableCell>
                  <TableCell className="font-mono text-xs">{item.sku}</TableCell>
                  <TableCell>{item.lot_number || '-'}</TableCell>
                  <TableCell className="text-right font-mono">{item.quantity}</TableCell>
                  <TableCell className="text-right font-mono">{item.reorder_point}</TableCell>
                  <TableCell className="text-right font-mono">{item.max_stock_level}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Modal>
    </div>
  );
}
