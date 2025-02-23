const CACHE_NAME = "book-logger-cache-v1";
const STATIC_CACHE = "book-logger-static-v1";
const DYNAMIC_CACHE = "book-logger-dynamic-v1";
const API_CACHE = "book-logger-api-v1";

const STATIC_FILES = [
  "/pwa-book-logger/",
  "/pwa-book-logger/assets/css/style.css",
  "/pwa-book-logger/assets/html/index.html",
  "/pwa-book-logger/assets/html/books.html",
  "/pwa-book-logger/assets/html/offline.html",
  "/pwa-book-logger/assets/icons/favicon.ico",
  "/pwa-book-logger/assets/icons/icon-128.png",
  "/pwa-book-logger/assets/icons/icon-512.png",
  "/pwa-book-logger/assets/js/firebase.js",
  "/pwa-book-logger/assets/js/signIn.js",
  "/pwa-book-logger/assets/js/books.js",
  "/pwa-book-logger/manifest.json",
];

const API_URLS = [
  "https://www.googleapis.com/books/v1/",
  "https://firestore.googleapis.com/v1/",
];

// Maximum number of items in dynamic cache
const MAX_DYNAMIC_CACHE_ITEMS = 50;

// Cache duration for API responses (24 hours)
const API_CACHE_DURATION = 24 * 60 * 60 * 1000;

// Install event handler
self.addEventListener("install", (event) => {
  event.waitUntil(
    Promise.all([
        // Cache static assets
        caches.open(STATIC_CACHE).then((cache) => {
          console.log("[Service Worker] Caching static files");
          return cache.addAll(STATIC_FILES);
        }),
        // Create other caches
        caches.open(DYNAMIC_CACHE),
        caches.open(API_CACHE),
      ])
      .then(() => {
        console.log("[Service Worker] All caches initialized");
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error("[Service Worker] Cache initialization failed:", error);
      })
  );
});

// Activate event handler
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            // Delete old cache versions
            if (
              ![STATIC_CACHE, DYNAMIC_CACHE, API_CACHE].includes(cacheName)
            ) {
              console.log("[Service Worker] Deleting old cache:", cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log("[Service Worker] Claiming clients");
        return self.clients.claim();
      })
  );
});

// Helper function to check if URL is an API URL
function isApiUrl(url) {
  return API_URLS.some(apiUrl => url.startsWith(apiUrl));
}

// Helper function to limit cache size
async function trimCache(cacheName, maxItems) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length > maxItems) {
    console.log(`[Service Worker] Trimming cache ${cacheName}`);
    await Promise.all(
      keys.slice(0, keys.length - maxItems).map(key => cache.delete(key))
    );
  }
}

// Network-first strategy for API requests
async function networkFirstStrategy(request) {
  try {
    const response = await fetch(request);
    const cache = await caches.open(API_CACHE);

    // Cache the response with timestamp
    const responseToCache = response.clone();
    const headers = new Headers(responseToCache.headers);
    headers.append('sw-cache-timestamp', Date.now());
    const augmentedResponse = new Response(
      await responseToCache.blob(),
      { headers }
    );
    cache.put(request, augmentedResponse);

    return response;
  } catch (error) {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      // Check cache timestamp
      const timestamp = cachedResponse.headers.get('sw-cache-timestamp');
      if (timestamp && Date.now() - parseInt(timestamp) < API_CACHE_DURATION) {
        return cachedResponse;
      }
    }
    throw error;
  }
}

// Cache-first strategy for static assets
async function cacheFirstStrategy(request) {
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }

  try {
    const response = await fetch(request);
    const cache = await caches.open(STATIC_CACHE);
    cache.put(request, response.clone());
    return response;
  } catch (error) {
    // Return offline page for HTML requests
    if (request.headers.get("accept").includes("text/html")) {
      return caches.match("/pwa-book-logger/assets/html/offline.html");
    }
    throw error;
  }
}

// Stale-while-revalidate strategy for dynamic content
async function staleWhileRevalidateStrategy(request) {
  const cachedResponse = await caches.match(request);

  const fetchPromise = fetch(request).then(async (response) => {
    const cache = await caches.open(DYNAMIC_CACHE);
    cache.put(request, response.clone());
    await trimCache(DYNAMIC_CACHE, MAX_DYNAMIC_CACHE_ITEMS);
    return response;
  });

  return cachedResponse || fetchPromise;
}

// Fetch event handler with improved caching strategies
self.addEventListener("fetch", (event) => {
  // Skip cross-origin requests
  if (!event.request.url.startsWith(self.location.origin) && !isApiUrl(event.request.url)) {
    return;
  }

  // Handle different request types
  if (isApiUrl(event.request.url)) {
    event.respondWith(networkFirstStrategy(event.request));
  } else if (STATIC_FILES.includes(event.request.url.replace(self.location.origin, ""))) {
    event.respondWith(cacheFirstStrategy(event.request));
  } else {
    event.respondWith(staleWhileRevalidateStrategy(event.request));
  }
});

// Background sync for offline functionality
self.addEventListener("sync", (event) => {
  if (event.tag === "sync-books") {
    event.waitUntil(syncBooks());
  }
});

// Store failed requests for later sync
const dbName = "book-logger-offline";
const storeName = "offline-requests";

async function saveFailedRequest(request) {
  const db = await openDB();
  const tx = db.transaction(storeName, "readwrite");
  const store = tx.objectStore(storeName);
  await store.add({
    url: request.url,
    method: request.method,
    headers: Array.from(request.headers.entries()),
    body: await request.clone().text(),
    timestamp: Date.now()
  });
}

// Process stored offline requests
async function syncBooks() {
  const db = await openDB();
  const tx = db.transaction(storeName, "readwrite");
  const store = tx.objectStore(storeName);
  const requests = await store.getAll();

  await Promise.all(requests.map(async (requestData) => {
    try {
      const response = await fetch(new Request(requestData.url, {
        method: requestData.method,
        headers: new Headers(requestData.headers),
        body: requestData.method !== "GET" ? requestData.body : null
      }));

      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      await store.delete(requestData.timestamp);
    } catch (error) {
      console.error("[Service Worker] Sync failed:", error);
    }
  }));
}

// IndexedDB helper
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName, 1);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(storeName)) {
        db.createObjectStore(storeName, { keyPath: "timestamp" });
      }
    };
  });
}

// Push notification support
self.addEventListener("push", (event) => {
  const options = {
    body: event.data.text(),
    icon: "/pwa-book-logger/assets/icons/icon-128.png",
    badge: "/pwa-book-logger/assets/icons/icon-128.png",
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    },
    actions: [
      {
        action: "explore",
        title: "View Books",
        icon: "/pwa-book-logger/assets/icons/icon-128.png"
      }
    ]
  };

  event.waitUntil(
    self.registration.showNotification("Book Logger", options)
  );
});

// Notification click handler
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  if (event.action === "explore") {
    event.waitUntil(
      clients.openWindow("/pwa-book-logger/assets/html/books.html")
    );
  }
});