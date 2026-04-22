-- If you haven't created the database yet, run this first:
-- CREATE DATABASE flux_share;
-- \c flux_share;   (if using psql to switch connections to the new db)

-- Create the users table
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR NOT NULL UNIQUE,
    hashed_password VARCHAR,
    google_id VARCHAR UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes to speed up lookups (SQLAlchemy creates these automatically, so we'll do the same)
CREATE INDEX ix_users_id ON users (id);
CREATE INDEX ix_users_email ON users (email);
CREATE UNIQUE INDEX ix_users_google_id ON users (google_id);
