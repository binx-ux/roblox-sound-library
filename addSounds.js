const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');
const { exec } = require('child_process');

// Paths
const soundsFile = path.join(__dirname, 'sounds.json');
const newIdsFile = path.join(__dirname, 'new_ids.json');

// GitHub token (set in environment variable)
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
if (!GITHUB_TOKEN) {
  console.error('Set your GITHUB_TOKEN environment variable!');
  process.exit(1);
}

// Load existing sounds
let sounds = [];
if (fs.existsSync(soundsFile)) {
  sounds = JSON.parse(fs.readFileSync(soundsFile));
}

// Load new IDs
if (!fs.existsSync(newIdsFile)) {
  console.error('new_ids.json not found!');
  process.exit(1);
}
const newIds = JSON.parse(fs.readFileSync(newIdsFile)).sounds;

// Deduplicate by ID and name
const existingIds = new Set(sounds.map(s => s.id));
const existingNames = new Set(sounds.map(s => s.name));

async function fetchSoundName(id, retries = 5, delay = 5000) {
  try {
    const res = await fetch(`https://api.roblox.com/marketplace/productinfo?assetId=${id}`);
    if (res.status === 429) {
      if (retries > 0) {
        console.log(`429 rate limit for id=${id}, retrying in ${delay}ms (${retries} left)`);
        await new Promise(r => setTimeout(r, delay));
        return fetchSoundName(id, retries - 1, delay);
      } else {
        console.warn(`Exceeded retries fetching id=${id}`);
        return null;
      }
    }
    const data = await res.json();
    if (data.Name) return data.Name;
    return null;
  } catch (err) {
    console.error(`Error fetching id=${id}:`, err.message);
    return null;
  }
}

async function addSounds() {
  const toAdd = newIds.filter(s => !existingIds.has(s.id) && !existingNames.has(s.name));
  console.log(`Will attempt to add ${toAdd.length} new sound(s).`);

  for (const sound of toAdd) {
    let name = sound.name;
    // If name is empty, fetch from Roblox
    if (!name) {
      name = await fetchSoundName(sound.id);
      if (!name) {
        console.warn(`Skipping id=${sound.id} (could not obtain name)`);
        continue;
      }
    }

    sounds.push({
      id: sound.id,
      name,
      tags: sound.tags || []
    });

    existingIds.add(sound.id);
    existingNames.add(name);
    console.log(`Added: ${name} (id=${sound.id}) tags=${JSON.stringify(sound.tags || [])}`);
  }

  // Write updated sounds.json
  fs.writeFileSync(soundsFile, JSON.stringify(sounds, null, 2));
  console.log('sounds.json updated!');

  // Auto-push to GitHub
  exec(`git add sounds.json && git commit -m "Auto-update sounds.json" && git push https://${GITHUB_TOKEN}@github.com/binx-ux/roblox-sound-library.git`, (err, stdout, stderr) => {
    if (err) {
      console.error('Git push failed:', err.message);
      return;
    }
    console.log('Git push successful!');
    console.log(stdout);
    if (stderr) console.error(stderr);
  });
}

// Run
addSounds();
