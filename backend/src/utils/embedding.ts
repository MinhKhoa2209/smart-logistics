/**
 * Vector embedding generation using Ollama (local, no API key required).
 * Uses nomic-embed-text model which produces 768-dimensional embeddings.
 *
 * Ollama runs as a sidecar container and is accessed via OLLAMA_URL env var.
 * This approach enables real semantic search with pgvector without any external API.
 */

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL || 'nomic-embed-text';

/**
 * Generate a vector embedding for the given text using Ollama.
 *
 * @param text - The input text to embed
 * @returns A number array (768 dimensions for nomic-embed-text)
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  if (!text || text.trim().length === 0) {
    throw new Error('Input text cannot be empty for embedding generation.');
  }

  try {
    const response = await fetch(`${OLLAMA_URL}/api/embed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: EMBEDDING_MODEL,
        input: text.trim(),
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Ollama embedding failed: HTTP ${response.status} - ${body.substring(0, 200)}`);
    }

    const data = (await response.json()) as {
      embeddings?: number[][];
      embedding?: number[];
    };

    // Ollama /api/embed returns { embeddings: [[...]] }
    if (data.embeddings?.[0]) {
      return data.embeddings[0];
    }
    // Older Ollama versions use { embedding: [...] }
    if (data.embedding) {
      return data.embedding;
    }

    throw new Error('Ollama returned unexpected response format.');
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Embedding generation failed: ${error.message}`);
    }
    throw new Error('Embedding generation failed due to an unknown error.');
  }
}
