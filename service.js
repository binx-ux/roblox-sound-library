const Service = require('node-windows').Service;
const path = require('path');

// Path to your addSounds.js
const scriptPath = path.join(__dirname, 'addSounds.js');

const svc = new Service({
  name: 'RobloxSoundUpdater',
  description: 'Automatically updates Roblox sounds.json in the background.',
  script: scriptPath,
  nodeOptions: [
    '--harmony',
    '--max_old_space_size=4096'
  ],
});

svc.on('install', () => {
  svc.start();
  console.log('Service installed and started!');
});

svc.on('alreadyinstalled', () => console.log('Service already installed.'));
svc.on('start', () => console.log('Service started.'));
svc.on('error', (err) => console.error(err));

svc.install();
