import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Pagination, LoadingSpinner, ErrorAlert } from '@/components';
import * as movementsApi from '@/api/stockMovements';

const typeColors: Record<string, string> = {
  inbound: 'success', outbound: 'destructive', transfer_in: 'default',
  transfer_out: 'secondary', adjustment: 'warning', return: 'outline', damaged: 'destructive',
};

export default function StockMovementsPage() {
  const [movements, setMovements] = useState<movementsApi.StockMovement[]>([]);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20, total: 0, totalPages: 0 });
  const [movementType, setMovementType] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => { loadMovements(); }, [pagination.page, movementType, startDate, endDate]);

  async function loadMovements() {
    setLoading(true);
    try {
      const res = await movementsApi.getStockMovements({ page: pagination.page, pageSize: 20, movement_type: movementType || undefined, start_date: startDate || undefined, end_date: endDate || undefined });
      setMovements(res.data);
      setPagination(res.pagination);
      setError('');
    } catch (e: any) { setError(e.message); }
    setLoading(false);
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Stock Movements</h1>

      <div className="flex flex-wrap gap-3">
        <Select value={movementType} onChange={(e) => { setMovementType(e.target.value); setPagination(p => ({ ...p, page: 1 })); }} className="w-44">
          <option value="">All Types</option>
          <option value="inbound">Inbound</option>
          <option value="outbound">Outbound</option>
          <option value="transfer_in">Transfer In</option>
          <option value="transfer_out">Transfer Out</option>
          <option value="adjustment">Adjustment</option>
          <option value="return">Return</option>
          <option value="damaged">Damaged</option>
        </Select>
        <Input type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); setPagination(p => ({ ...p, page: 1 })); }} className="w-40" />
        <Input type="date" value={endDate} onChange={(e) => { setEndDate(e.target.value); setPagination(p => ({ ...p, page: 1 })); }} className="w-40" />
      </div>

      {error && <ErrorAlert message={error} />}
      {loading ? <LoadingSpinner /> : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Warehouse</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {movements.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No stock movements found</TableCell></TableRow>
                ) : movements.map((m) => (
                  <TableRow key={m.movement_id}>
                    <TableCell className="font-medium">{m.product_name}</TableCell>
                    <TableCell>{m.warehouse_name}</TableCell>
                    <TableCell className={`text-right font-mono ${m.change_amount > 0 ? 'text-green-600' : 'text-red-600'}`}>{m.change_amount > 0 ? '+' : ''}{m.change_amount}</TableCell>
                    <TableCell><Badge variant={typeColors[m.movement_type] as any || 'outline'}>{m.movement_type.replace('_', ' ')}</Badge></TableCell>
                    <TableCell className="text-muted-foreground text-xs">{m.reference_type || '-'}</TableCell>
                    <TableCell className="text-muted-foreground">{new Date(m.created_at).toLocaleString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
          <Pagination page={pagination.page} totalPages={pagination.totalPages} total={pagination.total} pageSize={pagination.pageSize} onPageChange={(p) => setPagination(prev => ({ ...prev, page: p }))} />
        </Card>
      )}
    </div>
  );
}
