import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenAI } from '@google/genai';
import Papa from 'papaparse';
import dotenv from 'dotenv';

// Configure dotenv to read from .env.local
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY; // Service role is needed to bypass RLS for seeding
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Error: Please configure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

if (!GEMINI_API_KEY) {
  console.error('Error: Please configure GEMINI_API_KEY in .env.local');
  process.exit(1);
}

// Initialize clients
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

const CSV_PATH = path.resolve(__dirname, '../books.csv');

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getEmbedding(text) {
  try {
    const response = await ai.models.embedContent({
      model: 'gemini-embedding-2',
      contents: text,
      config: {
        outputDimensionality: 768,
      },
    });
    
    // Safely extract embedding vector across different response structures
    if (response.embedding && response.embedding.values) {
      return response.embedding.values;
    } else if (response.embeddings) {
      if (Array.isArray(response.embeddings) && response.embeddings.length > 0) {
        return response.embeddings[0].values;
      } else if (response.embeddings.values) {
        return response.embeddings.values;
      }
    }
    throw new Error('Failed to find embedding values in response');
  } catch (error) {
    console.error(`Embedding generation failed for text: "${text.substring(0, 50)}..."`);
    throw error;
  }
}

async function run() {
  if (!fs.existsSync(CSV_PATH)) {
    console.error(`CSV file not found at: ${CSV_PATH}`);
    process.exit(1);
  }

  console.log('Reading books.csv...');
  const csvData = fs.readFileSync(CSV_PATH, 'utf8');

  console.log('Parsing CSV...');
  const parsed = Papa.parse(csvData, {
    header: true,
    skipEmptyLines: true,
  });

  const books = parsed.data;
  console.log(`Found ${books.length} books in CSV.`);

  console.log('Checking existing books in Supabase to enable resuming...');
  const { data: existingBooks, error: fetchError } = await supabase
    .from('books')
    .select('title, author');

  if (fetchError) {
    console.error('Warning: Failed to fetch existing books:', fetchError.message);
  }

  const existingKeys = new Set(
    (existingBooks || []).map(b => `${(b.title || '').trim().toLowerCase()}|${(b.author || '').trim().toLowerCase()}`)
  );
  console.log(`Found ${existingKeys.size} books already seeded in Supabase.`);

  console.log('Starting book import and embedding generation...');
  let importedCount = 0;
  let failedCount = 0;

  for (let i = 0; i < books.length; i++) {
    const book = books[i];
    const title = book.Title || book.title;
    const author = book.Authors || book.authors || book.Author || book.author;
    const desc = book.Description || book.description || '';
    const rating = parseFloat(book['Star Rating'] || book.MyRating || book.rating || '0') || null;
    const review = book.Review || book.review || book.MyReview || book.my_review || '';
    const genre = book.Genre || book.genre || 'Uncategorized';

    if (!title || !author) {
      console.log(`Skipping row ${i + 1}: Missing Title or Author (Title: "${title}", Author: "${author}")`);
      continue;
    }

    const bookKey = `${(title || '').trim().toLowerCase()}|${(author || '').trim().toLowerCase()}`;
    if (existingKeys.has(bookKey)) {
      continue;
    }

    // Create a rich context for the embedding vector
    const embeddingInput = `Title: ${title}\nAuthor: ${author}\nGenre: ${genre}\nDescription: ${desc}\nMy Review: ${review}`;

    try {
      console.log(`[${i + 1}/${books.length}] Embedding & uploading: "${title}" by ${author}...`);
      const embedding = await getEmbedding(embeddingInput);

      const { error } = await supabase.from('books').insert({
        title,
        author,
        description: desc,
        my_rating: rating,
        my_review: review,
        genre,
        embedding,
      });

      if (error) {
        throw new Error(error.message);
      }

      importedCount++;
      // Sleep to avoid rate limits (approx 5 requests per second is very safe for free-tier Gemini API keys)
      await sleep(200);
    } catch (err) {
      console.error(`❌ Failed to import "${title}":`, err.message);
      failedCount++;
      // Wait longer on error in case of rate limiting
      await sleep(1000);
    }
  }

  console.log('\n--- Seeding Complete ---');
  console.log(`Successfully imported: ${importedCount} books`);
  console.log(`Failed to import: ${failedCount} books`);
}

run().catch((err) => {
  console.error('Fatal error during seed run:', err);
  process.exit(1);
});
