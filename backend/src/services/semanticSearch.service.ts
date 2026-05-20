import { query } from '../config/database';
import { generateEmbedding } from '../utils/embedding';
import { AppError } from '../middleware';

export interface SemanticSearchResult {
  product_id: number;
  name: string;
  sku: string;
  category: string | null;
  similarity: number;
}

export interface SemanticSearchResponse {
  results: SemanticSearchResult[];
  sql: string;
  message?: string;
}

/**
 * Perform semantic search on products using pgvector cosine similarity.
 *
 * Uses nomic-embed-text with "search_query:" prefix for the user query,
 * matching against products indexed with "search_document:" prefix.
 * This asymmetric approach (query vs document prefixes) significantly
 * improves retrieval accuracy for nomic-embed-text.
 *
 * The <=> operator computes cosine distance (0 = identical, 2 = opposite).
 * Similarity = 1 - cosine_distance (higher = more similar).
 *
 * @param queryText - Natural language search query (2-200 chars)
 */
export async function semanticSearch(queryText: string): Promise<SemanticSearchResponse> {
  let embedding: number[];
  try {
    // generateEmbedding automatically adds "search_query:" prefix
    embedding = await generateEmbedding(queryText);
  } catch (error: any) {
    throw new AppError(503, `Semantic search unavailable: ${error.message}`);
  }

  const vectorStr = `[${embedding.join(',')}]`;

  // Display SQL (with truncated vector for readability)
  const displaySql = `SELECT product_id, name, sku, category,
       1 - (embedding <=> '[...]'::vector) AS similarity
FROM products
WHERE embedding IS NOT NULL
ORDER BY embedding <=> '[...]'::vector ASC
LIMIT 20`;

  // Actual query
  const execSql = `
    SELECT product_id, name, sku, category,
           1 - (embedding <=> $1::vector) AS similarity
    FROM products
    WHERE embedding IS NOT NULL
    ORDER BY embedding <=> $1::vector ASC
    LIMIT 20
  `;

  const { rows } = await query<SemanticSearchResult>(execSql, [vectorStr]);

  const results = rows.map((row) => ({
    product_id: row.product_id,
    name: row.name,
    sku: row.sku,
    category: row.category,
    similarity: parseFloat(Number(row.similarity).toFixed(4)),
  }));

  return {
    results,
    sql: displaySql,
    message: results.length === 0 ? 'No matching products found.' : undefined,
  };
}
