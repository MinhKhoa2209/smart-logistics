/**
 * Setup script: Pull nomic-embed-text model and generate embeddings for all products.
 * Run after Ollama container is healthy:
 *   docker exec smartlogistic-backend node /app/setup-ollama.js
 */
const { Pool } = require('pg');

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://ollama:11434';
const MODEL = process.env.EMBEDDING_MODEL || 'nomic-embed-text';
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function pullModel() {
  console.log(`Pulling model: ${MODEL}...`);
  const res = await fetch(`${OLLAMA_URL}/api/pull`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: MODEL, stream: false }),
  });
  if (!res.ok) throw new Error(`Pull failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  console.log(`Model pull status: ${data.status}`);
}

async function generateEmbedding(text) {
  const res = await fetch(`${OLLAMA_URL}/api/embed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: MODEL, input: text }),
  });
  if (!res.ok) throw new Error(`Embed failed: ${res.status}`);
  const data = await res.json();
  return data.embeddings?.[0] || data.embedding;
}

async function main() {
  // Pull model first
  await pullModel();

  // Get all products
  const { rows } = await pool.query('SELECT product_id, name, category FROM products WHERE is_active = true');
  console.log(`\nGenerating embeddings for ${rows.length} products...`);

  for (const p of rows) {
    const text = `${p.name} ${p.category || ''}`.trim();
    try {
      const emb = await generateEmbedding(text);
      if (!emb) throw new Error('No embedding returned');
      await pool.query(
        'UPDATE products SET embedding = $1::vector WHERE product_id = $2',
        [`[${emb.join(',')}]`, p.product_id]
      );
      console.log(`✓ ${p.name} (${emb.length} dims)`);
    } catch (e) {
      console.error(`✗ ${p.name}: ${e.message}`);
    }
  }

  // Create IVFFlat index for fast search
  console.log('\nCreating vector index...');
  await pool.query(`
    DROP INDEX IF EXISTS idx_products_embedding;
    CREATE INDEX idx_products_embedding ON products USING ivfflat (embedding vector_cosine_ops) WITH (lists = 5)
  `);

  console.log('\nDone! Semantic search is ready.');
  await pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });
