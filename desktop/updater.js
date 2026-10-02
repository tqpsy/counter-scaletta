// Aggiornamenti del programma. Le versioni nuove le pubblica il workflow
// "App per PC" nelle Release di GitHub, insieme a latest.yml che le descrive.
// Programma installato: la nuova versione si scarica in background e si
// installa al riavvio. Versione portatile: si avvisa e si apre la pagina
// per scaricarla, perché non può aggiornarsi da sola.
'use strict';
var electron = require('electron');
var app = electron.app;
var dialog = electron.dialog;
var shell = electron.shell;

var FEED_URL = 'https://github.com/tqpsy/counter-scaletta/releases/latest/download';
var RELEASES_URL = 'https://github.com/tqpsy/counter-scaletta/releases/latest';
var CHECK_EVERY_MS = 6 * 60 * 60 * 1000;

var isPortable = !!process.env.PORTABLE_EXECUTABLE_DIR;
var autoUpdater = null;
var getWindow = function(){ return null; };
// off | checking | latest | downloading | ready | available (portatile) | error
var status = { state: 'off', version: null };
var askedFor = null;

function newer(a, b){
  var pa = String(a).split('.').map(Number), pb = String(b).split('.').map(Number);
  for(var i = 0; i < 3; i++){
    if((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) > (pb[i] || 0);
  }
  return false;
}

function showDialog(opts){
  var win = getWindow();
  return win ? dialog.showMessageBox(win, opts) : dialog.showMessageBox(opts);
}

function askRestart(version){
  if(askedFor === version) return;
  askedFor = version;
  showDialog({
    type: 'info', title: 'Regia Tempi', noLink: true,
    message: 'È pronta la versione ' + version + ' di Regia Tempi.',
    detail: 'Riavvia ora per aggiornare, oppure continua: si aggiornerà da sola alla prossima chiusura.',
    buttons: ['Riavvia ora', 'Più tardi'], defaultId: 1, cancelId: 1
  }).then(function(r){
    if(r.response === 0) autoUpdater.quitAndInstall();
  });
}

function askDownload(version){
  if(askedFor === version) return;
  askedFor = version;
  showDialog({
    type: 'info', title: 'Regia Tempi', noLink: true,
    message: 'È disponibile la versione ' + version + ' di Regia Tempi.',
    detail: 'La versione portatile non si aggiorna da sola: scarica il file nuovo e usalo al posto di questo.',
    buttons: ['Scarica', 'Più tardi'], defaultId: 0, cancelId: 1
  }).then(function(r){
    if(r.response === 0) shell.openExternal(RELEASES_URL);
  });
}

// Portatile: basta leggere la versione in latest.yml.
function checkPortable(){
  status = { state: 'checking', version: null };
  return fetch(FEED_URL + '/latest.yml', { cache: 'no-store' }).then(function(res){
    if(!res.ok) throw new Error('HTTP ' + res.status);
    return res.text();
  }).then(function(text){
    var m = /^version:\s*['"]?([0-9.]+)/m.exec(text);
    if(m && newer(m[1], app.getVersion())){
      status = { state: 'available', version: m[1] };
      askDownload(m[1]);
    } else {
      status = { state: 'latest', version: null };
    }
    return status;
  }).catch(function(){
    status = { state: 'error', version: null };
    return status;
  });
}

function check(){
  if(!app.isPackaged) return Promise.resolve({ state: 'off', version: null });
  if(isPortable) return checkPortable();
  if(status.state === 'downloading' || status.state === 'ready') return Promise.resolve(status);
  status = { state: 'checking', version: null };
  return autoUpdater.checkForUpdates().then(function(r){
    if(status.state === 'checking'){
      var v = r && r.updateInfo && r.updateInfo.version;
      status = v && newer(v, app.getVersion()) ? { state: 'downloading', version: v } : { state: 'latest', version: null };
    }
    return status;
  }).catch(function(){
    status = { state: 'error', version: null };
    return status;
  });
}

function setup(windowGetter){
  getWindow = windowGetter;
  if(!app.isPackaged) return;
  if(!isPortable){
    autoUpdater = require('electron-updater').autoUpdater;
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;
    autoUpdater.on('update-available', function(info){ status = { state: 'downloading', version: info.version }; });
    autoUpdater.on('update-not-available', function(){ status = { state: 'latest', version: null }; });
    autoUpdater.on('update-downloaded', function(info){
      status = { state: 'ready', version: info.version };
      askRestart(info.version);
    });
    autoUpdater.on('error', function(){
      if(status.state !== 'ready') status = { state: 'error', version: null };
    });
  }
  // Primo controllo poco dopo l'avvio, poi ogni tanto se resta aperto a lungo.
  setTimeout(check, 5000);
  setInterval(check, CHECK_EVERY_MS);
}

// Pulsante "Cerca aggiornamenti" nelle impostazioni: se c'è già una versione
// pronta si propone di nuovo il riavvio.
function checkNow(){
  if(status.state === 'ready'){ askedFor = null; askRestart(status.version); return Promise.resolve(status); }
  if(status.state === 'available'){ askedFor = null; askDownload(status.version); return Promise.resolve(status); }
  return check();
}

module.exports = { setup: setup, checkNow: checkNow, isPortable: isPortable };
