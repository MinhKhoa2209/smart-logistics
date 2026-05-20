/**
 * Vector embedding generation using Ollama (local, no API key required).
 * Uses nomic-embed-text model which produces 768-dimensional embeddings.
 *
 * nomic-embed-text uses task-specific prefixes for better accuracy:
 *   - "search_document: " for indexing documents (products)
 *   - "search_query: "    for search queries (user input)
 *
 * Ollama runs as a sidecar container accessed via OLLAMA_URL env var.
 */

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL || 'nomic-embed-text';

/**
 * Generate a vector embedding for a search query.
 * Uses "search_query:" prefix for nomic-embed-text to improve retrieval accuracy.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  if (!text || text.trim().length === 0) {
    throw new Error('Input text cannot be empty for embedding generation.');
  }
  return callOllama(text.trim());
}

export async function generateDocumentEmbedding(text: string): Promise<number[]> {
  if (!text || text.trim().length === 0) {
    throw new Error('Input text cannot be empty for embedding generation.');
  }
  return callOllama(text.trim());
}

async function callOllama(input: string): Promise<number[]> {
  try {
    const response = await fetch(`${OLLAMA_URL}/api/embed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: EMBEDDING_MODEL, input }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Ollama embedding failed: HTTP ${response.status} - ${body.substring(0, 200)}`);
    }

    const data = (await response.json()) as {
      embeddings?: number[][];
      embedding?: number[];
    };

    if (data.embeddings?.[0]) return data.embeddings[0];
    if (data.embedding) return data.embedding;

    throw new Error('Ollama returned unexpected response format.');
  } catch (error) {
    if (error instanceof Error) throw new Error(`Embedding generation failed: ${error.message}`);
    throw new Error('Embedding generation failed due to an unknown error.');
  }
}
