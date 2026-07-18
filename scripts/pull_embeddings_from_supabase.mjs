import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import Papa from 'papaparse';
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
const CSV_PATH = path.resolve(__dirname, '../books.csv');

async function run() {
  // 1. Load ISBN map from books.csv
  const isbnMap = new Map();
  if (fs.existsSync(CSV_PATH)) {
    console.log('Loading ISBN map from books.csv...');
    const csvData = fs.readFileSync(CSV_PATH, 'utf8');
    const parsed = Papa.parse(csvData, { header: true, skipEmptyLines: true });
    parsed.data.forEach(book => {
      const title = book.Title || book.title || '';
      const author = book.Authors || book.authors || book.Author || book.author || '';
      const isbn = book['ISBN/UID'] || book.isbn || book.uid || '';
      if (title && author && isbn) {
        const key = `${title.trim().toLowerCase()}|${author.trim().toLowerCase()}`;
        isbnMap.set(key, isbn);
      }
    });
    console.log(`Loaded ${isbnMap.size} ISBNs from CSV.`);
  }

  // 2. Download all books with embeddings from Supabase
  console.log('Fetching all books with embeddings from Supabase...');
  
  let allBooks = [];
  let from = 0;
  const step = 1000;
  let hasMore = true;

  while (hasMore) {
    console.log(`Downloading books from index ${from}...`);
    const { data, error } = await supabase
      .from('books')
      .select('title, author, description, my_rating, my_review, genre, embedding')
      .range(from, from + step - 1);

    if (error) {
      console.error('Error downloading from Supabase:', error.message);
      process.exit(1);
    }

    allBooks = allBooks.concat(data || []);
    if (!data || data.length < step) {
      hasMore = false;
    } else {
      from += step;
    }
  }

  console.log(`Successfully downloaded ${allBooks.length} books from Supabase.`);

  // 3. Format and join with ISBNs
  const formatted = allBooks.map(b => {
    const title = b.title || '';
    const author = b.author || '';
    const key = `${title.trim().toLowerCase()}|${author.trim().toLowerCase()}`;
    const isbn = isbnMap.get(key) || '';

    return {
      title,
      author,
      description: b.description || '',
      my_rating: b.my_rating,
      my_review: b.my_review || '',
      genre: b.genre || 'Uncategorized',
      isbn,
      embedding: b.embedding
    };
  });

  fs.writeFileSync(JSON_PATH, JSON.stringify(formatted));
  console.log(`✅ Successfully updated local ${JSON_PATH} with all ${formatted.length} books!`);
}

run();
