-- infra/database/seed.sql
-- Demo data for the Task Manager SaaS. Idempotent: safe to run repeatedly.
-- Run AFTER migrations:  make seed
-- All demo users share the password:  password123
BEGIN;
-- 1) Users — bcrypt hash of "password123" (cost 10)
INSERT INTO users (email, password_hash, full_name) 
VALUES 
  (
    'jay@example.com', '$2a$10$dHigm0TnHCVqZJ/N9Gf2vuy7vRdEunS2kUp.L/IZCJlelzfLI2tJC', 
    'Jay Gaha'
  ), 
  (
    'sato@example.com', '$2a$10$dHigm0TnHCVqZJ/N9Gf2vuy7vRdEunS2kUp.L/IZCJlelzfLI2tJC', 
    'Sato Honda'
  ), 
  (
    'laxmi@example.com', '$2a$10$dHigm0TnHCVqZJ/N9Gf2vuy7vRdEunS2kUp.L/IZCJlelzfLI2tJC', 
    'Laxmi Pun'
  ), 
  (
    'dave@example.com', '$2a$10$dHigm0TnHCVqZJ/N9Gf2vuy7vRdEunS2kUp.L/IZCJlelzfLI2tJC', 
    'Dave Diaz'
  ) ON CONFLICT (email) 
WHERE 
  deleted_at IS NULL DO NOTHING;
-- 2) Teams — some global, some per-tenant
INSERT INTO teams (name, slug, created_by) 
SELECT 
  v.name, v.slug, u.id 
FROM 
  (
    VALUES 
      (
        'Gaha Inc.', 'gaha-inc', 'jay@example.com'
      )
  ) AS v(name, slug, creator_email) 
  JOIN users u ON u.email = v.creator_email 
  AND u.deleted_at IS NULL ON CONFLICT (slug) 
WHERE 
  deleted_at IS NULL DO NOTHING;
-- 3) Memberships — one of every role
INSERT INTO team_members (team_id, user_id, role) 
SELECT 
  t.id, 
  u.id, 
  m.role :: team_role 
FROM 
  (
    VALUES 
      ('jay@example.com', 'owner'), 
      ('laxmi@example.com', 'admin'), 
      ('dave@example.com', 'member'), 
      ('sato@example.com', 'viewer')
  ) as m(email, role) 
  JOIN teams t ON t.slug = 'gaha-inc' 
  AND t.deleted_at IS NULL 
  JOIN users u ON u.email = m.email 
  AND u.deleted_at IS NULL ON CONFLICT (team_id, user_id) DO NOTHING;
-- 4) Boards — no natural unique key, so guard with NOT EXISTS
INSERT INTO boards (team_id, name, created_by) 
SELECT 
  t.id, 
  b.name, 
  u.id 
FROM 
  (
    VALUES 
      ('Product Roadmap'), 
      ('Engineering')
  ) as b(name) 
  JOIN teams t ON t.slug = 'gaha-inc' 
  AND t.deleted_at IS NULL 
  JOIN users u ON u.email = 'jay@example.com' 
  AND u.deleted_at IS NULL 
WHERE 
  NOT EXISTS (
    SELECT 
      1 
    FROM 
      boards x 
    WHERE 
      x.team_id = t.id 
      AND x.name = b.name 
      AND x.deleted_at IS NULL
  );
-- 5) Tasks — cover every column & assigned/unassigned
INSERT INTO tasks (
  board_id, title, description, status, 
  assignee_id, created_by
) 
SELECT 
  b.id, 
  d.title, 
  d.description, 
  d.status :: task_status, 
  a.id, 
  creator.id 
FROM 
  (
    VALUES 
      (
        'Product Roadmap', 'Define Q3 OKRs', 
        'Draft objectives and key results for the quarter.', 
        'todo', 'jay@example.com'
      ), 
      (
        'Product Roadmap', 'Competitive analysis', 
        'Survey the top 5 competitors.', 
        'todo', NULL
      ), 
      (
        'Product Roadmap', 'Draft pricing tiers', 
        'Free / Pro / Enterprise breakdown.', 
        'in_progress', 'laxmi@example.com'
      ), 
      (
        'Product Roadmap', 'Customer interview round 1', 
        'Five interviews with design partners.', 
        'done', 'dave@example.com'
      ), 
      (
        'Engineering', 'Set up CI pipeline', 
        'Lint, test and build on every push.', 
        'todo', 'laxmi@example.com'
      ), 
      (
        'Engineering', 'Build auth service', 
        'JWT access + rotating refresh tokens.', 
        'in_progress', 'jay@example.com'
      ), 
      (
        'Engineering', 'Kanban board UI', 
        'Three-column task board.', 'in_progress', 
        'dave@example.com'
      ), 
      (
        'Engineering', 'Database schema & migrations', 
        'uuidv7 PKs, soft deletes, partial indexes.', 
        'done', 'jay@example.com'
      )
  ) AS d(
    board_name, title, description, status, 
    assignee_email
  ) 
  JOIN teams t ON t.slug = 'gaha-inc' 
  AND t.deleted_at IS NULL 
  JOIN boards b ON b.team_id = t.id 
  AND b.name = d.board_name 
  AND b.deleted_at IS NULL 
  JOIN users creator ON creator.email = 'jay@example.com' 
  AND creator.deleted_at IS NULL 
  LEFT JOIN users a ON a.email = d.assignee_email 
  AND a.deleted_at IS NULL 
WHERE 
  NOT EXISTS (
    SELECT 
      1 
    FROM 
      tasks x 
    WHERE 
      x.board_id = b.id 
      AND x.title = d.title 
      AND x.deleted_at IS NULL
  );
COMMIT;
\echo '--- seed summary ---' 
SELECT 
  (
    SELECT 
      count(*) 
    FROM 
      users
  ) AS users, 
  (
    SELECT 
      count(*) 
    FROM 
      teams
  ) AS teams, 
  (
    SELECT 
      count(*) 
    FROM 
      team_members
  ) AS memberships, 
  (
    SELECT 
      count(*) 
    FROM 
      boards
  ) AS boards, 
  (
    SELECT 
      count(*) 
    FROM 
      tasks
  ) AS tasks;
