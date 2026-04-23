// === ARQUIVO: sw.js ===

// Versão do cache: Altere este nome (ex: fin-cache-v2) sempre que atualizar o CSS, JS ou HTML no GitHub
const CACHE_NAME = 'fin-cache-v1'; 

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
                    // Se o nome do cache salvo for diferente da versão atual, ele é deletado
                    if (cache !== CACHE_NAME) {
                        console.log(`[Service Worker] Apagando cache antigo: ${cache}`);
                        return caches.delete(cache);
                    }
                })
            );
        }).then(() => {
            return self.clients.claim(); // Garante que a página atual já use as novas regras
        })
    );
});

// 3. Interceptação (Fetch): É aqui que a mágica do modo Offline acontece
self.addEventListener('fetch', event => {
    // Ignora requisições de extensões ou chamadas externas que não sejam GET
    if (!(event.request.url.indexOf('http') === 0)) return;

    event.respondWith(
        caches.match(event.request).then(cachedResponse => {
            // Se o arquivo estiver no cache, retorna ele instantaneamente.
            // Se não estiver, vai buscar na internet (rede) normalmente.
            return cachedResponse || fetch(event.request);
        }).catch(() => {
            // Opcional: Se a internet cair e a página não estiver no cache, 
            // você poderia redirecionar para uma página "offline.html" personalizada aqui.
            console.log('[Service Worker] Você está offline e o recurso não está em cache.');
        })
    );
});
