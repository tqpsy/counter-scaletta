// Segnala alla pagina che gira nell'app per PC (server locale già incluso).
'use strict';
require('electron').contextBridge.exposeInMainWorld('REGIA_DESKTOP', true);
