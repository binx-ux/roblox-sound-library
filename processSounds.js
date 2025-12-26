const fs = require('fs');
const newSounds = require('./new_ids');

// ======== Load existing sounds.json ========
const soundsPath = './sounds.json';
let sounds = [];
if (fs.existsSync(soundsPath)) {
  sounds = JSON.parse(fs.readFileSync(soundsPath));
}

// ======== Auto-tagging function ========
function autoTag(name) {
  const lower = name.toLowerCase();
  if (lower.includes('meme') || lower.includes('fart') || lower.includes('bonk')) return ['meme'];
  if (lower.includes('music') || lower.includes('song') || lower.includes('trance')) return ['music'];
  if (lower.includes('scream') || lower.includes('kill') || lower.includes('jumpscare')) return ['scary'];
  if (lower.includes('laugh') || lower.includes('haha')) return ['funny'];
  return ['other'];
}

// ======== Deduplicate & add new sounds ========
const existingIDs = new Set(sounds.map(s => s.id));
const existingNames = new Set(sounds.map(s => s.name));
const added = [];

for (const s of newSounds) {
  if (!existingIDs.has(s.id) && !existingNames.has(s.name)) {
    const tags = autoTag(s.name);
    sounds.push({ name: s.name, id: s.id, tags });
    added.push(s.name);
  }
}

// ======== Save sounds.json ========
fs.writeFileSync(soundsPath, JSON.stringify(sounds, null, 2));
console.log(`Added ${added.length} new sound(s):`, added);
