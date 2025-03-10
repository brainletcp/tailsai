CREATE TABLE IF NOT EXISTS yield_data (
    id UUID PRIMARY KEY,
    chain TEXT NOT NULL,
    project TEXT NOT NULL,
    symbol TEXT NOT NULL,
    tvlUsd DOUBLE PRECISION NOT NULL,
    apy DOUBLE PRECISION NOT NULL,
    apyBase DOUBLE PRECISION NOT NULL,
    apyReward DOUBLE PRECISION,
    apyMean30d DOUBLE PRECISION NOT NULL,
    apyPct1D DOUBLE PRECISION NOT NULL,
    apyPct7D DOUBLE PRECISION NOT NULL,
    apyPct30D DOUBLE PRECISION NOT NULL,
    rewardTokens JSONB,
    predictions JSONB,
    poolId TEXT NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    createdAt TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    embedding VECTOR(384)
);

CREATE INDEX IF NOT EXISTS idx_yield_data_pool_timestamp ON yield_data (poolId, timestamp);
CREATE INDEX IF NOT EXISTS idx_yield_data_embedding ON yield_data USING ivfflat (embedding vector_cosine_ops);