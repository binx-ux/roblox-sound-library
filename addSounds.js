#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const axios = require('axios');

const JSON_PATH = path.resolve(__dirname, 'sounds.json');
const NEW_IDS_PATH = path.resolve(__dirname, 'new_ids.json');

// Tagging rules
const TAG_RULES = {
  kill: ['kill', 'death', 'hit', 'headshot', 'slay'],
  ui: ['click', 'hover', 'menu', 'notify', 'button'],
  music: ['music', 'song', 'beat', 'phonk', 'remix'],
};

// Helper to automatically assign tags
function autoTag(name) {
  const lower = name.toLowerCase();
  const tags = Object.keys(TAG_RULES).filter(tag =>
    TAG_RULES[tag].some(word => lower.includes(word))
  );
  return tags.length ? tags : ['meme'];
}

// Validate ID format
function isValidId(id) {
  if (typeof id === 'number' && Number.isFinite(id)) return true;
  if (typeof id === 'string' && /^\d+$/.test(id.trim())) return true;
  return false;
}

// Sleep utility for retries
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Fetch Roblox sound name with retries and rate-limit handling
async function fetchSoundName(id, { retries = 4, baseDelay = 500 } = {}) {
  const url = `https://economy.roblox.com/v2/assets/${id}/details`;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await axios.get(url, { timeout: 10000 });
      return res.data?.Name ?? res.data?.name ?? null;
    } catch (err) {
      const status = err?.response?.status;
      if (status === 429) { // rate-limited
        const wait = Number(err.response.headers['retry-after'] || baseDelay * Math.pow(2, attempt));
        console.warn(`Rate limit for id=${id}, waiting ${wait}ms`);
        await sleep(wait);
      } else if (!status || (status >= 500 && status < 600)) { // transient errors
        const wait = baseDelay * Math.pow(2, attempt);
        console.warn(`Transient error for id=${id}: ${err.message}, retry in ${wait}ms`);
        await sleep(wait);
      } else { // other errors, skip
        console.error(`Failed to fetch id=${id}: ${err.message} (status: ${status || 'network'})`);
        return null;
      }
    }
  }
  console.error(`Exceeded retries for id=${id}`);
  return null;
}

// Backup JSON file
function backupFile(filePath) {
  try {
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = `${filePath}.bak.${ts}`;
    fs.copyFileSync(filePath, backupPath);
    console.log(`Backup created: ${backupPath}`);
  } catch (err) {
    console.warn(`Backup failed for ${filePath}: ${err.message}`);
  }
}

// Load JSON safely
function loadJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (err) {
    throw new Error(`Cannot read/parse ${filePath}: ${err.message}`);
  }
}

// Save JSON safely
function saveJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
  console.log(`Wrote ${filePath}`);
}

// Main function
async function run() {
  const dryRun = process.argv.includes('--dry-run') || process.argv.includes('-n');

  if (!fs.existsSync(JSON_PATH)) throw new Error(`Missing ${JSON_PATH}`);
  if (!fs.existsSync(NEW_IDS_PATH)) throw new Error(`Missing ${NEW_IDS_PATH}`);

  const soundsData = loadJson(JSON_PATH);
  const newIds = loadJson(NEW_IDS_PATH).ids || [];

  if (!Array.isArray(soundsData.sounds)) soundsData.sounds = [];
  const existingIds = new Set(soundsData.sounds.map(s => String(s.id)));

  const toAdd = newIds
    .map(String)
    .map(s => s.trim())
    .filter(id => isValidId(id) && !existingIds.has(id));

  console.log(`Adding ${toAdd.length} new sound(s)`);

  for (const id of toAdd) {
    const name = await fetchSoundName(id);
    if (!name) continue;
    const tags = autoTag(name);
    soundsData.sounds.push({ name, id, tags });
    console.log(`Added: ${name} (id=${id})`);
  }

  // Deduplicate and sort
  const deduped = [];
  const seen = new Set();
  for (const s of soundsData.sounds) {
    const sid = String(s.id);
    if (seen.has(sid)) continue;
    seen.add(sid);
    deduped.push({ name: s.name, id: sid, tags: Array.isArray(s.tags) ? [...new Set(s.tags)] : autoTag(s.name) });
  }
  deduped.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
  soundsData.sounds = deduped;

  if (dryRun) {
    console.log('Dry run — sounds.json would look like:');
    console.log(JSON.stringify(soundsData, null, 2));
    return;
  }

  backupFile(JSON_PATH);
  saveJson(JSON_PATH, soundsData);
}

run().catch(err => {
  console.error(`Fatal: ${err.message}`);
  process.exit(1);
});
