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

export async function semanticSearch(queryText: string): Promise<SemanticSearchResponse> {
  let embedding: number[];
  try {
    embedding = await generateEmbedding(queryText);
  } catch (error: any) {
    throw new AppError(503, `Semantic search unavailable: ${error.message}`);
  }

  const vectorStr = `[${embedding.join(',')}]`;

  const SIMILARITY_THRESHOLD = 0.5;

  const displaySql = `SELECT product_id, name, sku, category,
       1 - (embedding <=> '[...]'::vector) AS similarity
FROM products
WHERE embedding IS NOT NULL
  AND 1 - (embedding <=> '[...]'::vector) >= ${SIMILARITY_THRESHOLD}
ORDER BY similarity DESC
LIMIT 20`;

  const execSql = `
    SELECT product_id, name, sku, category,
           1 - (embedding <=> $1::vector) AS similarity
    FROM products
    WHERE embedding IS NOT NULL
      AND 1 - (embedding <=> $1::vector) >= $2
    ORDER BY similarity DESC
    LIMIT 20
  `;

  const { rows } = await query<SemanticSearchResult>(execSql, [vectorStr, SIMILARITY_THRESHOLD]);

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
    message: results.length === 0 ? 'No products found with similarity above 50%.' : undefined,
  };
}
