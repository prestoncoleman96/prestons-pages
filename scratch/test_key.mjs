import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const apiKey = process.env.GEMINI_API_KEY;
console.log('Using API key:', apiKey);

try {
  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContent({
    model: 'gemini-3.5-flash',
    contents: 'Hello, are you functional?',
  });
  console.log('Gemini responded successfully:', response.text);
} catch (err) {
  console.error('Gemini API call failed:');
  console.error(err);
}
