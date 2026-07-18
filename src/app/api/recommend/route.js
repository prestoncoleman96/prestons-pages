import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenAI } from '@google/genai';
import Papa from 'papaparse';

// Set runtime config if needed
export const dynamic = 'force-dynamic';

// Cache parsed local embeddings in memory to speed up warm-start requests
let cachedEmbeddings = null;

// Helper to strip HTML tags and clean up common entities
function stripHtml(html) {
  if (!html) return '';
  return html
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .replace(/&nbsp;/g, ' ')  // Clean common entities
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')     // Normalize whitespaces
    .trim();
}

// Helper to calculate cosine similarity between two vectors
function cosineSimilarity(vecA, vecB) {
  if (!vecA || !vecB || vecA.length !== vecB.length) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// Helper to load CSV data
function loadLocalCSV() {
  try {
    const csvPath = path.resolve(process.cwd(), 'books.csv');
    if (!fs.existsSync(csvPath)) {
      console.warn(`CSV file not found at ${csvPath}`);
      return [];
    }
    const csvData = fs.readFileSync(csvPath, 'utf8');
    const parsed = Papa.parse(csvData, {
      header: true,
      skipEmptyLines: true,
    });
    return parsed.data;
  } catch (error) {
    console.error('Failed to load local CSV:', error);
    return [];
  }
}

// Simple keyword matching helper for local fallback mode
function findLocalCandidates(books, favoriteBooks, vibe) {
  if (!books || books.length === 0) return [];

  // 1. Clean stop words from search query to find keywords
  const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'is', 'are', 'was', 'were', 'to', 'for', 'in', 'on', 'at', 'by', 'of', 'with', 'about', 'like', 'i', 'my', 'me', 'you', 'he', 'she', 'they', 'we']);
  const cleanTokens = (text) => {
    if (!text) return [];
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(token => token.length > 2 && !stopWords.has(token));
  };

  const vibeKeywords = cleanTokens(vibe);
  const favBookKeywords = favoriteBooks.flatMap(b => cleanTokens(b));
  const allKeywords = [...new Set([...vibeKeywords, ...favBookKeywords])];

  // 2. Score each book in the CSV
  const scoredBooks = books.map(book => {
    let score = 0;
    const title = (book.Title || book.title || '').toLowerCase();
    const author = (book.Authors || book.authors || book.Author || book.author || '').toLowerCase();
    const description = (book.Description || book.description || '').toLowerCase();
    const review = (book.Review || book.review || book.MyReview || book.my_review || '').toLowerCase();
    const genre = (book.Genre || book.genre || '').toLowerCase();

    // High points for matching favorite books
    favoriteBooks.forEach(fav => {
      const favLower = fav.toLowerCase();
      if (title.includes(favLower) || favLower.includes(title)) {
        score += 15;
      }
    });

    // Score based on keywords
    allKeywords.forEach(keyword => {
      if (title.includes(keyword)) score += 8;
      if (author.includes(keyword)) score += 8;
      if (genre.includes(keyword)) score += 5;
      if (description.includes(keyword)) score += 1;
      if (review.includes(keyword)) score += 1.5;
    });

    // Boost high rated books slightly
    const rating = parseFloat(book['Star Rating'] || book.MyRating || book.my_rating || book.rating || '0') || 0;
    score += rating * 0.5;

    return { book, score };
  });

  // Sort and select top candidates
  scoredBooks.sort((a, b) => b.score - a.score);
  
  // Return top 15 candidates. If no matching keywords (scores very low), return a diverse set of 15 books.
  const topCandidates = scoredBooks.slice(0, 15).map(item => item.book);
  if (scoredBooks[0]?.score <= 2.5) {
    // Return a random selection from top rated books
    const highRated = books.filter(b => parseFloat(b['Star Rating'] || b.MyRating || b.my_rating || b.rating || '0') >= 4.0);
    const pool = highRated.length > 0 ? highRated : books;
    return pool.sort(() => 0.5 - Math.random()).slice(0, 15);
  }

  return topCandidates;
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { name, vibe, favoriteBooks = [] } = body;

    if (!vibe) {
      return Response.json({ error: 'Reading vibe description is required.' }, { status: 400 });
    }

    const geminiApiKey = process.env.GEMINI_API_KEY;
    if (!geminiApiKey) {
      return Response.json({ error: 'GEMINI_API_KEY is not configured in .env.local' }, { status: 500 });
    }

    const ai = new GoogleGenAI({ apiKey: geminiApiKey });

    // Determine mode
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const isSupabaseConfigured = supabaseUrl && supabaseAnonKey;

    let candidates = [];
    let searchMode = 'Local CSV';

    const embeddingsPath = path.resolve(process.cwd(), 'embeddings.json');
    const hasLocalEmbeddings = fs.existsSync(embeddingsPath);

    // 1. If local vector database or Supabase is available, we generate a query embedding
    if (hasLocalEmbeddings || isSupabaseConfigured) {
      try {
        const queryText = `Vibe: ${vibe}\nFavorite Books: ${favoriteBooks.join(', ')}`;
        const embedResponse = await ai.models.embedContent({
          model: 'gemini-embedding-2',
          contents: queryText,
          config: {
            outputDimensionality: 768,
          },
        });

        let queryEmbedding;
        if (embedResponse.embedding && embedResponse.embedding.values) {
          queryEmbedding = embedResponse.embedding.values;
        } else if (embedResponse.embeddings) {
          if (Array.isArray(embedResponse.embeddings) && embedResponse.embeddings.length > 0) {
            queryEmbedding = embedResponse.embeddings[0].values;
          } else if (embedResponse.embeddings.values) {
            queryEmbedding = embedResponse.embeddings.values;
          }
        }

        if (queryEmbedding) {
          // Priority A: Search local JSON vector database (Option B)
          if (hasLocalEmbeddings) {
            if (!cachedEmbeddings) {
              console.log('Loading and parsing local embeddings.json into memory cache...');
              cachedEmbeddings = JSON.parse(fs.readFileSync(embeddingsPath, 'utf8'));
            }
            const scored = cachedEmbeddings
              .map(b => ({
                book: b,
                similarity: cosineSimilarity(queryEmbedding, b.embedding)
              }))
              .sort((a, b) => b.similarity - a.similarity);

            candidates = scored.slice(0, 10).map(item => item.book);
            searchMode = 'Local Vector (JSON)';
          }
          // Priority B: Search Supabase pgvector if local vector file is missing
          else if (isSupabaseConfigured) {
            const supabase = createClient(supabaseUrl, supabaseAnonKey);
            const { data: dbMatches, error: dbError } = await supabase.rpc('match_books', {
              query_embedding: queryEmbedding,
              match_threshold: 0.15,
              match_count: 8,
            });

            if (!dbError && dbMatches && dbMatches.length > 0) {
              candidates = dbMatches;
              searchMode = 'Supabase pgvector';
            }
          }
        }
      } catch (embedErr) {
        console.error('Vector search failed, falling back to local keyword matching:', embedErr.message);
      }
    }

    // Priority C: Fallback to local keyword search if no candidates were found
    if (candidates.length === 0) {
      const allBooks = loadLocalCSV();
      if (allBooks.length === 0) {
        return Response.json({
          error: 'No books list available. Please upload a books.csv to the project directory.',
        }, { status: 404 });
      }
      candidates = findLocalCandidates(allBooks, favoriteBooks, vibe);
    }

    // Filter out candidates that match the user's favorite books list (they already read them)
    const favoriteTitles = (favoriteBooks || [])
      .map(t => (t || '').trim().toLowerCase())
      .filter(t => t.length > 0);

    let filteredCandidates = candidates.filter(c => {
      const cTitle = (c.Title || c.title || '').trim().toLowerCase();
      if (!cTitle) return true;
      return !favoriteTitles.some(fav => cTitle === fav || cTitle.includes(fav) || fav.includes(cTitle));
    });

    if (filteredCandidates.length === 0) {
      filteredCandidates = candidates;
    }

    // Construct generation prompt for Gemini
    const prompt = `You are a personal book recommendation advisor.
A user named "${name || 'Reader'}" has requested a personalized book recommendation.

Visitor Profile:
- Vibe / Reading Mood: "${vibe}"
- 1-3 Favorite Books: [${favoriteBooks.join(', ')}]

Here are some candidate books from my personal reading library (the library contains over 1,200 books I've read and rated):
${filteredCandidates.map((c, i) => {
  const cTitle = c.Title || c.title;
  const cAuthor = c.Authors || c.authors || c.Author || c.author;
  const cGenre = c.Genre || c.genre || 'General';
  const cRating = c['Star Rating'] || c.MyRating || c.my_rating || 'N/A';
  const cReview = stripHtml(c.Review || c.review || c.MyReview || c.my_review || 'No notes left');
  const cDesc = c.Description || c.description || 'No synopsis';
  const cIsbn = c['ISBN/UID'] || c.isbn || c.uid || '';
  return `${i + 1}. Title: "${cTitle}"
   Author: ${cAuthor}
   Genre: ${cGenre}
   My Rating: ${cRating}/5
   My Notes/Review: "${cReview}"
   Synopsis: "${cDesc}"
   ISBN: "${cIsbn}"`;
}).join('\n\n')}

Based on the visitor's vibe and favorite books, select the SINGLE BEST book from my personal library candidates to recommend to them.
DO NOT recommend any book that is not in the candidate list above.

Provide your response in JSON format. Use the following keys:
{
  "title": "Title of the recommended book",
  "author": "Author of the recommended book",
  "genre": "The specific genre of the book, determined by you (infer the actual genre of the book from your knowledge, e.g. 'Gothic Thriller', 'Science Fiction', 'Non-Fiction', 'Fantasy', 'Biography' - do not output 'General' or 'Uncategorized')",
  "myRating": "My reading rating, e.g. 5 or 4.5",
  "myReview": "My personal review or notes of this book from the candidate list",
  "recommendedReason": "A cozy, warm, and highly personalized letter explaining why I believe they will love this book based on their vibe and the books they like. Make it feel authentic, referencing their inputs and writing it from my perspective (e.g. 'Since you love the quiet nature of...'). Keep it around 3-4 sentences.",
  "isbn": "The exact ISBN/UID value for this book from the candidate list (must match exactly, e.g. 9781982188344)"
}`;

    // Call Gemini API to select and write recommendation
    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'OBJECT',
          properties: {
            title: { type: 'STRING' },
            author: { type: 'STRING' },
            genre: { type: 'STRING' },
            myRating: { type: 'STRING' },
            myReview: { type: 'STRING' },
            recommendedReason: { type: 'STRING' },
            isbn: { type: 'STRING' },
          },
          required: ['title', 'author', 'genre', 'myRating', 'myReview', 'recommendedReason', 'isbn'],
        },
      },
    });

    let responseText = response.text || '';
    console.log('Raw Gemini response:', responseText);

    // Clean up potential markdown formatting wrapping the JSON
    let cleanText = responseText.trim();
    if (cleanText.startsWith('```')) {
      cleanText = cleanText.replace(/^```[a-zA-Z]*\n?/, '');
      cleanText = cleanText.replace(/```$/, '');
    }
    cleanText = cleanText.trim();

    const recommendationData = JSON.parse(cleanText);
    
    if (recommendationData.myReview) {
      recommendationData.myReview = stripHtml(recommendationData.myReview);
    }
    
    // Attach search mode meta data
    recommendationData.searchMode = searchMode;

    // Log the recommendation query & output to Supabase in the background
    if (isSupabaseConfigured) {
      try {
        const supabase = createClient(supabaseUrl, supabaseAnonKey);
        const { error: logError } = await supabase
          .from('recommendation_logs')
          .insert({
            reader_name: name || 'Reader',
            vibe: vibe,
            favorite_books: favoriteBooks,
            recommended_title: recommendationData.title,
            recommended_author: recommendationData.author,
            recommended_reason: recommendationData.recommendedReason,
            search_mode: searchMode,
          });

        if (logError) {
          console.warn('Warning: Failed to insert recommendation log to Supabase:', logError.message);
        } else {
          console.log('Successfully logged recommendation to Supabase.');
        }
      } catch (logErr) {
        console.warn('Warning: Exception logging recommendation to Supabase:', logErr.message);
      }
    }

    return Response.json(recommendationData);
  } catch (error) {
    console.error('Recommendation API error:', error);
    return Response.json({ error: 'Failed to generate recommendation. Please check server logs and configuration.' }, { status: 500 });
  }
}
