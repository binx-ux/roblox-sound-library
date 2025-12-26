const fs = require("fs");
const path = require("path");

// Load new IDs
const newSounds = require("./new_ids.js");

// Path to your sounds.json
const soundsFile = path.join(__dirname, "sounds.json");

// Load existing sounds.json
let sounds = [];
try {
  const raw = fs.readFileSync(soundsFile, "utf-8");
  sounds = JSON.parse(raw);
  if (!Array.isArray(sounds)) sounds = [];
} catch {
  sounds = [];
}

// Create sets for deduplication
const existingIDs = new Set(sounds.map(s => s.id));
const existingNames = new Set(sounds.map(s => s.name.toLowerCase()));

// Auto-tagging function
function getTags(name) {
  const tags = [];
  const lname = name.toLowerCase();
  if (lname.includes("meme")) tags.push("meme");
  if (lname.includes("music") || lname.includes("song")) tags.push("music");
  if (lname.includes("kill") || lname.includes("bonk")) tags.push("kill");
  if (lname.includes("ui") || lname.includes("button")) tags.push("ui");
  return tags.length ? tags : ["meme"]; // default to meme if nothing matches
}

// Process new sounds
let added = 0;
for (const s of newSounds) {
  if (!s.id || !s.name) continue;

  const idStr = s.id.toString();
  if (existingIDs.has(idStr) || existingNames.has(s.name.toLowerCase())) {
    console.log(`Skipping existing: ${s.name} (${idStr})`);
    continue;
  }

  const soundObj = {
    id: idStr,
    name: s.name,
    tags: getTags(s.name),
  };

  sounds.push(soundObj);
  existingIDs.add(idStr);
  existingNames.add(s.name.toLowerCase());
  added++;
  console.log(`Added: ${s.name} (${idStr})`);
}

// Save updated sounds.json
fs.writeFileSync(soundsFile, JSON.stringify(sounds, null, 2));
console.log(`\nSaved ${added} new sound(s) to sounds.json`);
