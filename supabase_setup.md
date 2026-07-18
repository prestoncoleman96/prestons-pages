# Supabase Setup Guide for Preston's Pages

This guide walks you through setting up a Supabase project, configuring vector similarity search (pgvector), connecting the database to your Next.js application, and generating embedding vectors for your 1,239 personal books.

---

## 1. Create a New Supabase Project

1. Log into your [Supabase Dashboard](https://supabase.com/dashboard).
2. Click **New Project** and select your Organization.
3. Fill in the project details:
   - **Name**: e.g., `Prestons Pages` or `Book Recommender`
   - **Database Password**: Set a strong password (and write it down!)
   - **Region**: Choose the region closest to you or your target audience.
   - **Pricing Plan**: Select the **Free Tier**.
4. Click **Create new project** and wait a couple of minutes for your database instance to provision.

---

## 2. Set Up the Database Schema (pgvector)

We need to create the table structure, enable vector matching, and register the search function in your database.

1. Once your project is ready, navigate to the **SQL Editor** in the left sidebar (the icon looks like `>_`).
2. Click **New Query** to open a blank SQL sheet.
3. Copy the contents of the database schema file located in your project at [supabase/schema.sql](file:///c:/Users/scane/.gemini/antigravity/scratch/book-vibes-recommender/supabase/schema.sql) and paste it into the editor.
4. Click **Run** at the bottom-right.
5. You should see a success message (`Success. No rows returned`). This command:
   - Enables the `vector` extension.
   - Creates the `books` table with an `embedding` column matching Gemini's 768-dimension vectors.
   - Creates a similarity index.
   - Registers the `match_books` RPC function.

---

## 3. Retrieve Your Supabase API Credentials

To hook the app up, we need three keys from your Supabase dashboard:

1. Click on **Project Settings** (the gear icon at the bottom of the left sidebar).
2. Under settings, select **API**.
3. Copy the following values:
   - **Project URL**: Located in the *Project API keys* section (looks like `https://xxxxxx.supabase.co`).
   - **Project API Anon Key**: Located under *Project API keys* (the `anon` `public` key starting with `eyJ...`).
4. Next, click **JWT Settings** (under the API section) or scroll down to find the **Service Role Key**:
   - **Service Role Key**: The `service_role` `secret` key (starts with `eyJ...`). **WARNING**: Keep this key private. It bypasses database security rules and is used only by our script to safely upload/seed your books.

---

## 4. Configure Your Local Environment

Open your project's [.env.local](file:///c:/Users/scane/.gemini/antigravity/scratch/book-vibes-recommender/.env.local) file and populate the empty variables with your credentials:

```env
# Gemini API Key (Required for recommendations and seed script)
GEMINI_API_KEY=your-gemini-api-key-here

# Supabase Configurations
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-public-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-secret-key
```

*Note: The Next.js dev server will automatically restart and detect the credentials.*

---

## 5. Seed the Database & Generate Embeddings

Now we will run the seeding script. It will read your 1,239 personal books, use your Gemini API key to calculate a vector representation for each book's title, author, review, and synopsis, and upload them to Supabase:

1. Open your terminal in the project directory (`book-vibes-recommender`).
2. Stop the local dev server if it is running (press `Ctrl+C`).
3. Run the following command:
   ```bash
   node scripts/import_books.mjs
   ```
4. You will see progress logs indicating that the books are being embedded and uploaded:
   `[1/1239] Embedding & uploading: "The Reformatory" by Tananarive Due...`
5. The script sleeps briefly between items to ensure you do not exceed Gemini free-tier rate limits. Seeding 1,200 books will take roughly 3–4 minutes.

---

## 6. Verification and sharing

Once seeding is complete:
1. Restart your local server:
   ```bash
   npm run dev
   ```
2. Test the search! When you query a vibe, the app will display **"Library search engine: Supabase pgvector"** at the bottom of the card instead of "Local CSV". This means it is running semantic vector matching directly in your database!
3. To share this with others, you can deploy this Next.js app to **Vercel** (the easiest hosting platform for Next.js, completely free). During deployment, you just copy the same environment variables from your `.env.local` to Vercel's Environment Variables settings!
