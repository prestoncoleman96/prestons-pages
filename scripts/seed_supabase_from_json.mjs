import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Error: Please configure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const JSON_PATH = path.resolve(__dirname, '../embeddings.json');

async function run() {
  if (!fs.existsSync(JSON_PATH)) {
    console.error(`JSON file not found at: ${JSON_PATH}`);
    process.exit(1);
  }

  console.log('Reading embeddings.json...');
  const data = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8'));
  console.log(`Found ${data.length} books in JSON.`);

  console.log('Fetching existing books in Supabase to determine delta...');
  const { data: existingBooks, error: fetchError } = await supabase
    .from('books')
    .select('title, author');

  if (fetchError) {
    console.error('Failed to fetch existing books:', fetchError.message);
    process.exit(1);
  }

  const existingKeys = new Set(
    (existingBooks || []).map(b => `${(b.title || '').trim().toLowerCase()}|${(b.author || '').trim().toLowerCase()}`)
  );
  console.log(`Found ${existingKeys.size} books already in Supabase.`);

  // Filter out books that are already in Supabase
  const toInsert = data.filter(b => {
    const title = b.Title || b.title;
    const author = b.Authors || b.authors || b.Author || b.author;
    const key = `${(title || '').trim().toLowerCase()}|${(author || '').trim().toLowerCase()}`;
    return !existingKeys.has(key);
  });

  console.log(`Need to upload ${toInsert.length} new books.`);

  if (toInsert.length === 0) {
    console.log('Database is already up to date!');
    return;
  }

  // Batch insert to Supabase (100 at a time)
  const BATCH_SIZE = 100;
  for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
    const batch = toInsert.slice(i, i + BATCH_SIZE).map(b => ({
      title: b.Title || b.title,
      author: b.Authors || b.authors || b.Author || b.author,
      description: b.Description || b.description || '',
      my_rating: parseFloat(b['Star Rating'] || b.MyRating || b.my_rating || b.rating || '0') || null,
      my_review: b.Review || b.review || b.MyReview || b.my_review || '',
      genre: b.Genre || b.genre || 'Uncategorized',
      embedding: b.embedding
    }));

    console.log(`Uploading batch ${Math.floor(i / BATCH_SIZE) + 1} (${batch.length} books)...`);
    const { error } = await supabase.from('books').insert(batch);

    if (error) {
      console.error('❌ Failed to insert batch:', error.message);
      process.exit(1);
    }
  }

  console.log('✅ Successfully seeded Supabase from embeddings.json without calling Gemini!');
}

run();
