// Service worker for offline/installable PWA support. Cache-first for the
// app shell listed below; anything else falls back to the network. Bump
// CACHE_NAME by hand when shipping a change, so old caches get cleaned up
// on the next visit instead of serving stale files forever.
var CACHE_NAME = "airbudget-v2";

var APP_SHELL = [
    "index.html",
    "manifest.json",
    "theme.css",
    "main.css",
    "settings.css",
    "onboarding.css",
    "categories.css",
    "main-view.css",
    "transaction.css",
    "detail.css",
    "theme.js",
    "currencies-data.js",
    "state.js",
    "settings.js",
    "onboarding.js",
    "categories.js",
    "main-view.js",
    "transaction.js",
    "detail.js",
    "main.js",
    "fontawesome/css/fontawesome.min.css",
    "fontawesome/css/solid.min.css",
    "fontawesome/webfonts/fa-solid-900.woff2",
    "fonts/UbuntuMono-Regular.ttf",
    "fonts/WorkSans-Regular.woff2",
    "images/favicon.png",
    "images/icon-192.png",
    "images/icon-512.png"
];

self.addEventListener("install", function (event) {
    event.waitUntil(
        caches.open(CACHE_NAME).then(function (cache) {
            return cache.addAll(APP_SHELL);
        })
    );
    self.skipWaiting();
});

self.addEventListener("activate", function (event) {
    event.waitUntil(
        caches.keys().then(function (keys) {
            return Promise.all(
                keys.filter(function (key) {
                    return key !== CACHE_NAME;
                }).map(function (key) {
                    return caches.delete(key);
                })
            );
        })
    );
    self.clients.claim();
});

self.addEventListener("fetch", function (event) {
    if (event.request.method !== "GET") {
        return;
    }

    event.respondWith(
        caches.match(event.request).then(function (cached) {
            return cached || fetch(event.request);
        })
    );
});
