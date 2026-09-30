// Service worker di Regia Tempi: rende dashboard, Stage Display e Countdown
// utilizzabili anche senza connessione, una volta aperti almeno una volta online.
// Aumentare CACHE_VERSION a ogni modifica dei file in PRECACHE.
var CACHE_VERSION = 'v1';
var APP_CACHE = 'regia-tempi-app-' + CACHE_VERSION;
var RUNTIME_CACHE = 'regia-tempi-runtime-' + CACHE_VERSION;
var PRECACHE = ['./', './index.html', './app.css', './manifest.webmanifest', './icon.svg'];
// Risorse esterne da tenere in cache: font e pdf.js.
var RUNTIME_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com', 'cdnjs.cloudflare.com'];
var NET_TIMEOUT_MS = 4000;

self.addEventListener('install', function(event){
  event.waitUntil(
    caches.open(APP_CACHE).then(function(cache){ return cache.addAll(PRECACHE); })
      .then(function(){ return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function(event){
  event.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(keys.map(function(key){
        if(key !== APP_CACHE && key !== RUNTIME_CACHE){ return caches.delete(key); }
      }));
    }).then(function(){ return self.clients.claim(); })
  );
});

function fetchWithTimeout(request, ms){
  return new Promise(function(resolve, reject){
    var timer = setTimeout(function(){ reject(new Error('timeout')); }, ms);
    fetch(request).then(function(res){ clearTimeout(timer); resolve(res); },
                        function(err){ clearTimeout(timer); reject(err); });
  });
}

// File dell'app: prima la rete (per ricevere subito gli aggiornamenti), poi la cache.
// Offline la pagina viene sempre servita dalla copia di index.html, anche per ?stage=1 e ?countdown=1.
function handleAppRequest(request, isNavigation){
  return fetchWithTimeout(request, NET_TIMEOUT_MS).then(function(res){
    if(res && res.ok){
      var copy = res.clone();
      caches.open(APP_CACHE).then(function(cache){
        cache.put(isNavigation ? './index.html' : request, copy);
      });
    }
    return res;
  }).catch(function(){
    var fallback = isNavigation ? caches.match('./index.html') : caches.match(request);
    return fallback.then(function(hit){ return hit || Response.error(); });
  });
}

// Font e pdf.js: versioni fisse, quindi la cache basta una volta scaricati.
function handleRuntime(request){
  return caches.open(RUNTIME_CACHE).then(function(cache){
    return cache.match(request).then(function(hit){
      if(hit){ return hit; }
      return fetch(request).then(function(res){
        if(res && (res.ok || res.type === 'opaque')){ cache.put(request, res.clone()); }
        return res;
      });
    });
  });
}

self.addEventListener('fetch', function(event){
  var request = event.request;
  if(request.method !== 'GET'){ return; }
  var url = new URL(request.url);
  if(url.origin === self.location.origin){
    event.respondWith(handleAppRequest(request, request.mode === 'navigate'));
  } else if(RUNTIME_HOSTS.indexOf(url.hostname) !== -1){
    event.respondWith(handleRuntime(request));
  }
});
