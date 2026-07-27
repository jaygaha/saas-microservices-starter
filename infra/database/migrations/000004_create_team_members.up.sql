-- Enum definition for team roles.
CREATE TYPE team_role AS ENUM ('owner', 'admin', 'member', 'viewer');

-- Table definition for team members.
CREATE TABLE team_members (
    team_id uuid NOT NULL REFERENCES teams ("id") ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES users ("id") ON DELETE CASCADE,
    role team_role NOT NULL DEFAULT 'member',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (team_id, user_id)
);

-- The PK already indexes (team_id, …) for "members of a team".
-- This adds the reverse lookup: "which teams does this user belong to?"
CREATE INDEX team_members_user_id_idx ON team_members (user_id);
