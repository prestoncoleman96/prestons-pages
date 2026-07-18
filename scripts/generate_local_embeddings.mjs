import fs from 'fs';
import path from 'path';
import { GoogleGenAI } from '@google/genai';
import Papa from 'papaparse';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const CSV_PATH = path.resolve(__dirname, '../books.csv');
const JSON_PATH = path.resolve(__dirname, '../embeddings.json');
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  console.error('Error: GEMINI_API_KEY is not defined in .env.local');
  process.exit(1);
}

const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Strip HTML tags helper
function stripHtml(html) {
  if (!html) return '';
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

async function getEmbedding(text) {
  const response = await ai.models.embedContent({
    model: 'gemini-embedding-2',
    contents: text,
    config: {
      outputDimensionality: 768,
    },
  });
  
  if (response.embedding && response.embedding.values) {
    return response.embedding.values;
  } else if (response.embeddings && response.embeddings[0]) {
    return response.embeddings[0].values;
  }
  throw new Error('Unsupported response format from Gemini embedding API');
}

async function run() {
  console.log('Reading books.csv...');
  if (!fs.existsSync(CSV_PATH)) {
    console.error(`Error: CSV file not found at ${CSV_PATH}`);
    process.exit(1);
  }
  const csvData = fs.readFileSync(CSV_PATH, 'utf8');

  console.log('Parsing CSV...');
  const parsed = Papa.parse(csvData, {
    header: true,
    skipEmptyLines: true,
  });
  const csvBooks = parsed.data;
  console.log(`Found ${csvBooks.length} books in CSV.`);

  // Load existing local embeddings if file exists
  let localEmbeddings = [];
  if (fs.existsSync(JSON_PATH)) {
    console.log(`Loading existing embeddings from ${JSON_PATH}...`);
    try {
      localEmbeddings = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8'));
      console.log(`Loaded ${localEmbeddings.length} existing embeddings.`);
    } catch (e) {
      console.warn('Warning: Failed to parse existing embeddings.json, starting fresh:', e.message);
    }
  }

  // Map existing embeddings by title|author key for quick lookup
  const existingMap = new Map();
  for (const b of localEmbeddings) {
    if (b.title && b.author && b.embedding && Array.isArray(b.embedding)) {
      const key = `${b.title.trim().toLowerCase()}|${b.author.trim().toLowerCase()}`;
      existingMap.set(key, b);
    }
  }

  console.log('Starting local embedding generation...');
  const updatedList = [];
  let importedCount = 0;
  let skippedCount = 0;
  let failedCount = 0;

  for (let i = 0; i < csvBooks.length; i++) {
    const book = csvBooks[i];
    const title = book.Title || book.title;
    const author = book.Authors || book.authors || book.Author || book.author;
    const desc = book.Description || book.description || '';
    const rating = parseFloat(book['Star Rating'] || book.MyRating || book.rating || '0') || null;
    const rawReview = book.Review || book.review || book.MyReview || book.my_review || '';
    const review = stripHtml(rawReview);
    const genre = book.Genre || book.genre || 'Uncategorized';
    const isbn = book['ISBN/UID'] || book.isbn || book.uid || '';

    if (!title || !author) {
      continue;
    }

    const key = `${title.trim().toLowerCase()}|${author.trim().toLowerCase()}`;
    
    // Check if we already have a valid embedding for this book
    if (existingMap.has(key)) {
      const existing = existingMap.get(key);
      updatedList.push({
        title: existing.title || title,
        author: existing.author || author,
        description: existing.description || desc,
        my_rating: existing.my_rating || rating,
        my_review: existing.my_review || review,
        genre: existing.genre || genre,
        isbn: existing.isbn || isbn,
        embedding: existing.embedding,
      });
      skippedCount++;
      continue;
    }

    // Generate new embedding
    const embeddingInput = `Title: ${title}\nAuthor: ${author}\nGenre: ${genre}\nDescription: ${desc}\nMy Review: ${review}`;

    try {
      console.log(`[${i + 1}/${csvBooks.length}] Generating embedding for: "${title}" by ${author}...`);
      const embedding = await getEmbedding(embeddingInput);

      updatedList.push({
        title,
        author,
        description: desc,
        my_rating: rating,
        my_review: review,
        genre,
        isbn,
        embedding,
      });

      importedCount++;
      await sleep(200); // rate-limit safety sleep
    } catch (err) {
      console.error(`❌ Failed to embed "${title}":`, err.message);
      failedCount++;
      await sleep(1000); // sleep longer on rate limit errors
    }
  }

  // Save the complete updated list
  console.log(`\nWriting updated embeddings back to ${JSON_PATH}...`);
  fs.writeFileSync(JSON_PATH, JSON.stringify(updatedList, null, 2), 'utf8');
  
  console.log('--- Embeddings Process Complete ---');
  console.log(`Already existed (skipped): ${skippedCount}`);
  console.log(`Newly embedded: ${importedCount}`);
  console.log(`Failed to embed: ${failedCount}`);
  console.log(`Total books in local index: ${updatedList.length}`);
}

run().catch((err) => {
  console.error('Fatal error during seed run:', err);
});
