const fs = require('fs');
const path = require('path');

// Paths
const newIdsPath = path.join(__dirname, 'new_ids.js'); // Your new IDs file
const soundsPath = path.join(__dirname, 'sounds.json'); // Your main sounds.json

// Load new IDs
let newIds;
try {
    newIds = require(newIdsPath); // expects an array like [{id: 123, name: "Sound Name"}]
} catch (err) {
    console.error('Failed to load new_ids.js:', err);
    process.exit(1);
}

// Load existing sounds
let soundsData;
try {
    soundsData = JSON.parse(fs.readFileSync(soundsPath, 'utf8'));
    if (!Array.isArray(soundsData.sounds)) soundsData.sounds = [];
} catch (err) {
    console.error('Failed to load sounds.json:', err);
    process.exit(1);
}

const existingIDs = new Set(soundsData.sounds.map(s => s.id));
const existingNames = new Set(soundsData.sounds.map(s => s.name));

// Define allowed tags
const allowedTags = ['meme', 'music', 'kill', 'ui'];

// Auto-tag function
function autoTag(name) {
    name = name.toLowerCase();
    return allowedTags.filter(tag => name.includes(tag));
}

// Process each new sound
let addedCount = 0;
for (const sound of newIds) {
    if (!sound.id || !sound.name) continue;

    if (existingIDs.has(sound.id) || existingNames.has(sound.name)) {
        console.log(`Already present: ${sound.name} (id=${sound.id})`);
        continue;
    }

    const tags = autoTag(sound.name);
    const newSound = {
        id: sound.id,
        name: sound.name,
        tags: tags
    };

    soundsData.sounds.push(newSound);
    existingIDs.add(sound.id);
    existingNames.add(sound.name);
    addedCount++;
    console.log(`Added: ${sound.name} (id=${sound.id}) tags=${JSON.stringify(tags)}`);
}

// Save updated sounds.json
fs.writeFileSync(soundsPath, JSON.stringify(soundsData, null, 2));
console.log(`Saved ${addedCount} new sound(s) to sounds.json`);
