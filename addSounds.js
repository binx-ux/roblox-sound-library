#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const axios = require('axios');

const JSON_PATH = path.resolve(__dirname, './sounds.json');
const NEW_IDS_PATH = path.resolve(__dirname, './new_ids.json');

const TAG_RULES = {
  kill: ['kill', 'death', 'hit', 'headshot', 'slay'],
  ui: ['click', 'hover', 'menu', 'notify', 'button'],
  music: ['music', 'song', 'beat', 'phonk', 'remix']
};

function autoTag(name) {
  const lower = name.toLowerCase();
  const tags = [];
  for (const tag in TAG_RULES) {
    if (TAG_RULES[tag].some(word => lower.includes(word))) {
      tags.push(tag);
    }
  }
  return tags.length ? tags : ['meme'];
}

function isValidId(id) {
  // allow numeric-looking strings or numbers
  if (typeof id === 'number' && Number.isFinite(id)) return true;
  if (typeof id === 'string' && /^\d+$/.test(id.trim())) return true;
  return false;
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchSoundName(id, { retries = 4, baseDelay = 500 } = {}) {
  const url = `https://economy.roblox.com/v2/assets/${id}/details`;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await axios.get(url, { timeout: 10_000 });
      // API can use Name or name depending on response shape; handle both
      return res.data?.Name ?? res.data?.name ?? null;
    } catch (err) {
      const status = err?.response?.status;
      // If rate-limited, use Retry-After if present, else exponential backoff
      if (status === 429) {
        const retryAfter = Number(err.response.headers['retry-after']) || null;
        const wait = retryAfter ? retryAfter * 1000 : baseDelay * Math.pow(2, attempt);
        console.warn(`429 received for id=${id}, waiting ${wait}ms before retry (${attempt + 1}/${retries})`);
        await sleep(wait);
        continue;
      }
      // For other 5xx or network errors, backoff and retry
      if (!status || (status >= 500 && status < 600)) {
        const wait = baseDelay * Math.pow(2, attempt);
        console.warn(`Transient error fetching id=${id} (attempt ${attempt + 1}/${retries}): ${err.message}. Retrying in ${wait}ms`);
        await sleep(wait);
        continue;
      }
      // For 4xx other than 429, don't retry
      console.error(`Failed to fetch details for id=${id}: ${err.message} (status: ${status || 'network'})`);
      return null;
    }
  }
  console.error(`Exceeded retries fetching id=${id}`);
  return null;
}

function backupFile(filePath) {
  try {
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = `${filePath}.bak.${ts}`;
    fs.copyFileSync(filePath, backupPath);
    console.log(`Backup created: ${backupPath}`);
  } catch (err) {
    console.warn(`Could not create backup of ${filePath}: ${err.message}`);
  }
}

function loadJson(filePath) {
  try {
    const text = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(text);
  } catch (err) {
    throw new Error(`Unable to read/parse ${filePath}: ${err.message}`);
  }
}

function saveJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
  console.log(`Wrote ${filePath}`);
}

async function run() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run') || args.includes('-n');

  // Ensure required files exist
  if (!fs.existsSync(JSON_PATH)) {
    console.error(`sounds.json not found at ${JSON_PATH}`);
    process.exit(2);
  }
  if (!fs.existsSync(NEW_IDS_PATH)) {
    console.error(`new_ids.json not found at ${NEW_IDS_PATH}`);
    process.exit(2);
  }

  const data = loadJson(JSON_PATH);
  const rawNewIds = (() => {
    try {
      return loadJson(NEW_IDS_PATH).ids || [];
    } catch (e) {
      console.error(e.message);
      return [];
    }
  })();

  if (!Array.isArray(data.sounds)) data.sounds = [];

  const existingIds = new Set(data.sounds.map(s => String(s.id)));
  const toAdd = [];

  for (const raw of rawNewIds) {
    if (!isValidId(raw)) {
      console.warn(`Skipping invalid id: ${JSON.stringify(raw)}`);
      continue;
    }
    const id = String(raw).trim();
    if (existingIds.has(id)) {
      console.log(`Already present: ${id}`);
      continue;
    }
    toAdd.push(id);
  }

  console.log(`Will attempt to add ${toAdd.length} new sound(s).`);

  for (const id of toAdd) {
    const name = await fetchSoundName(id);
    if (!name) {
      console.warn(`Skipping id ${id} (could not obtain name)`);
      continue;
    }

    const tags = autoTag(name);
    data.sounds.push({ name, id, tags });
    console.log(`Added: ${name} (id=${id}) tags=${JSON.stringify(tags)}`);
  }

  // Deduplicate by id and sort by name
  const deduped = [];
  const seen = new Set();
  for (const s of data.sounds) {
    const sid = String(s.id);
    if (seen.has(sid)) continue;
    seen.add(sid);
    // normalize object shape
    deduped.push({
      name: s.name,
      id: sid,
      tags: Array.isArray(s.tags) ? [...new Set(s.tags)] : autoTag(s.name)
    });
  }
  deduped.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
  data.sounds = deduped;

  if (dryRun) {
    console.log('Dry run enabled — no file will be written. Resulting sounds.json would have:');
    console.log(JSON.stringify(data, null, 2));
    return;
  }

  backupFile(JSON_PATH);
  try {
    saveJson(JSON_PATH, data);
  } catch (err) {
    console.error(`Failed to write ${JSON_PATH}: ${err.message}`);
    process.exit(3);
  }
}

run().catch(err => {
  console.error(`Fatal: ${err.message}`);
  process.exit(1);
});
