const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');
const { execSync } = require('child_process');

const SOUNDS_FILE = path.join(__dirname, 'sounds.json');

// Put your new IDs here
const newIds = [
  { name: "Anime Girl Laugh", id: 6389463761, tags: ["anime","laugh","meme"] },
  { name: "Bass-Boosted Fart Noise", id: 6445594239, tags: ["bass","meme","funny"] },
  { name: "Boat Horn", id: 229325720, tags: ["horn","loud"] },
  { name: "BONK", id: 8864069181, tags: ["bonk","meme"] },
  { name: "BYE BYE!", id: 7334141704, tags: ["bye","meme"] },
  { name: "COD “Mission Failed”", id: 7361248895, tags: ["cod","fail","game"] },
  { name: "Everybody in this Server…", id: 1461317727, tags: ["announcement","meme"] },
  { name: "EZ", id: 8922169253, tags: ["toxic","meme"] },
  { name: "FNAF Jumpscare", id: 8308107333, tags: ["fnaf","scary","jumpscare"] },
  { name: "Looks like I deleted you!", id: 8257514392, tags: ["toxic","meme"] },
  // add the rest...
];

// Helper: fetch Roblox sound name with retries
async function fetchSoundName(id, retries = 4, delay = 5000) {
  const url = `https://api.roblox.com/marketplace/productinfo?assetId=${id}`;
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetch(url);
      if (res.status === 429) {
        if (i === retries) throw new Error(`Rate-limited, exceeded retries for id=${id}`);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
      const data = await res.json();
      if (!data.Name) throw new Error(`No name returned for id=${id}`);
      return data.Name;
    } catch (e) {
      if (i === retries) throw e;
      await new Promise(r => setTimeout(r, delay));
    }
  }
}

// Main function
(async () => {
  const existing = JSON.parse(fs.readFileSync(SOUNDS_FILE, 'utf8'));
  const existingNames = new Set(existing.sounds.map(s => s.name));

  const toAdd = [];

  for (const s of newIds) {
    if (!existingNames.has(s.name)) {
      try {
        // Optional: verify name from API
        // const fetchedName = await fetchSoundName(s.id);
        // s.name = fetchedName;

        existing.sounds.push(s);
        existingNames.add(s.name);
        toAdd.push(s);
        console.log(`Added: ${s.name} (id=${s.id})`);
      } catch (e) {
        console.warn(`Skipping id ${s.id}: ${e.message}`);
      }
    } else {
      console.log(`Already present: ${s.id}`);
    }
  }

  if (toAdd.length === 0) {
    console.log('Nothing new to add.');
    return;
  }

  // Save updated JSON
  fs.writeFileSync(SOUNDS_FILE, JSON.stringify(existing, null, 2));

  // Git commit & push
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
})();
