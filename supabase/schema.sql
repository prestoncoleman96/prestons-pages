-- Enable the pgvector extension to work with embedding vectors
create extension if not exists vector;

-- Create the books table
create table if not exists public.books (
  id bigint generated always as identity primary key,
  title text not null,
  author text not null,
  description text,
  my_rating numeric,
  my_review text,
  genre text,
  embedding vector(768), -- Using 768 dimensions for Gemini's text-embedding-004 model
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Index the embedding column for faster vector similarity search
-- Note: Ivory/HNSW indexes can be created later as the dataset grows, 
-- but for ~1000 books, an exact nearest neighbor search (flat) is extremely fast.
create index on public.books using ivfflat (embedding vector_cosine_ops) with (lists = 100);

-- Enable Row Level Security (RLS)
alter table public.books enable row level security;

-- Create a policy that allows anonymous read-only access (needed for client search)
create policy "Allow public read access" on public.books
  for select using (true);

-- Create a function to query book similarity
create or replace function match_books (
  query_embedding vector(768),
  match_threshold float,
  match_count int
)
returns table (
  id bigint,
  title text,
  author text,
  description text,
  my_rating numeric,
  my_review text,
  genre text,
  similarity float
)
language plpgsql
as $$
begin
  return query
  select
    books.id,
    books.title,
    books.author,
    books.description,
    books.my_rating,
    books.my_review,
    books.genre,
    1 - (books.embedding <=> query_embedding) as similarity
  from books
  where 1 - (books.embedding <=> query_embedding) > match_threshold
  order by books.embedding <=> query_embedding
  limit match_count;
end;
$$;

-- Create a table to log recommendations
create table if not exists public.recommendation_logs (
  id bigint generated always as identity primary key,
  reader_name text,
  vibe text,
  favorite_books text[],
  recommended_title text,
  recommended_author text,
  recommended_reason text,
  search_mode text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable Row Level Security (RLS) on recommendation_logs
alter table public.recommendation_logs enable row level security;

-- Allow anonymous inserts (anyone using the site can submit logs when they search)
create policy "Allow anonymous inserts" on public.recommendation_logs
  for insert with check (true);

-- Create a table to log reader feedback on recommendations
create table if not exists public.recommendation_feedback (
  id bigint generated always as identity primary key,
  recommendation_log_id bigint references public.recommendation_logs(id) on delete cascade,
  was_helpful boolean,
  already_read boolean,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable Row Level Security (RLS) on recommendation_feedback
alter table public.recommendation_feedback enable row level security;

-- Allow anonymous inserts (users can post feedback anonymously)
create policy "Allow anonymous feedback inserts" on public.recommendation_feedback
  for insert with check (true);
