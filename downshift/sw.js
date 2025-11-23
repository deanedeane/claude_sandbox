const CACHE_NAME = 'downshift-v1';
const ASSETS_TO_CACHE = [
  '/downshift/',
  '/downshift/index.html',
  '/downshift/css/app.css',
  '/downshift/js/app.js',
  '/downshift/js/storage.js',
  '/downshift/js/llm.js',
  '/downshift/js/bodymap.js',
  '/downshift/js/checkin.js',
  '/downshift/js/player.js',
  '/downshift/js/stickman.js',
  '/downshift/js/feedback.js',
  '/downshift/js/navigation.js',
  '/downshift/manifest.json'
];

// Install event - cache assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache');
        return cache.addAll(ASSETS_TO_CACHE);
      })
      .catch((error) => {
        console.error('Cache installation failed:', error);
      })
  );
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  // Skip cross-origin requests and API calls
  if (!event.request.url.startsWith(self.location.origin)) {
    return;
  }

  // For API calls (LLM), always use network
  if (event.request.url.includes('api.openai.com') ||
      event.request.url.includes('api.anthropic.com') ||
      event.request.url.includes('generativelanguage.googleapis.com')) {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Cache hit - return response
        if (response) {
          return response;
        }

        // Clone the request
        const fetchRequest = event.request.clone();

        return fetch(fetchRequest).then((response) => {
          // Check if valid response
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }

          // Clone the response
          const responseToCache = response.clone();

          caches.open(CACHE_NAME)
            .then((cache) => {
              cache.put(event.request, responseToCache);
            });

          return response;
        }).catch((error) => {
          console.error('Fetch failed:', error);
          // Return offline page if available
          return caches.match('/downshift/index.html');
        });
      })
  );
});
