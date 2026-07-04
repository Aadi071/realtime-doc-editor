-- gen_random_uuid() comes from the pgcrypto extension.
create extension if not exists pgcrypto;

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  password_hash text not null,
  email_verified boolean not null default false,
  -- A short-lived numeric code emailed to prove this address is real and
  -- reachable, not just typed in. Nulled out once verified.
  email_verification_code text,
  email_verification_expires_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists documents (
  id uuid primary key default gen_random_uuid(),
  title text not null default 'Untitled document',
  -- Whoever created the document - always has full ("owner") access, and
  -- is the only one allowed to grant/change other people's access below.
  owner_id uuid references users(id),
  -- The full Yjs document state (from Y.encodeStateAsUpdate), saved on a
  -- debounce as people type, and loaded back when a document is reopened
  -- after the server has forgotten it (e.g. after a restart).
  content bytea,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create type doc_role as enum ('viewer', 'editor');

-- One row per (document, user) that ISN'T the owner - the owner's access
-- is implicit via documents.owner_id, not a row here.
create table if not exists document_shares (
  document_id uuid not null references documents(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  role doc_role not null default 'viewer',
  primary key (document_id, user_id)
);

-- Manually-saved snapshots of a document's full Yjs state, so people can
-- see and restore earlier points in time. Separate from the debounced
-- `documents.content` autosave, which only ever holds the LATEST state.
create table if not exists document_versions (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references documents(id) on delete cascade,
  content bytea not null,
  created_by uuid references users(id),
  created_at timestamptz not null default now()
);
