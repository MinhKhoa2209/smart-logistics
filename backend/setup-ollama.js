/**
 * Setup script: Pull nomic-embed-text model and generate bilingual embeddings.
 * Uses Vietnamese name + English translation for better semantic search accuracy.
 * Run: docker exec smartlogistic-backend node /app/setup-ollama.js
 */
const { Pool } = require('pg');

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://ollama:11434';
const MODEL = process.env.EMBEDDING_MODEL || 'nomic-embed-text';
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Bilingual product descriptions — Vietnamese name + English keywords
// nomic-embed-text is primarily English-trained, so adding English improves accuracy
const PRODUCT_DESCRIPTIONS = {
  1:  'Laptop Dell Latitude 5540 i7 | laptop computer notebook portable PC Electronics',
  2:  'Samsung Galaxy Tab S9 FE 128GB | tablet android samsung Electronics',
  3:  'Tai nghe Sony WH-1000XM5 | headphones wireless noise cancelling Sony Electronics',
  4:  'Chuột Logitech MX Master 3S | mouse wireless logitech computer peripheral Electronics',
  5:  'Bàn phím cơ Keychron K8 Pro | mechanical keyboard keychron Electronics',
  6:  'Màn hình LG 27" 4K IPS | monitor display screen LG 4K Electronics',
  7:  'Webcam Logitech C920 HD Pro | webcam camera video conference Electronics',
  8:  'USB Hub Anker 7-in-1 | USB hub adapter port splitter Electronics',
  9:  'Cà phê Trung Nguyên Legend 500g | coffee ca phe vietnamese coffee Food & Beverage',
  10: 'Trà Oolong Phúc Long 200g | tea oolong tra vietnamese tea Food & Beverage',
  11: 'Nước mắm Phú Quốc 40° 500ml | fish sauce nuoc mam condiment Food & Beverage',
  12: 'Dầu ăn Neptune 5L | cooking oil vegetable oil dau an Food & Beverage',
  13: 'Sữa tươi Vinamilk 1L | fresh milk dairy vinamilk Food & Beverage',
  14: 'Giấy A4 Double A 80gsm | A4 paper printing paper office supplies',
  15: 'Bút bi Thiên Long TL-027 | ballpoint pen writing pen office supplies',
  16: 'Kẹp giấy Deli 50mm | paper clip binder clip office supplies',
  17: 'Bìa hồ sơ Leitz A4 | folder file binder document holder office supplies',
  18: 'Mực in HP 85A | printer ink toner cartridge HP office supplies',
  19: 'Ghế công thái học Ergohuman Plus | ergonomic chair office chair furniture',
  20: 'Bàn làm việc nâng hạ Flexispot E7 | standing desk height adjustable desk furniture',
  21: 'Tủ hồ sơ sắt 4 ngăn | filing cabinet metal cabinet storage furniture',
  22: 'Kệ sách gỗ 5 tầng | bookshelf wooden shelf storage furniture',
  23: 'Thùng carton 40×30×20cm | cardboard box carton packaging shipping',
  24: 'Băng keo trong 48mm×100m | clear tape adhesive tape packaging',
  25: 'Túi zip PE 20×30cm | zip bag plastic bag packaging',
  26: 'Xốp chèn hàng cuộn 50m | bubble wrap foam padding packaging',
};

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
  // Ensure pgvector extension and embedding column exist
  await pool.query('CREATE EXTENSION IF NOT EXISTS vector');
  await pool.query('ALTER TABLE products ADD COLUMN IF NOT EXISTS embedding vector(768)');
  await pool.query('DROP INDEX IF EXISTS idx_products_embedding');

  // Pull model first
  await pullModel();

  // Get all products
  const { rows } = await pool.query('SELECT product_id, name, category FROM products WHERE is_active = true');
  console.log(`\nGenerating bilingual embeddings for ${rows.length} products...`);

  for (const p of rows) {
    // Use bilingual description if available, otherwise fallback to name + category
    const text = PRODUCT_DESCRIPTIONS[p.product_id] || `${p.name} | ${p.category || ''}`;
    try {
      const emb = await generateEmbedding(text);
      if (!emb) throw new Error('No embedding returned');
      await pool.query(
        'UPDATE products SET embedding = $1::vector WHERE product_id = $2',
        [`[${emb.join(',')}]`, p.product_id]
      );
      console.log(`✓ ${p.name}`);
    } catch (e) {
      console.error(`✗ ${p.name}: ${e.message}`);
    }
  }

  // Create IVFFlat index for fast approximate nearest neighbor search
  console.log('\nCreating vector index...');
  await pool.query(`
    CREATE INDEX idx_products_embedding ON products USING ivfflat (embedding vector_cosine_ops) WITH (lists = 5)
  `);

  console.log('\nDone! Semantic search is ready.');
  await pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });
