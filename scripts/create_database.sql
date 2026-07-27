-- Create database and extensions for local (non-Docker) PostgreSQL installs.
-- Run as superuser, e.g.:
--   psql -U postgres -f scripts/create_database.sql

SELECT 'CREATE DATABASE recruitment_db'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'recruitment_db')\gexec

\c recruitment_db

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
