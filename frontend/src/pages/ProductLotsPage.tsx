import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Pagination, LoadingSpinner, ErrorAlert } from '@/components';
import { AlertTriangle, Clock } from 'lucide-react';
import * as lotsApi from '@/api/productLots';

export default function ProductLotsPage() {
  const [lots, setLots] = useState<lotsApi.ProductLot[]>([]);
  const [expiringLots, setExpiringLots] = useState<lotsApi.ProductLot[]>([]);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => { loadData(); }, [pagination.page]);

  async function loadData() {
    setLoading(true);
    try {
      const [lotsRes, expiring] = await Promise.all([lotsApi.getProductLots({ page: pagination.page, pageSize: 20 }), lotsApi.getExpiringLots()]);
      setLots(lotsRes.data); setPagination(lotsRes.pagination); setExpiringLots(expiring); setError('');
    } catch (e: any) { setError(e.message); }
    setLoading(false);
  }

  function getExpiryBadge(expiryDate: string) {
    const days = Math.ceil((new Date(expiryDate).getTime() - Date.now()) / 86400000);
    if (days <= 0) return <Badge variant="destructive">Expired</Badge>;
    if (days <= 7) return <Badge variant="destructive"><Clock className="h-3 w-3" />{days}d</Badge>;
    if (days <= 30) return <Badge variant="warning"><Clock className="h-3 w-3" />{days}d</Badge>;
    return <span className="text-sm text-muted-foreground">{days}d</span>;
  }

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Product Lots</h1>
      {error && <ErrorAlert message={error} />}

      {expiringLots.length > 0 && (
        <Card className="border-yellow-200 bg-yellow-50/50">
          <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-yellow-600" /> Expiring Within 30 Days ({expiringLots.length})</CardTitle></CardHeader>
          <CardContent className="space-y-1">
            {expiringLots.slice(0, 8).map((lot) => (
              <div key={lot.lot_id} className="flex justify-between items-center bg-background rounded-md px-3 py-2 text-sm border">
                <span><strong>{lot.lot_number}</strong> — {lot.product_name}</span>
                {lot.expiry_date && getExpiryBadge(lot.expiry_date)}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card><CardContent className="p-0">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Lot Number</TableHead><TableHead>Product</TableHead><TableHead>Manufactured</TableHead>
            <TableHead>Expiry</TableHead><TableHead>Status</TableHead><TableHead>Supplier</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {lots.length === 0 ? <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No lots</TableCell></TableRow> :
            lots.map((lot) => (
              <TableRow key={lot.lot_id}>
                <TableCell className="font-mono text-xs">{lot.lot_number}</TableCell>
                <TableCell className="font-medium">{lot.product_name}</TableCell>
                <TableCell className="text-muted-foreground">{lot.manufacture_date ? new Date(lot.manufacture_date).toLocaleDateString() : '-'}</TableCell>
                <TableCell>{lot.expiry_date ? new Date(lot.expiry_date).toLocaleDateString() : '-'}</TableCell>
                <TableCell>{lot.expiry_date ? getExpiryBadge(lot.expiry_date) : '-'}</TableCell>
                <TableCell className="text-muted-foreground">{lot.supplier_name || '-'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
      <Pagination page={pagination.page} totalPages={pagination.totalPages} total={pagination.total} pageSize={pagination.pageSize} onPageChange={(p) => setPagination(prev => ({ ...prev, page: p }))} />
      </Card>
    </div>
  );
}
