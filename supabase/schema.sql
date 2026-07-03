-- ─────────────────────────────────────────────────────────────
-- TQ Chatbot #1 — Supabase schema
-- Run this in the Supabase SQL editor on a fresh project.
-- ─────────────────────────────────────────────────────────────

create extension if not exists "pgcrypto";

-- ── tenants ──────────────────────────────────────────────────
create table if not exists tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  system_prompt text not null,
  knowledge_base text,
  calendly_url text,
  scoring_weights jsonb default '{"weight_bl":1.5,"weight_bs":2.0,"weight_pc":1.5,"weight_u":2.0,"weight_da":1.0}',
  hot_threshold float default 12.0,
  warm_threshold float default 6.0,
  branding jsonb default '{}',
  notification_email text,
  n8n_webhook_url text,
  is_active boolean default true,
  created_at timestamptz default now()
);

-- ── conversations ────────────────────────────────────────────
create table if not exists conversations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id) on delete cascade,
  state text default 'GREETING',
  is_test boolean default false,
  started_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ── messages ──────────────────────────────────────────────────
create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references conversations(id) on delete cascade,
  role text check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz default now()
);

-- ── leads ─────────────────────────────────────────────────────
create table if not exists leads (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references conversations(id) on delete cascade,
  tenant_id uuid references tenants(id),
  email text,
  score float default 0,
  state text default 'GREETING',
  signals jsonb default '{}',
  priority text check (priority in ('hot', 'warm', 'cold')) default 'cold',
  notified boolean default false,
  is_test boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_messages_conversation on messages(conversation_id, created_at);
create index if not exists idx_conversations_tenant on conversations(tenant_id);
create index if not exists idx_leads_tenant on leads(tenant_id, updated_at desc);
create unique index if not exists idx_leads_conversation on leads(conversation_id);

-- ─────────────────────────────────────────────────────────────
-- Row Level Security
-- The backend uses the SERVICE ROLE key, which bypasses RLS. Enabling
-- RLS with no public policies ensures the anon/public key can never read
-- conversations or leads directly — only the backend service can.
-- ─────────────────────────────────────────────────────────────
alter table tenants enable row level security;
alter table conversations enable row level security;
alter table messages enable row level security;
alter table leads enable row level security;

-- (No permissive policies for anon/authenticated → only service role access.)
