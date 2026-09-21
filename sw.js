// Service worker for offline/installable PWA support. Cache-first for the
// app shell listed below; anything else falls back to the network. Bump
// CACHE_NAME by hand when shipping a change, so old caches get cleaned up
// on the next visit instead of serving stale files forever.
var CACHE_NAME = "airbudget-v23";

var APP_SHELL = [
    "index.html",
    "manifest.json",
    "css/theme.css",
    "css/main.css",
    "css/settings.css",
    "css/onboarding.css",
    "css/categories.css",
    "css/goals.css",
    "css/main-view.css",
    "css/transaction.css",
    "css/detail.css",
    "css/report.css",
    "js/theme.js",
    "js/currencies-data.js",
    "js/state.js",
    "js/settings.js",
    "js/onboarding.js",
    "js/categories.js",
    "js/goals.js",
    "js/main-view.js",
    "js/report.js",
    "js/install-prompt.js",
    "js/transaction.js",
    "js/detail.js",
    "js/debug.js",
    "js/main.js",
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
