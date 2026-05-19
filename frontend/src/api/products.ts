import apiClient from './client';

export interface Product {
  product_id: number;
  sku: string;
  name: string;
  category: string;
  unit: string;
  unit_cost: number;
  unit_price: number;
  supplier_id: number | null;
  supplier_name?: string;
  is_active: boolean;
  created_at: string;
}

export interface ProductListResponse {
  data: Product[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
}

export interface ProductCreateInput {
  sku: string;
  name: string;
  category: string;
  unit: string;
  unit_cost: number;
  unit_price: number;
  supplier_id?: number | null;
  description?: string;
}

export interface SemanticSearchResult {
  product_id: number;
  name: string;
  sku: string;
  category: string;
  similarity: number;
}

export async function getProducts(params: {
  page?: number;
  pageSize?: number;
  search?: string;
  category?: string;
  supplier_id?: number;
}): Promise<ProductListResponse> {
  const { data } = await apiClient.get('/products', { params });
  // Backend returns flat format: {data, total, page, pageSize, totalPages}
  return {
    data: data.data,
    pagination: { page: data.page, pageSize: data.pageSize, total: data.total, totalPages: data.totalPages },
  };
}

export async function getProduct(id: number): Promise<Product> {
  const { data } = await apiClient.get(`/products/${id}`);
  return data;
}

export async function createProduct(input: ProductCreateInput): Promise<Product> {
  const { data } = await apiClient.post('/products', input);
  return data;
}

export async function updateProduct(id: number, input: Partial<ProductCreateInput>): Promise<Product> {
  const { data } = await apiClient.put(`/products/${id}`, input);
  return data;
}

export async function semanticSearch(query: string): Promise<SemanticSearchResult[]> {
  const { data } = await apiClient.post('/products/semantic-search', { query });
  // Backend returns { results: [...], sql: "..." }
  return data.results || data.data || data;
}
