const CACHE_NAME = "book-logger-cache-v1";
const FILES_TO_CACHE = [
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

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(FILES_TO_CACHE)),
  );
});

self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches
      .match(event.request)
      .then((response) => response || fetch(event.request)),
  );
});

