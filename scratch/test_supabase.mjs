import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('Testing Supabase Insertions...');

async function testInsert(name, key) {
  try {
    const supabase = createClient(supabaseUrl, key);
    const { data, error } = await supabase
      .from('recommendation_logs')
      .insert({
        reader_name: 'Diagnostic Test',
        vibe: 'Testing ' + name,
        favorite_books: ['Test Book'],
        recommended_title: 'Test Recommendation',
        recommended_author: 'Test Author',
        recommended_reason: 'Testing RLS policies',
        search_mode: 'Diagnostic',
      })
      .select('id');

    if (error) {
      console.log(`❌ Insertion using ${name} failed:`, error.message);
    } else {
      console.log(`✅ Insertion using ${name} succeeded! ID:`, data[0]?.id);
    }
  } catch (err) {
    console.log(`❌ Exception using ${name}:`, err.message);
  }
}

console.log('\n--- 1. Testing with Public Anon Key ---');
await testInsert('Anon Key', anonKey);

console.log('\n--- 2. Testing with Server Service Role Key ---');
await testInsert('Service Role Key', serviceKey);
