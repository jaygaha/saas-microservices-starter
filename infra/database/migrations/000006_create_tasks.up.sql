CREATE TYPE task_status AS ENUM ('todo', 'in_progress', 'done');

CREATE TABLE IF NOT EXISTS tasks (
    id uuid PRIMARY KEY DEFAULT uuidv7(),
    board_id uuid NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
    title text NOT NULL,
    description text NULL,
    status task_status NOT NULL DEFAULT 'todo',
    assignee_id uuid NULL REFERENCES users(id),
    created_by uuid NOT NULL REFERENCES users(id),
    deleted_at timestamptz NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Active tasks on a board.
CREATE INDEX tasks_board_id_idx ON tasks (board_id) WHERE deleted_at IS NULL;
