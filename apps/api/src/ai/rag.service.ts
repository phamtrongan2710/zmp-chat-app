import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { GoogleGenAI } from "@google/genai";
import { PDFParse } from "pdf-parse";
import { createHash, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Pool } from "pg";
import {
  DEFAULT_CHUNK_OVERLAP,
  DEFAULT_CHUNK_SIZE,
  DEFAULT_EMBEDDING_MODEL,
  DEFAULT_RAG_DOCUMENT_PATH,
} from "./ai.constants";

type StoredChunk = {
  id: string;
  source_file: string;
  file_hash: string;
  chunk_index: number;
  content: string;
  embedding: number[] | string;
};

export type RetrievedChunk = {
  sourceFile: string;
  chunkIndex: number;
  content: string;
  score: number;
};

@Injectable()
export class RagService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RagService.name);
  private readonly embeddingModel: string;
  private readonly documentPath: string;
  private readonly chunkSize: number;
  private readonly chunkOverlap: number;
  private readonly aiClient: GoogleGenAI | null;
  private readonly pool: Pool | null;

  constructor(private readonly configService: ConfigService) {
    this.embeddingModel = this.configService.get<string>("AI_EMBEDDING_MODEL") ?? DEFAULT_EMBEDDING_MODEL;
    this.documentPath = resolve(
      process.cwd(),
      this.configService.get<string>("AI_RAG_DOCUMENT_PATH") ?? DEFAULT_RAG_DOCUMENT_PATH,
    );
    this.chunkSize = Number(this.configService.get<string>("AI_RAG_CHUNK_SIZE") ?? DEFAULT_CHUNK_SIZE);
    this.chunkOverlap = Number(this.configService.get<string>("AI_RAG_CHUNK_OVERLAP") ?? DEFAULT_CHUNK_OVERLAP);

    const apiKey = this.configService.get<string>("GOOGLE_API_KEY");
    const databaseUrl = this.configService.get<string>("DATABASE_URL");

    this.aiClient = apiKey ? new GoogleGenAI({ apiKey }) : null;
    this.pool = databaseUrl ? new Pool({ connectionString: databaseUrl }) : null;
  }

  async onModuleInit(): Promise<void> {
    if (!this.aiClient || !this.pool) {
      this.logger.warn("RAG startup skipped because GOOGLE_API_KEY or DATABASE_URL is missing");
      return;
    }

    try {
      await this.ensureSchema();
      await this.ensureDocumentEmbedded();
    } catch (error) {
      this.logger.warn(`RAG startup skipped: ${this.describeError(error)}`);
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool?.end();
  }

  async ensureDocumentEmbedded(): Promise<void> {
    if (!this.aiClient || !this.pool) {
      throw new Error("RAG dependencies are not configured");
    }

    const fileBuffer = await readFile(this.documentPath);
    const sourceFile = this.documentPath.split(/[\\/]/).pop() ?? "document.pdf";
    const fileHash = createHash("sha256").update(fileBuffer).digest("hex");

    const existing = await this.pool.query<{ file_hash: string; chunk_count: number }>(
      "select file_hash, chunk_count from rag_document_registry where source_file = $1",
      [sourceFile],
    );

    if (existing.rowCount && existing.rows[0].file_hash === fileHash && existing.rows[0].chunk_count > 0) {
      this.logger.log(`RAG document ${sourceFile} is already embedded`);
      return;
    }

    const parser = new PDFParse({ data: fileBuffer });
    const parsed = await parser.getText();
    await parser.destroy();
    const chunks = this.chunkText(parsed.text);
    if (chunks.length === 0) {
      throw new Error(`No text was extracted from ${sourceFile}`);
    }

    const embeddings = await this.embedTexts(chunks.map((chunk) => chunk.content));
    const client = await this.pool.connect();

    try {
      await client.query("begin");
      await client.query("delete from rag_document_chunks where source_file = $1", [sourceFile]);

      for (let index = 0; index < chunks.length; index++) {
        await client.query(
          `
            insert into rag_document_chunks (
              id,
              source_file,
              file_hash,
              chunk_index,
              content,
              embedding
            ) values ($1, $2, $3, $4, $5, $6::jsonb)
          `,
          [
            randomUUID(),
            sourceFile,
            fileHash,
            index,
            chunks[index].content,
            JSON.stringify(embeddings[index]),
          ],
        );
      }

      await client.query(
        `
          insert into rag_document_registry (source_file, file_hash, chunk_count, updated_at)
          values ($1, $2, $3, now())
          on conflict (source_file) do update
          set file_hash = excluded.file_hash,
              chunk_count = excluded.chunk_count,
              updated_at = excluded.updated_at
        `,
        [sourceFile, fileHash, chunks.length],
      );

      await client.query("commit");
      this.logger.log(`Embedded ${chunks.length} chunks from ${sourceFile}`);
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }
  }

  async retrieve(query: string, limit = 5): Promise<RetrievedChunk[]> {
    if (!this.aiClient || !this.pool) {
      return [];
    }

    const rows = await this.pool.query<StoredChunk>(
      `
        select id, source_file, file_hash, chunk_index, content, embedding
        from rag_document_chunks
        order by chunk_index asc
      `,
    );

    if (rows.rowCount === 0) {
      return [];
    }

    const [queryEmbedding] = await this.embedTexts([query]);
    const scored = rows.rows
      .map((row) => ({
        sourceFile: row.source_file,
        chunkIndex: row.chunk_index,
        content: row.content,
        score: cosineSimilarity(queryEmbedding, this.parseEmbedding(row.embedding)),
      }))
      .sort((left, right) => right.score - left.score)
      .slice(0, limit);

    return scored.filter((chunk) => Number.isFinite(chunk.score) && chunk.score > 0.15);
  }

  private async ensureSchema(): Promise<void> {
    if (!this.pool) {
      throw new Error("DATABASE_URL is not configured");
    }

    const client = await this.pool.connect();
    try {
      await client.query(
        `
          create table if not exists rag_document_registry (
            source_file text primary key,
            file_hash text not null,
            chunk_count integer not null,
            updated_at timestamptz not null default now()
          );
        `,
      );

      await client.query(
        `
          create table if not exists rag_document_chunks (
            id text primary key,
            source_file text not null,
            file_hash text not null,
            chunk_index integer not null,
            content text not null,
            embedding jsonb not null,
            created_at timestamptz not null default now()
          );
        `,
      );

      await client.query(
        "create index if not exists rag_document_chunks_source_file_idx on rag_document_chunks (source_file, chunk_index)",
      );
    } finally {
      client.release();
    }
  }

  private chunkText(text: string): Array<{ content: string }> {
    const normalized = text.replace(/\r/g, "").replace(/\n{3,}/g, "\n\n").trim();
    if (!normalized) {
      return [];
    }

    const chunks: Array<{ content: string }> = [];
    let start = 0;
    while (start < normalized.length) {
      let end = Math.min(start + this.chunkSize, normalized.length);
      if (end < normalized.length) {
        const paragraphBreak = normalized.lastIndexOf("\n\n", end);
        const lineBreak = normalized.lastIndexOf("\n", end);
        const wordBreak = normalized.lastIndexOf(" ", end);
        const candidate = [paragraphBreak, lineBreak, wordBreak].find(
          (index) => index > start + this.chunkSize * 0.6,
        );
        if (candidate) {
          end = candidate;
        }
      }

      const content = normalized.slice(start, end).trim();
      if (content) {
        chunks.push({ content });
      }

      if (end >= normalized.length) {
        break;
      }

      start = Math.max(end - this.chunkOverlap, start + 1);
    }

    return chunks;
  }

  private async embedTexts(texts: string[]): Promise<number[][]> {
    if (!this.aiClient) {
      throw new Error("GOOGLE_API_KEY is not configured");
    }

    const vectors: number[][] = [];
    for (const text of texts) {
      const response = await this.aiClient.models.embedContent({
        model: this.embeddingModel,
        contents: text,
      });
      const rawVector = response.embeddings?.[0]?.values;
      if (!rawVector) {
        throw new Error("Embedding model returned no vector values");
      }
      vectors.push(Array.from(rawVector));
    }
    return vectors;
  }

  private parseEmbedding(value: number[] | string): number[] {
    if (Array.isArray(value)) {
      return value.map(Number);
    }

    const parsed = JSON.parse(value) as number[];
    return parsed.map(Number);
  }

  private describeError(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    return String(error);
  }
}

function cosineSimilarity(left: number[], right: number[]): number {
  if (left.length === 0 || right.length === 0 || left.length !== right.length) {
    return 0;
  }

  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;

  for (let index = 0; index < left.length; index++) {
    dot += left[index] * right[index];
    leftNorm += left[index] * left[index];
    rightNorm += right[index] * right[index];
  }

  if (leftNorm === 0 || rightNorm === 0) {
    return 0;
  }

  return dot / (Math.sqrt(leftNorm) * Math.sqrt(rightNorm));
}
