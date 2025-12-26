const fs = require('fs');
const path = require('path');

// Load new sound IDs/names
const newSounds = require('./new_ids.js'); // [{ name, id }, ...]

// Load existing sounds.json
const soundsPath = path.join(__dirname, 'sounds.json');
let existingData;

try {
  existingData = JSON.parse(fs.readFileSync(soundsPath, 'utf8'));
} catch (e) {
  console.error('Error reading sounds.json:', e);
  existingData = [];
}

// Ensure we have an array
const existingSounds = Array.isArray(existingData) ? existingData : existingData.sounds || [];

// Create sets for dedupe
const existingIDs = new Set(existingSounds.map(s => s.id));
const existingNames = new Set(existingSounds.map(s => s.name));

// Auto-tagging function
function autoTag(name) {
  const lower = name.toLowerCase();
  if (lower.includes('meme')) return ['meme'];
  if (lower.includes('music') || lower.includes('song') || lower.includes('theme')) return ['music'];
  if (lower.includes('kill') || lower.includes('bonk')) return ['kill'];
  if (lower.includes('ui') || lower.includes('click') || lower.includes('button')) return ['ui'];
  return []; // no tag
}

// Process new sounds
const addedSounds = [];

for (const s of newSounds) {
  if (!existingIDs.has(s.id) && !existingNames.has(s.name)) {
    const tags = autoTag(s.name);
    const newSound = { id: s.id, name: s.name, tags };
    existingSounds.push(newSound);
    existingIDs.add(s.id);
    existingNames.add(s.name);
    addedSounds.push(newSound);
    console.log(`Added: ${s.name} (id=${s.id}) tags=${JSON.stringify(tags)}`);
  } else {
    console.log(`Skipped (duplicate): ${s.name} (id=${s.id})`);
  }
}

// Save back to sounds.json
fs.writeFileSync(soundsPath, JSON.stringify(existingSounds, null, 2), 'utf8');

console.log(`\nFinished! Added ${addedSounds.length} new sound(s).`);
