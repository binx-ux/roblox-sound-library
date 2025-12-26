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

// Auto-assign tags based on name
function autoTag(name) {
  const lower = name.toLowerCase();
  const tags = Object.keys(TAG_RULES).filter(tag =>
    TAG_RULES[tag].some(word => lower.includes(word))
  );
  return tags.length ? tags : ['meme'];
}

// Validate ID
function isValidId(id) {
  if (typeof id === 'number' && Number.isFinite(id)) return true;
  if (typeof id === 'string' && /^\d+$/.test(id.trim())) return true;
  return false;
}

// Sleep utility
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Fetch sound name with retry & rate-limit handling
async function fetchSoundName(id, { retries = 4, baseDelay = 500 } = {}) {
  const url = `https://economy.roblox.com/v2/assets/${id}/details`;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await axios.get(url, { timeout: 10000 });
      return res.data?.Name ?? res.data?.name ?? null;
    } catch (err) {
      const status = err?.response?.status;
      if (status === 429) {
        const wait = Number(err.response.headers['retry-after'] || baseDelay * Math.pow(2, attempt));
        console.warn(`Rate limit for id=${id}, waiting ${wait}ms`);
        await sleep(wait);
      } else if (!status || (status >= 500 && status < 600)) {
        const wait = baseDelay * Math.pow(2, attempt);
        console.warn(`Transient error for id=${id}: ${err.message}, retry in ${wait}ms`);
        await sleep(wait);
      } else {
        console.error(`Failed to fetch id=${id}: ${err.message} (status: ${status || 'network'})`);
        return null;
      }
    }
  }
  console.error(`Exceeded retries for id=${id}`);
  return null;
}

// Backup JSON
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

// Load JSON
function loadJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (err) {
    throw new Error(`Cannot read/parse ${filePath}: ${err.message}`);
  }
}

// Save JSON
function saveJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
  console.log(`Wrote ${filePath}`);
}

// Main
async function run() {
  const dryRun = process.argv.includes('--dry-run') || process.argv.includes('-n');

  if (!fs.existsSync(JSON_PATH)) throw new Error(`Missing ${JSON_PATH}`);
  if (!fs.existsSync(NEW_IDS_PATH)) throw new Error(`Missing ${NEW_IDS_PATH}`);

  const soundsData = loadJson(JSON_PATH);
  const newIds = loadJson(NEW_IDS_PATH).ids || [];

  if (!Array.isArray(soundsData.sounds)) soundsData.sounds = [];

  // Keep track of existing IDs and names to avoid duplicates
  const existingIds = new Set(soundsData.sounds.map(s => String(s.id)));
  const existingNames = new Set(soundsData.sounds.map(s => s.name.toLowerCase()));

  const toAdd = newIds
    .map(String)
    .map(s => s.trim())
    .filter(id => isValidId(id) && !existingIds.has(id));

  console.log(`Adding ${toAdd.length} new sound(s)`);

  for (const id of toAdd) {
    const name = await fetchSoundName(id);
    if (!name) continue;
    if (existingNames.has(name.toLowerCase())) {
      console.log(`Skipping duplicate name: ${name} (id=${id})`);
      continue;
    }
    const tags = autoTag(name);
    soundsData.sounds.push({ name, id, tags });
    existingIds.add(String(id));
    existingNames.add(name.toLowerCase());
    console.log(`Added: ${name} (id=${id})`);
  }

  // Deduplicate again just in case
  const deduped = [];
  const seenIds = new Set();
  const seenNames = new Set();
  for (const s of soundsData.sounds) {
    const sid = String(s.id);
    const lname = s.name.toLowerCase();
    if (seenIds.has(sid) || seenNames.has(lname)) continue;
    seenIds.add(sid);
    seenNames.add(lname);
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
