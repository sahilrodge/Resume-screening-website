-- Initial PostgreSQL setup for AI Recruitment Management System
-- Runs automatically on first container start (Docker).

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Ensure database encoding/timezone defaults are sensible
COMMENT ON DATABASE recruitment_db IS 'AI Recruitment Management System';
