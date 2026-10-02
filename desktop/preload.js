// Segnala alla pagina che gira nell'app per PC (server locale già incluso).
'use strict';
var electron = require('electron');
electron.contextBridge.exposeInMainWorld('REGIA_DESKTOP', true);

// Su Windows, dopo i confirm() e alert() nativi di Electron i campi di testo
// smettono di ricevere la tastiera. Le finestre di conferma le apre quindi il
// processo principale, che poi restituisce il focus alla pagina.
electron.contextBridge.exposeInMainWorld('regiaDialog', {
  confirm: function(message){ return electron.ipcRenderer.sendSync('regia-dialog', 'confirm', String(message == null ? '' : message)); },
  alert: function(message){ electron.ipcRenderer.sendSync('regia-dialog', 'alert', String(message == null ? '' : message)); }
});
electron.webFrame.executeJavaScript(
  'window.confirm = function(m){ return window.regiaDialog.confirm(m); };' +
  'window.alert = function(m){ window.regiaDialog.alert(m); };'
);
