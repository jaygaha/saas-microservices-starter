CREATE TABLE teams (
    id uuid PRIMARY KEY DEFAULT uuidv7(),
    name text NOT NULL,
    slug citext NOT NULL,
    created_by uuid NOT NULL REFERENCES users (id),
    deleted_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Slug unique only among active teams (same soft-delete-safe pattern as users.email).
CREATE UNIQUE INDEX teams_slug_active_key ON teams (slug) WHERE deleted_at IS NULL;
