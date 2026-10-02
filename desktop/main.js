// Regia Tempi per PC (Electron).
// All'avvio parte il server locale della cartella server/ (lo stesso di
// avvia-server, ma senza installare Node.js) e la dashboard si apre da lì:
// così "Attiva in rete locale" funziona subito, e "Attiva via internet"
// (Firebase) funziona come nel sito. Stage e Countdown si aprono in finestre
// dell'app, a schermo intero sul secondo schermo.
'use strict';
var electron = require('electron');
var app = electron.app;
var BrowserWindow = electron.BrowserWindow;
var dialog = electron.dialog;
var ipcMain = electron.ipcMain;
var session = electron.session;
var shell = electron.shell;
var path = require('path');
var fork = require('child_process').fork;
var updater = require('./updater');

var PORT = 8765;
var BASE = 'http://localhost:' + PORT + '/';
// Nell'installer i file dell'app stanno in resources/web; durante lo sviluppo
// si usano quelli della cartella principale del progetto.
var WEB_DIR = app.isPackaged ? path.join(process.resourcesPath, 'web') : path.resolve(__dirname, '..');
var ICON = path.join(__dirname, 'build', 'icon.png');
var PRELOAD = path.join(__dirname, 'preload.js');

var serverProcess = null;
var mainWindow = null;

// Risponde se sulla porta c'è già il server di Regia Tempi (per esempio
// avviato a mano con avvia-server): in quel caso si usa quello.
function probeServer(){
  return fetch(BASE + '__regia').then(function(res){ return res.json(); })
    .then(function(info){ return !!(info && info.app === 'regia-tempi'); })
    .catch(function(){ return false; });
}
function waitForServer(tries){
  return probeServer().then(function(ok){
    if(ok || tries <= 0) return ok;
    return new Promise(function(r){ setTimeout(r, 200); }).then(function(){ return waitForServer(tries - 1); });
  });
}
function startServer(){
  return probeServer().then(function(running){
    if(running) return true;
    // L'eseguibile di Electron fa anche da Node.js con ELECTRON_RUN_AS_NODE.
    serverProcess = fork(path.join(WEB_DIR, 'server', 'regia-server.js'), [], {
      env: Object.assign({}, process.env, { ELECTRON_RUN_AS_NODE: '1', REGIA_PORT: String(PORT) }),
      stdio: 'ignore'
    });
    serverProcess.on('exit', function(){ serverProcess = null; });
    return waitForServer(40);
  });
}
function stopServer(){
  if(serverProcess){ try{ serverProcess.kill(); }catch(e){} serverProcess = null; }
}

function isAppUrl(url){ return url === 'about:blank' || url.indexOf(BASE) === 0 || url.indexOf('file://') === 0; }

var windowOptions = {
  autoHideMenuBar: true,
  icon: ICON,
  webPreferences: { preload: PRELOAD, contextIsolation: true, sandbox: true }
};

function createMainWindow(url){
  mainWindow = new BrowserWindow(Object.assign({
    width: 1440, height: 900, minWidth: 360, minHeight: 500,
    title: 'Regia Tempi', backgroundColor: '#ffffff', show: false
  }, windowOptions));
  mainWindow.once('ready-to-show', function(){ mainWindow.maximize(); mainWindow.show(); mainWindow.focus(); });
  // Chiusa la dashboard si chiudono anche Stage e Countdown.
  mainWindow.on('closed', function(){ mainWindow = null; app.quit(); });
  mainWindow.loadURL(url);
}

function setupPermissions(){
  // Gestione finestre (per trovare il secondo schermo), schermo intero,
  // blocco dello standby e appunti: solo per le pagine dell'app.
  var allowed = ['window-management', 'fullscreen', 'wake-lock', 'clipboard-sanitized-write', 'clipboard-read', 'notifications'];
  session.defaultSession.setPermissionRequestHandler(function(wc, permission, callback){
    callback(isAppUrl(wc.getURL()) && allowed.indexOf(permission) !== -1);
  });
  session.defaultSession.setPermissionCheckHandler(function(wc, permission, origin){
    return isAppUrl((origin || '') + '/') && allowed.indexOf(permission) !== -1;
  });
}

// confirm() e alert() della pagina (vedi preload.js): finestra di Windows,
// poi il focus torna alla pagina così si può continuare a scrivere.
ipcMain.on('regia-dialog', function(e, kind, message){
  var win = BrowserWindow.fromWebContents(e.sender);
  var isConfirm = kind === 'confirm';
  var opts = {
    type: isConfirm ? 'question' : 'info', title: 'Regia Tempi', message: message, noLink: true,
    buttons: isConfirm ? ['OK', 'Annulla'] : ['OK'], defaultId: 0, cancelId: isConfirm ? 1 : 0
  };
  var choice = win ? dialog.showMessageBoxSync(win, opts) : dialog.showMessageBoxSync(opts);
  e.returnValue = isConfirm ? choice === 0 : true;
  setTimeout(function(){
    if(!win || win.isDestroyed()) return;
    win.blur();
    win.focus();
    e.sender.focus();
  }, 0);
});

// Versione e aggiornamenti, per la sezione nelle impostazioni (preload.js).
ipcMain.on('regia-app-version', function(e){ e.returnValue = app.getVersion(); });
ipcMain.handle('regia-update-check', function(){ return updater.checkNow(); });

// Finestre aperte dalla pagina: Stage e Countdown restano nell'app, i link
// esterni (es. GitHub, Firebase) si aprono nel browser.
app.on('web-contents-created', function(e, wc){
  wc.setWindowOpenHandler(function(details){
    if(isAppUrl(details.url)){
      return { action: 'allow', overrideBrowserWindowOptions: Object.assign({ backgroundColor: '#000000' }, windowOptions) };
    }
    if(/^https?:/.test(details.url)) shell.openExternal(details.url);
    return { action: 'deny' };
  });
  wc.on('will-navigate', function(ev, url){
    if(isAppUrl(url)) return;
    ev.preventDefault();
    if(/^https?:/.test(url)) shell.openExternal(url);
  });
  // Stage aperto sul secondo schermo (fs=1): schermo intero subito, senza
  // chiedere il clic che serve nel browser.
  wc.on('did-finish-load', function(){
    if(/[?&]fs=1(&|$)/.test(wc.getURL())){
      wc.executeJavaScript('document.fullscreenElement || document.documentElement.requestFullscreen().catch(function(){})', true).catch(function(){});
    }
  });
});

if(!app.requestSingleInstanceLock()){
  app.quit();
} else {
  app.on('second-instance', function(){
    if(mainWindow){ if(mainWindow.isMinimized()) mainWindow.restore(); mainWindow.focus(); }
  });
  app.whenReady().then(function(){
    setupPermissions();
    return startServer();
  }).then(function(ok){
    updater.setup(function(){ return mainWindow; });
    if(ok) return createMainWindow(BASE);
    // Senza server la dashboard funziona lo stesso (anche via internet),
    // manca solo la rete locale.
    dialog.showErrorBox('Regia Tempi',
      'Non riesco ad avviare il server per gli schermi in rete locale (porta ' + PORT + ' occupata da un altro programma?).\n\n' +
      'La dashboard funziona lo stesso; per gli schermi in rete usa "Attiva via internet".');
    createMainWindow('file://' + path.join(WEB_DIR, 'index.html'));
  });
  app.on('window-all-closed', function(){ app.quit(); });
  app.on('will-quit', stopServer);
}
