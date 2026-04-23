// === ARQUIVO: sw.js ===

// Versão do cache: Atualizada para v2 para aplicar as novas regras de bypass
const CACHE_NAME = 'fin-cache-v2'; 

// Lista de arquivos vitais que o navegador vai salvar no celular para funcionar offline
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './style.css',
    './script.js',
    './budget.js',
    './extract.js',
    './firebase-service.js',
    './changelog.js',
    './site.webmanifest',
    './imagens/android-chrome-192x192.png',
    './imagens/android-chrome-512x512.png',
    './imagens/favicon-32x32.png',
    './imagens/favicon-16x16.png',
    './imagens/favicon.ico'
];

// 1. Instalação: Baixa os arquivos e os coloca no cache do dispositivo
self.addEventListener('install', event => {
    self.skipWaiting(); // Força o novo Service Worker a assumir o controle imediatamente
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            console.log('[Service Worker] Salvando arquivos estáticos no cache local.');
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
});

// 2. Ativação: Limpa os caches antigos se a versão (CACHE_NAME) mudar
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cache => {
                    if (cache !== CACHE_NAME) {
                        console.log(`[Service Worker] Apagando cache antigo: ${cache}`);
                        return caches.delete(cache);
                    }
                })
            );
        }).then(() => {
            return self.clients.claim(); 
        })
    );
});

// 3. Interceptação (Fetch): Refatorado para evitar conflito com Firestore
self.addEventListener('fetch', event => {
    // Ignora requisições de extensões ou chamadas que não sejam HTTP/HTTPS
    if (!(event.request.url.indexOf('http') === 0)) return;

    // Regra de Exceção: Ignora conexões contínuas do Firebase (Firestore e Auth)
    // Isso evita o erro de conexão cortada pelo interceptador
    if (event.request.url.includes('firestore.googleapis.com') || 
        event.request.url.includes('identitytoolkit.googleapis.com')) {
        return; 
    }

    event.respondWith(
        caches.match(event.request).then(cachedResponse => {
            // Se o arquivo estiver no cache, retorna ele instantaneamente.
            // Se não estiver, vai buscar na internet (rede) normalmente.
            return cachedResponse || fetch(event.request);
        }).catch(() => {
            console.log('[Service Worker] Você está offline e o recurso não está em cache.');
        })
    );
});
