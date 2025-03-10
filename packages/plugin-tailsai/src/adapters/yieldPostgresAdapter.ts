import { IAgentRuntime, Memory, UUID, elizaLogger, embed } from "@elizaos/core";
import pg from "pg";
import fs from "fs";
import path from "path";

const { Pool } = pg;

const __dirname = path.dirname(new URL(import.meta.url).pathname);
const migrationPath = path.resolve(__dirname, "../src/migrations/yield-schema.sql");
const migrationSql = fs.readFileSync(migrationPath, "utf8");

export const yieldPostgresAdapter = {
    init: (runtime: IAgentRuntime): any => {
        const postgresUrl = runtime.getSetting("POSTGRES_URL");
        if (!postgresUrl) {
            throw new Error("POSTGRES_URL is not set");
        }

        const pool = new Pool({ connectionString: postgresUrl });

        // Apply migration on initialization
        pool.query(migrationSql).catch(err => {
            console.error("Failed to apply yield-schema.sql:", err);
            throw err;
        });

        return {
            async createYieldRecord(poolData: any): Promise<void> {
                const id = crypto.randomUUID() as UUID;
                const embeddingText = `${poolData.chain} ${poolData.project} ${poolData.symbol} TVL: ${poolData.tvlUsd} APY: ${poolData.apy}`;
                const embedding = await generateEmbedding(embeddingText, runtime);
                
                // Provide fallbacks for all potentially null fields
                const poolid = poolData.pool || poolData.poolId || id;
                
                await pool.query(
                    `INSERT INTO yield_data (
                        id, chain, project, symbol, tvlUsd, apy, apyBase, apyReward, apyMean30d, apyPct1D, apyPct7D, apyPct30D,
                        rewardTokens, predictions, poolid, timestamp, createdAt, embedding
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)`,
                    [
                        id, 
                        poolData.chain || 'Unknown', 
                        poolData.project || 'Unknown', 
                        poolData.symbol || 'Unknown', 
                        poolData.tvlUsd || 0,
                        poolData.apy || 0, 
                        poolData.apyBase || 0, 
                        poolData.apyReward || 0, 
                        poolData.apyMean30d || 0,
                        poolData.apyPct1D || 0, 
                        poolData.apyPct7D || 0, 
                        poolData.apyPct30D || 0,
                        JSON.stringify(poolData.rewardTokens || []),
                        JSON.stringify(poolData.predictions || {}), 
                        poolid,
                        new Date(), 
                        new Date(),
                        embedding ? `[${embedding.join(",")}]` : null
                    ]
                );
            },

            async getYieldRecords(params: { roomId: UUID; count?: number }): Promise<Memory[]> {
                const query = `SELECT * FROM yield_data ORDER BY createdAt DESC ${params.count ? `LIMIT ${params.count}` : ''}`;
                const { rows } = await pool.query(query);
                return rows.map(row => ({
                    id: row.id,
                    userId: row.roomId,
                    agentId: row.roomId,
                    roomId: params.roomId,
                    content: { text: JSON.stringify(row) },
                    createdAt: row.createdAt
                }));
            },

            async searchYieldRecords(embedding: number[], params: { match_threshold: number; match_count: number }): Promise<Memory[]> {
                const vectorStr = `[${embedding.join(",")}]`;
                const { rows } = await pool.query(
                    `SELECT *, 1 - (embedding <-> $1::vector) as similarity FROM yield_data 
                     WHERE embedding IS NOT NULL AND 1 - (embedding <-> $1::vector) >= $2 
                     ORDER BY embedding <-> $1::vector LIMIT $3`,
                    [vectorStr, params.match_threshold, params.match_count]
                );
                return rows.map(row => ({
                    id: row.id,
                    userId: row.roomId,
                    agentId: row.roomId,
                    roomId: row.roomId,
                    content: { text: JSON.stringify(row) },
                    similarity: row.similarity
                }));
            },

            async close(): Promise<void> {
                await pool.end();
            }
        };
    }
};

async function generateEmbedding(text: string, runtime: IAgentRuntime): Promise<number[] | null> {
    // Use the core embedding utility with the runtime context
    let embedding = null;
    try {
      embedding = await embed(runtime, text);
    } catch (err) {
      elizaLogger.warn(`Failed to generate embedding, continuing without it: ${err}`);
    }

    return embedding;
}