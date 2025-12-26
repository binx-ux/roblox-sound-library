const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');
const { execSync } = require('child_process');

const SOUNDS_FILE = path.join(__dirname, 'sounds.json');

// New IDs to add
const newIds = [
  { name: "Anime Girl Laugh", id: 6389463761, tags: ["anime","laugh","meme"] },
  { name: "Bass-Boosted Fart Noise", id: 6445594239, tags: ["bass","meme","funny"] },
  { name: "Boat Horn", id: 229325720, tags: ["horn","loud"] },
  { name: "BONK", id: 8864069181, tags: ["bonk","meme"] },
  // ...add the rest here
];

// Helper: fetch Roblox sound info with retries + backoff
async function fetchSoundName(id, retries = 5, delay = 1000) {
  const url = `https://api.roblox.com/marketplace/productinfo?assetId=${id}`;
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetch(url);
      if (res.status === 429) {
        const waitTime = delay * Math.pow(2, i); // exponential backoff
        console.warn(`429 for id=${id}, waiting ${waitTime}ms (retry ${i + 1})`);
        await new Promise(r => setTimeout(r, waitTime));
        continue;
      }
      const data = await res.json();
      if (!data.Name) throw new Error(`No name returned for id=${id}`);
      return data.Name;
    } catch (e) {
      if (i === retries) throw e;
      const waitTime = delay * Math.pow(2, i);
      console.warn(`Error fetching id=${id}: ${e.message}, retrying in ${waitTime}ms`);
      await new Promise(r => setTimeout(r, waitTime));
    }
  }
}

// Delay helper for batching
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Process sounds sequentially with delay to avoid rate limits
async function processSounds() {
  const existing = JSON.parse(fs.readFileSync(SOUNDS_FILE, 'utf8'));
  const existingNames = new Set(existing.sounds.map(s => s.name));

  const added = [];

  for (const s of newIds) {
    if (existingNames.has(s.name)) {
      console.log(`Already present: ${s.name} (id=${s.id})`);
      continue;
    }

    try {
      // Optional: fetch verified name from Roblox API
      // const fetchedName = await fetchSoundName(s.id);
      // s.name = fetchedName;

      existing.sounds.push(s);
      existingNames.add(s.name);
      added.push(s);
      console.log(`Added: ${s.name} (id=${s.id})`);
    } catch (e) {
      console.warn(`Skipping id ${s.id}: ${e.message}`);
    }

    // Throttle requests: 1 request per 1 second
    await delay(1000);
  }

  if (added.length === 0) {
    console.log('No new sounds to add.');
    return;
  }

  fs.writeFileSync(SOUNDS_FILE, JSON.stringify(existing, null, 2));
  console.log(`Saved ${added.length} new sound(s) to sounds.json`);

  // Git push
  try {
    execSync('git config user.name "sound-bot"');
    execSync('git config user.email "sound-bot@example.com"');
    execSync('git add sounds.json');
    execSync('git commit -m "Auto-update sounds.json"');
    execSync('git push https://x-access-token:' + process.env.GITHUB_TOKEN + '@github.com/binx-ux/roblox-sound-library.git main');
    console.log('Pushed changes to GitHub!');
  } catch (e) {
    console.error('Git push failed:', e.message);
  }
}

// Run
processSounds().catch(e => console.error('Fatal error:', e.message));
