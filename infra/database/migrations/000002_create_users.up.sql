CREATE TABLE users (
    id uuid PRIMARY KEY DEFAULT uuidv7(),
    email citext NOT NULL,
    password_hash text NOT NULL,
    full_name  text,
    deleted_at timestamptz,  -- NULL = active; a timestamp = soft-deleted
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Email is unique only among ACTIVE users, so a soft-deleted email can be reused.
CREATE UNIQUE INDEX users_email_active_key ON users (email) WHERE deleted_at IS NULL;