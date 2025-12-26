#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { execSync } = require('child_process');

const JSON_PATH = path.resolve(__dirname, 'sounds.json');
const NEW_IDS_PATH = path.resolve(__dirname, 'new_ids.json');

// GitHub config
const GITHUB_REPO = 'binx-ux/roblox-sound-library.git'; // repo URL without https://github.com/
const BRANCH = 'main';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN; // Store your token in environment variable

if (!GITHUB_TOKEN) {
  console.error('Error: Set your personal access token in the GITHUB_TOKEN environment variable');
  process.exit(1);
}

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

// Fetch sound name
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
        await sleep(wait);
      } else if (!status || (status >= 500 && status < 600)) {
        await sleep(baseDelay * Math.pow(2, attempt));
      } else {
        return null;
      }
    }
  }
  return null;
}

// Backup JSON
function backupFile(filePath) {
  try {
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = `${filePath}.bak.${ts}`;
    fs.copyFileSync(filePath, backupPath);
  } catch {}
}

// Load JSON
function loadJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

// Save JSON
function saveJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

// Git push using token
function gitPush(filePath) {
  const repoUrl = `https://${GITHUB_TOKEN}@github.com/${GITHUB_REPO}`;
  try {
    execSync('git config user.name "sound-bot"', { stdio: 'inherit' });
    execSync('git config user.email "sound-bot@github.com"', { stdio: 'inherit' });
    execSync(`git add ${filePath}`, { stdio: 'inherit' });
    execSync('git commit -m "Auto-update sounds.json"', { stdio: 'inherit' });
    execSync(`git push ${repoUrl} ${BRANCH}`, { stdio: 'inherit' });
    console.log('✅ sounds.json pushed successfully!');
  } catch (err) {
    console.error('Git push failed:', err.message);
  }
}

// Main
async function run() {
  if (!fs.existsSync(JSON_PATH) || !fs.existsSync(NEW_IDS_PATH)) {
    console.error('Missing sounds.json or new_ids.json');
    process.exit(1);
  }

  const soundsData = loadJson(JSON_PATH);
  const newIds = loadJson(NEW_IDS_PATH).ids || [];
  if (!Array.isArray(soundsData.sounds)) soundsData.sounds = [];

  const existingIds = new Set(soundsData.sounds.map(s => String(s.id)));
  const existingNames = new Set(soundsData.sounds.map(s => s.name.toLowerCase()));

  const toAdd = newIds
    .map(String)
    .map(s => s.trim())
    .filter(id => isValidId(id) && !existingIds.has(id));

  for (const id of toAdd) {
    const name = await fetchSoundName(id);
    if (!name || existingNames.has(name.toLowerCase())) continue;
    const tags = autoTag(name);
    soundsData.sounds.push({ name, id, tags });
    existingIds.add(String(id));
    existingNames.add(name.toLowerCase());
  }

  // Deduplicate again
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

  backupFile(JSON_PATH);
  saveJson(JSON_PATH, soundsData);

  // Push changes to GitHub
  gitPush(JSON_PATH);
}

run().catch(err => console.error('Fatal:', err));
