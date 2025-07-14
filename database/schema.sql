-- This file represents the current state of your public database schema.
-- It is intended to be updated manually after changes are made via the Supabase SQL Editor.
-- This is NOT a migration file, but a snapshot of the full schema.

-- Set a search path for the public schema
SET search_path = public, pg_catalog;

-- IMPORTANT: These DROP statements are for development/re-initialization purposes.
-- Use with extreme caution in any environment with existing data.
-- Uncomment if you need to completely reset your public schema.
-- DROP TABLE IF EXISTS public.conversations CASCADE;
-- DROP TABLE IF EXISTS public.creators CASCADE;
-- DROP TABLE IF EXISTS public.templates CASCADE;
-- DROP TABLE IF EXISTS public.profiles CASCADE;

-- 1. Create public.profiles table (Managers' Profiles)
CREATE TABLE IF NOT EXISTS public.profiles (
    id uuid NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    full_name text,
    email text UNIQUE,
    CONSTRAINT profiles_email_key UNIQUE (email)
);
COMMENT ON TABLE public.profiles IS 'Stores public-facing profile information for each user (manager).';

-- 2. Create public.templates table
-- Note: It's good practice to create tables referenced by foreign keys first.
CREATE TABLE IF NOT EXISTS public.templates (
    id uuid NOT NULL PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE, -- Manager who owns the template
    name text NOT NULL,
    prompt_content text NOT NULL, -- The actual prompt for the AI
    description text,
    is_default boolean NOT NULL DEFAULT false, -- For application-provided default templates
    CONSTRAINT templates_name_user_id_unique UNIQUE (name, user_id)
);
COMMENT ON TABLE public.templates IS 'Stores AI prompt templates created by managers.';

-- 3. Create public.creators table
CREATE TABLE IF NOT EXISTS public.creators (
    id uuid NOT NULL PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE, -- Manager who added this creator
    name text NOT NULL, -- Creator's display name
    email_address text NOT NULL UNIQUE, -- Creator's Gmail address
    status text NOT NULL DEFAULT 'onboarding', -- 'onboarding', 'active', 'inactive', 'paused'
    gmail_refresh_token text NOT NULL, -- Token necessary for offline calls to Gmail API
    gmail_history_id text, -- Last known Gmail history ID for push notifications
    automation_mode text NOT NULL DEFAULT 'assistant', -- 'assistant' (MVP), 'agent' (future)
    preferred_template_id uuid REFERENCES public.templates(id), -- Default template for this creator
    context_pool text, -- Simple text field for MVP context
    CONSTRAINT creators_email_address_key UNIQUE (email_address)
);
COMMENT ON TABLE public.creators IS 'Stores information about connected creator inboxes.';

-- 4. Create public.conversations table
CREATE TABLE IF NOT EXISTS public.conversations (
    id uuid NOT NULL PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    creator_id uuid NOT NULL REFERENCES public.creators(id) ON DELETE CASCADE, -- Creator associated with this conversation
    thread_id text NOT NULL UNIQUE, -- Unique Gmail thread ID
    subject text, -- Email subject
    last_message_date timestamp with time zone, -- Date of the last message in the thread
    status text NOT NULL DEFAULT 'new', -- 'new', 'draft_generated', 'waiting_reply', 'closed', 'action_required'
    summary text, -- AI-generated or manual summary
    draft_response text, -- AI-generated draft response for 'assistant' mode
    CONSTRAINT conversations_thread_id_key UNIQUE (thread_id)
);
COMMENT ON TABLE public.conversations IS 'Logs email threads processed by the AI system.';


-- Row Level Security (RLS) Policies
-- Ensure RLS is enabled for all tables (if not already)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

-- Policies for public.profiles
CREATE POLICY IF NOT EXISTS "Enable read access for own profile"
ON public.profiles
FOR SELECT
USING (auth.uid() = id);

CREATE POLICY IF NOT EXISTS "Enable update for own profile"
ON public.profiles
FOR UPDATE
USING (auth.uid() = id);

CREATE POLICY IF NOT EXISTS "Enable insert for own profile"
ON public.profiles
FOR INSERT
WITH CHECK (auth.uid() = id);


-- Policies for public.creators
CREATE POLICY IF NOT EXISTS "Enable read access for creators owned by user"
ON public.creators
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Enable insert for creators owned by user"
ON public.creators
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Enable update for creators owned by user"
ON public.creators
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Enable delete for creators owned by user"
ON public.creators
FOR DELETE
USING (auth.uid() = user_id);


-- Policies for public.templates
CREATE POLICY IF NOT EXISTS "Enable read access for templates owned by user"
ON public.templates
FOR SELECT
USING (auth.uid() = user_id OR is_default = TRUE);

CREATE POLICY IF NOT EXISTS "Enable insert for templates owned by user"
ON public.templates
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Enable update for templates owned by user"
ON public.templates
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Enable delete for templates owned by user"
ON public.templates
FOR DELETE
USING (auth.uid() = user_id);


-- Policies for public.conversations
CREATE POLICY IF NOT EXISTS "Enable read access for conversations of owned creators"
ON public.conversations
FOR SELECT
USING (EXISTS (SELECT 1 FROM public.creators WHERE creators.id = conversations.creator_id AND creators.user_id = auth.uid()));
