// Regia Tempi - server locale per gli schermi in rete senza internet.
// Avvio: node regia-server.js (oppure doppio clic su avvia-server).
// Serve l'app agli schermi della sala e fa da "bacheca" condivisa con la
// stessa API REST in streaming del Firebase Realtime Database, così l'app usa
// lo stesso codice nei due casi. Nessuna dipendenza oltre a Node.js.
'use strict';
var http = require('http');
var fs = require('fs');
var path = require('path');
var os = require('os');

var PORT = Number(process.env.REGIA_PORT) || 8765;
var APP_DIR = path.resolve(__dirname, '..');
var KEEP_ALIVE_MS = 25000;
var MAX_BODY = 5 * 1024 * 1024;
var TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'application/javascript',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json',
  '.png': 'image/png'
};
var PUBLIC_FILES = ['index.html', 'app.css', 'manifest.webmanifest', 'icon.svg', 'vendor/qrcode.js'];

// rooms[codice] = { owner: chiave della regia, state: { campo: JSON } }
var rooms = {};
var listeners = {};

function lanAddresses(){
  var out = [];
  var ifaces = os.networkInterfaces();
  Object.keys(ifaces).forEach(function(name){
    (ifaces[name] || []).forEach(function(a){
      if((a.family === 'IPv4' || a.family === 4) && !a.internal) out.push(a.address);
    });
  });
  // Prima gli indirizzi tipici delle reti di casa e dei locali.
  function rank(ip){ return /^192\.168\./.test(ip) ? 0 : /^10\./.test(ip) ? 1 : /^172\./.test(ip) ? 2 : 3; }
  return out.sort(function(a, b){ return rank(a) - rank(b); });
}

function cors(res){
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  // La dashboard aperta dal sito (https) chiama questo server su localhost:
  // Chrome lo consente solo se il server lo dichiara esplicitamente.
  res.setHeader('Access-Control-Allow-Private-Network', 'true');
}
function sendJson(res, status, data){
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}
function emit(room, event, data){
  (listeners[room] || []).forEach(function(res){
    res.write('event: ' + event + '\ndata: ' + JSON.stringify(data) + '\n\n');
  });
}

function serveFile(req, res, rel){
  if(PUBLIC_FILES.indexOf(rel) === -1){ res.writeHead(404); return res.end(); }
  fs.readFile(path.join(APP_DIR, rel), function(err, data){
    if(err){ res.writeHead(404); return res.end(); }
    if(rel === 'index.html'){
      // Segnala alla pagina che arriva dal server locale e non dal sito.
      data = data.toString().replace('<head>', '<head>\n<script>window.REGIA_LOCAL_SERVER = true;</script>');
    }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(rel)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(data);
  });
}

function handleStream(req, res, room){
  res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' });
  res.write('event: put\ndata: ' + JSON.stringify({ path: '/', data: rooms[room] ? rooms[room].state : null }) + '\n\n');
  (listeners[room] = listeners[room] || []).push(res);
  var timer = setInterval(function(){ res.write('event: keep-alive\ndata: null\n\n'); }, KEEP_ALIVE_MS);
  req.on('close', function(){
    clearInterval(timer);
    listeners[room] = (listeners[room] || []).filter(function(r){ return r !== res; });
  });
}

function handleWrite(req, res, room, key){
  var body = '';
  var tooBig = false;
  req.on('data', function(chunk){
    body += chunk;
    if(body.length > MAX_BODY){ tooBig = true; req.destroy(); }
  });
  req.on('end', function(){
    if(tooBig) return;
    // Solo chi ha creato la stanza può modificarla (la chiave arriva in ?auth=).
    if(!key || (rooms[room] && rooms[room].owner !== key)) return sendJson(res, 401, { error: 'Permission denied' });
    if(req.method === 'DELETE'){
      delete rooms[room];
      emit(room, 'put', { path: '/', data: null });
      return sendJson(res, 200, null);
    }
    var patch;
    try{ patch = JSON.parse(body); }catch(e){ return sendJson(res, 400, { error: 'Invalid JSON' }); }
    if(!patch || typeof patch !== 'object') return sendJson(res, 400, { error: 'Invalid data' });
    var created = !rooms[room];
    if(created) rooms[room] = { owner: key, state: {} };
    var changed = {};
    Object.keys(patch).forEach(function(k){
      var m = /^state\/([A-Za-z0-9_]+)$/.exec(k);
      if(m && typeof patch[k] === 'string'){ rooms[room].state[m[1]] = patch[k]; changed[m[1]] = patch[k]; }
    });
    emit(room, 'patch', { path: '/', data: changed });
    // Stanza nuova (anche dopo un riavvio del server): la regia rimanda tutto lo stato.
    if(created) patch.__created = true;
    sendJson(res, 200, patch);
  });
}

var server = http.createServer(function(req, res){
  cors(res);
  if(req.method === 'OPTIONS'){ res.writeHead(204); return res.end(); }
  var url = new URL(req.url, 'http://localhost');
  var p = url.pathname;
  if(p === '/__regia') return sendJson(res, 200, { app: 'regia-tempi', port: PORT, addresses: lanAddresses() });
  var m = /^\/rooms\/([a-z0-9]{8,32})\/state\.json$/.exec(p);
  if(m && req.method === 'GET') return handleStream(req, res, m[1]);
  m = /^\/rooms\/([a-z0-9]{8,32})\.json$/.exec(p);
  if(m && (req.method === 'PATCH' || req.method === 'DELETE')) return handleWrite(req, res, m[1], url.searchParams.get('auth'));
  if(req.method === 'GET') return serveFile(req, res, p === '/' ? 'index.html' : p.replace(/^\/+/, ''));
  res.writeHead(405); res.end();
});

server.on('error', function(err){
  if(err.code === 'EADDRINUSE') console.error('\nLa porta ' + PORT + ' è già in uso: il server è forse già aperto in un\'altra finestra.\n');
  else console.error(err);
  process.exitCode = 1;
});
server.listen(PORT, function(){
  var ips = lanAddresses();
  console.log('\n  Regia Tempi - server locale attivo\n');
  console.log('  Nella dashboard apri "Schermi in rete" e premi "Attiva in rete locale".');
  if(ips.length){ console.log('  Indirizzo per gli altri schermi: http://' + ips[0] + ':' + PORT + '/'); }
  else { console.log('  Attenzione: questo PC non risulta collegato a nessuna rete.'); }
  console.log('\n  Lascia aperta questa finestra durante l\'evento. Per chiudere: Ctrl+C.\n');
});
