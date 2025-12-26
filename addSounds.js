const fs = require("fs");
const axios = require("axios");

const JSON_PATH = "./sounds.json";

// IDs you wanna add
const NEW_SOUND_IDS = [
  1234567890,
  9876543210
];

// keyword → tag rules
const TAG_RULES = {
  kill: ["kill", "death", "hit", "headshot", "slay"],
  ui: ["click", "hover", "menu", "notify", "button"],
  music: ["music", "song", "beat", "phonk", "remix"]
};

function autoTag(name) {
  const lower = name.toLowerCase();
  for (const tag in TAG_RULES) {
    if (TAG_RULES[tag].some(word => lower.includes(word))) {
      return [tag];
    }
  }
  return ["meme"];
}

async function fetchSoundName(id) {
  try {
    const res = await axios.get(
      `https://economy.roblox.com/v2/assets/${id}/details`
    );
    return res.data?.Name || null;
  } catch {
    return null;
  }
}

async function run() {
  const data = JSON.parse(fs.readFileSync(JSON_PATH, "utf8"));

  for (const id of NEW_SOUND_IDS) {
    if (data.sounds.some(s => s.id === id)) continue;

    const name = await fetchSoundName(id);
    if (!name) continue;

    data.sounds.push({
      name,
      id,
      tags: autoTag(name)
    });

    console.log(`Added: ${name}`);
  }

  fs.writeFileSync(JSON_PATH, JSON.stringify(data, null, 2));
}

run();
