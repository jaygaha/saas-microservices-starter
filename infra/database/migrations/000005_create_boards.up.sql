CREATE TABLE IF NOT EXISTS boards (
    id uuid PRIMARY KEY DEFAULT uuidv7(),
    team_id uuid NOT NULL REFERENCES teams(id),
    name text NOT NULL,
    created_by uuid NOT NULL REFERENCES users(id),
    deleted_at timestamptz NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Active boards in a team — the common lookup.
CREATE INDEX boards_team_id_idx ON boards (team_id) WHERE deleted_at IS NULL;
