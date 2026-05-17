const CACHE_NAME = 'medscan-cache-v1';
// List all the files your app needs to load the basic screen
const urlsToCache = [
  './',
  './index.html',
  './style.css',   // Update this if your CSS file has a different name
  './script.js',   // Update this if your JS file has a different name
  './icon-192.png',
  './icon-512.png'
];

// 1. Install the Service Worker and save the files to memory
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        return cache.addAll(urlsToCache);
      })
  );
});

// 2. When the app asks for a file, check the saved memory first!
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Return the saved file if we have it, otherwise go to the internet
        return response || fetch(event.request);
      })
  );
});

