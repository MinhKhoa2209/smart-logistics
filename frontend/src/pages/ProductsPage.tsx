import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Pagination, Modal, LoadingSpinner, ErrorAlert } from '@/components';
import { Search, Plus, Sparkles } from 'lucide-react';
import * as productsApi from '@/api/products';

export default function ProductsPage() {
  const [products, setProducts] = useState<productsApi.Product[]>([]);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20, total: 0, totalPages: 0 });
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState<productsApi.Product | null>(null);
  const [semanticQuery, setSemanticQuery] = useState('');
  const [semanticResults, setSemanticResults] = useState<productsApi.SemanticSearchResult[]>([]);
  const [semanticLoading, setSemanticLoading] = useState(false);

  useEffect(() => { loadProducts(); }, [pagination.page, search, category]);

  useEffect(() => {
    const query = semanticQuery.trim();
    if (query.length < 2) {
      setSemanticResults([]);
      setSemanticLoading(false);
      return;
    }

    let cancelled = false;
    setSemanticLoading(true);
    const timeout = window.setTimeout(async () => {
      try {
        const results = await productsApi.semanticSearch(query);
        if (!cancelled) {
          setSemanticResults(results);
          setError('');
        }
      } catch (e: any) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setSemanticLoading(false);
      }
    }, 450);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [semanticQuery]);

  async function loadProducts() {
    setLoading(true);
    try {
      const res = await productsApi.getProducts({ page: pagination.page, pageSize: 20, search: search || undefined, category: category || undefined });
      setProducts(res.data);
      setPagination(res.pagination);
      setError('');
    } catch (e: any) { setError(e.message); }
    setLoading(false);
  }

  async function handleSemanticSearch() {
    const query = semanticQuery.trim();
    if (query.length < 2) return;
    setSemanticLoading(true);
    try { setSemanticResults(await productsApi.semanticSearch(query)); setError(''); }
    catch (e: any) { setError(e.message); }
    setSemanticLoading(false);
  }

  async function handleCreate(input: productsApi.ProductCreateInput) {
    await productsApi.createProduct(input);
    setShowCreate(false);
    loadProducts();
  }

  async function handleUpdate(input: Partial<productsApi.ProductCreateInput>) {
    if (!showEdit) return;
    await productsApi.updateProduct(showEdit.product_id, input);
    setShowEdit(null);
    loadProducts();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Products</h1>
        <Button onClick={() => setShowCreate(true)}><Plus className="h-4 w-4" /> Add Product</Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search name or SKU..." value={search} onChange={(e) => { setSearch(e.target.value); setPagination(p => ({ ...p, page: 1 })); }} className="pl-9" />
        </div>
        <Input placeholder="Category..." value={category} onChange={(e) => { setCategory(e.target.value); setPagination(p => ({ ...p, page: 1 })); }} className="w-40" />
      </div>

      {/* Semantic Search */}
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2"><Sparkles className="h-4 w-4" /> Semantic Search (pgvector)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input placeholder="Describe what you're looking for..." value={semanticQuery} onChange={(e) => setSemanticQuery(e.target.value)} />
            <Button onClick={handleSemanticSearch} disabled={semanticQuery.length < 2 || semanticLoading}>Search</Button>
          </div>
          {semanticLoading && <p className="text-sm text-muted-foreground mt-2">Searching...</p>}
          {semanticResults.length > 0 && (
            <div className="mt-3 space-y-1">
              {semanticResults.map((r) => (
                <div key={r.product_id} className="flex justify-between items-center bg-background rounded-md px-3 py-2 text-sm border">
                  <span className="font-medium">{r.name} <span className="text-muted-foreground">({r.sku})</span></span>
                  <Badge variant="secondary">{(r.similarity * 100).toFixed(1)}%</Badge>
                </div>
              ))}
            </div>
          )}
          {semanticResults.length === 0 && semanticQuery.length >= 2 && !semanticLoading && <p className="text-sm text-muted-foreground mt-2">No products found with similarity above 50%</p>}
        </CardContent>
      </Card>

      {error && <ErrorAlert message={error} />}
      {loading ? <LoadingSpinner /> : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>SKU</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead className="text-right">Cost</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No products found</TableCell></TableRow>
                ) : products.map((p) => (
                  <TableRow key={p.product_id}>
                    <TableCell className="font-mono text-xs">{p.sku}</TableCell>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell><Badge variant="outline">{p.category}</Badge></TableCell>
                    <TableCell>{p.unit}</TableCell>
                    <TableCell className="text-right font-mono">{Number(p.unit_cost).toLocaleString()}đ</TableCell>
                    <TableCell className="text-right font-mono">{Number(p.unit_price).toLocaleString()}đ</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{p.supplier_name || '-'}</TableCell>
                    <TableCell><Button variant="ghost" size="sm" onClick={() => setShowEdit(p)}>Edit</Button></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
          <Pagination page={pagination.page} totalPages={pagination.totalPages} total={pagination.total} pageSize={pagination.pageSize} onPageChange={(p) => setPagination(prev => ({ ...prev, page: p }))} />
        </Card>
      )}

      <ProductFormModal isOpen={showCreate} onClose={() => setShowCreate(false)} onSubmit={handleCreate} title="Add Product" />
      {showEdit && <ProductFormModal isOpen={!!showEdit} onClose={() => setShowEdit(null)} onSubmit={handleUpdate} title="Edit Product" initial={showEdit} />}
    </div>
  );
}

function ProductFormModal({ isOpen, onClose, onSubmit, title, initial }: { isOpen: boolean; onClose: () => void; onSubmit: (data: any) => Promise<void>; title: string; initial?: productsApi.Product }) {
  const [form, setForm] = useState({ sku: initial?.sku || '', name: initial?.name || '', category: initial?.category || '', unit: initial?.unit || '', unit_cost: initial?.unit_cost?.toString() || '', unit_price: initial?.unit_price?.toString() || '', supplier_id: initial?.supplier_id?.toString() || '' });
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true); setErr('');
    try {
      await onSubmit({
        ...form,
        unit_cost: parseFloat(form.unit_cost),
        unit_price: parseFloat(form.unit_price),
        supplier_id: form.supplier_id ? parseInt(form.supplier_id) : null,
      });
    }
    catch (e: any) { setErr(e.message); }
    setSubmitting(false);
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="lg" footer={
      <>
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button form="product-form" type="submit" disabled={submitting}>{submitting ? 'Saving...' : 'Save'}</Button>
      </>
    }>
      {err && <ErrorAlert message={err} />}
      <form id="product-form" onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
        <div><label className="block text-sm font-medium mb-1.5">SKU</label><Input required value={form.sku} onChange={(e) => setForm(f => ({ ...f, sku: e.target.value }))} /></div>
        <div><label className="block text-sm font-medium mb-1.5">Name</label><Input required value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} /></div>
        <div><label className="block text-sm font-medium mb-1.5">Category</label><Input required value={form.category} onChange={(e) => setForm(f => ({ ...f, category: e.target.value }))} /></div>
        <div><label className="block text-sm font-medium mb-1.5">Unit</label><Input required value={form.unit} onChange={(e) => setForm(f => ({ ...f, unit: e.target.value }))} /></div>
        <div><label className="block text-sm font-medium mb-1.5">Unit Cost</label><Input required type="number" step="0.01" value={form.unit_cost} onChange={(e) => setForm(f => ({ ...f, unit_cost: e.target.value }))} /></div>
        <div><label className="block text-sm font-medium mb-1.5">Unit Price</label><Input required type="number" step="0.01" value={form.unit_price} onChange={(e) => setForm(f => ({ ...f, unit_price: e.target.value }))} /></div>
        <div className="col-span-2"><label className="block text-sm font-medium mb-1.5">Supplier ID <span className="text-muted-foreground font-normal">(optional)</span></label><Input type="number" placeholder="Leave empty if no supplier" value={form.supplier_id} onChange={(e) => setForm(f => ({ ...f, supplier_id: e.target.value }))} /></div>
      </form>
    </Modal>
  );
}
