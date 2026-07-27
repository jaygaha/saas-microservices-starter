# Database

PostgreSQL 18 schema for the identity domain, managed with **golang-migrate**.

- **Migrations:** `migrations/`: run via `make migrate` / `make migrate-down` / `make migrate-version`
- **Conventions:** `uuidv7()` PKs · `citext` for email/slug · `timestamptz` everywhere · soft delete via `deleted_at` + partial unique indexes (`WHERE deleted_at IS NULL`)

## Schema

```mermaid
erDiagram
    users ||--o{ team_members : "member of"
    teams ||--o{ team_members : "has"
    users ||--o{ teams : "created"

    users {
        uuid id PK
        citext email UK "unique among active"
        text password_hash
        text full_name
        timestamptz deleted_at "NULL = active"
        timestamptz created_at
        timestamptz updated_at
    }
    teams {
        uuid id PK
        text name
        citext slug UK "unique among active"
        uuid created_by FK
        timestamptz deleted_at "NULL = active"
        timestamptz created_at
        timestamptz updated_at
    }
    team_members {
        uuid team_id PK,FK
        uuid user_id PK,FK
        team_role role "owner|admin|member|viewer"
        timestamptz deleted_at "NULL = active"
        timestamptz created_at
        timestamptz updated_at
    }
```

`team_members` is the join table between `users` and `teams` (many-to-many) and carries each member's role. `teams.created_by` references the user who created the team.
