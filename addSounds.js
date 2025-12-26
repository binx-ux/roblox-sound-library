#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { execSync } = require('child_process');

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
      return res.data?.Name ?? res.data?.name ?? null;
    } catch (err) {
      const status = err?.response?.status;
      if (status === 429) {
        const retryAfter = Number(err.response.headers['retry-after']) || null;
        const wait = retryAfter ? retryAfter * 1000 : baseDelay * Math.pow(2, attempt);
        console.warn(`429 for id=${id}, waiting ${wait}ms (${attempt + 1}/${retries})`);
        await sleep(wait);
        continue;
      }
      if (!status || (status >= 500 && status < 600)) {
        const wait = baseDelay * Math.pow(2, attempt);
        console.warn(`Transient error fetching id=${id} (attempt ${attempt + 1}/${retries}): ${err.message}`);
        await sleep(wait);
        continue;
      }
      console.error(`Failed to fetch id=${id}: ${err.message} (status: ${status || 'network'})`);
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
    console.warn(`Could not create backup: ${err.message}`);
  }
}

function loadJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (err) {
    throw new Error(`Unable to read/parse ${filePath}: ${err.message}`);
  }
}

function saveJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
  console.log(`Saved ${filePath}`);
}

function pushChanges() {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    console.warn('GITHUB_TOKEN not set. Skipping GitHub push.');
    return;
  }

  try {
    execSync('git config user.name "sound-bot"', { stdio: 'ignore' });
    execSync('git config user.email "sound-bot@users.noreply.github.com"', { stdio: 'ignore' });
    execSync('git add sounds.json', { stdio: 'inherit' });
    execSync('git commit -m "Auto-update sounds.json"', { stdio: 'ignore' });

    // Replace https://github.com/username/repo.git with your repo URL
    execSync(`git push https://${token}@github.com/binx-ux/roblox-sound-library.git HEAD:main`, { stdio: 'inherit' });
    console.log('Pushed changes to GitHub.');
  } catch (err) {
    console.error('Git push failed:', err.message);
  }
}

async function run() {
  const data = loadJson(JSON_PATH);
  const rawNewIds = loadJson(NEW_IDS_PATH).ids || [];

  if (!Array.isArray(data.sounds)) data.sounds = [];
  const existingIds = new Set(data.sounds.map(s => String(s.id)));
  const existingNames = new Set(data.sounds.map(s => s.name.toLowerCase()));

  const toAdd = [];
  for (const raw of rawNewIds) {
    if (!isValidId(raw)) continue;
    const id = String(raw).trim();
    if (existingIds.has(id)) continue;
    toAdd.push(id);
  }

  console.log(`Attempting to add ${toAdd.length} new sounds...`);

  for (const id of toAdd) {
    const name = await fetchSoundName(id);
    if (!name) continue;
    if (existingNames.has(name.toLowerCase())) continue;

    const tags = autoTag(name);
    data.sounds.push({ name, id, tags });
    console.log(`Added: ${name} (id=${id}) tags=${JSON.stringify(tags)}`);

    existingIds.add(id);
    existingNames.add(name.toLowerCase());
  }

  // Deduplicate by name and ID
  const deduped = [];
  const seenIds = new Set();
  const seenNames = new Set();
  for (const s of data.sounds) {
    const nameLower = s.name.toLowerCase();
    if (seenIds.has(s.id) || seenNames.has(nameLower)) continue;
    seenIds.add(s.id);
    seenNames.add(nameLower);
    deduped.push({ name: s.name, id: s.id, tags: Array.isArray(s.tags) ? [...new Set(s.tags)] : autoTag(s.name) });
  }

  deduped.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
  data.sounds = deduped;

  backupFile(JSON_PATH);
  saveJson(JSON_PATH, data);

  pushChanges();
}

run().catch(err => console.error('Fatal:', err));
