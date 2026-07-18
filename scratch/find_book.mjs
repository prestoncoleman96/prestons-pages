import fs from 'fs';
import path from 'path';

const data = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'embeddings.json'), 'utf8'));
console.log('Total books loaded:', data.length);

const query = 'Reformatory';
const matches = data.filter(b => {
  const title = b.Title || b.title || '';
  const author = b.Authors || b.authors || b.Author || b.author || '';
  return title.toLowerCase().includes(query.toLowerCase()) || author.toLowerCase().includes(query.toLowerCase());
});

console.log('Matches:', JSON.stringify(matches, null, 2));
