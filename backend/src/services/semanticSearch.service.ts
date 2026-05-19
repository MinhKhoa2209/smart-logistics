import { query } from '../config/database';
import { generateEmbedding } from '../utils/embedding';
import { AppError } from '../middleware';

/**
 * Semantic search result from pgvector cosine similarity query.
 */
export interface SemanticSearchResult {
  product_id: number;
  name: string;
  sku: string;
  category: string | null;
  similarity: number;
}

/**
 * Response from the semantic search service.
 */
export interface SemanticSearchResponse {
  results: SemanticSearchResult[];
  sql: string;
  message?: string;
}

/**
 * Perform semantic search on products using pgvector cosine similarity.
 *
 * 1. Converts the query text into a vector embedding via Ollama (local, no API key needed).
 * 2. Executes a cosine distance query against the products table using the <=> operator.
 * 3. Returns top 20 results ordered by similarity DESC.
 *
 * @param queryText - The natural language search query (2-200 characters)
 */
export async function semanticSearch(queryText: string): Promise<SemanticSearchResponse> {
  // Generate embedding from query text
  let embedding: number[];
  try {
    embedding = await generateEmbedding(queryText);
  } catch (error: any) {
    throw new AppError(503, `Semantic search unavailable: ${error.message}`);
  }

  // Format the embedding as a PostgreSQL vector string
  const vectorStr = `[${embedding.join(',')}]`;

  // Build the SQL query using cosine distance operator
  const sql = `SELECT product_id, name, sku, category, 1 - (embedding <=> $1::vector) as similarity FROM products WHERE embedding IS NOT NULL ORDER BY embedding <=> $1::vector ASC LIMIT 20`;

  // Execute the query
  const { rows } = await query<SemanticSearchResult>(sql, [vectorStr]);

  // Build response
  const response: SemanticSearchResponse = {
    results: rows.map((row) => ({
      product_id: row.product_id,
      name: row.name,
      sku: row.sku,
      category: row.category,
      similarity: parseFloat(Number(row.similarity).toFixed(4)),
    })),
    sql,
  };

  if (rows.length === 0) {
    response.message = 'No matching products found for the given query.';
  }

  return response;
}
