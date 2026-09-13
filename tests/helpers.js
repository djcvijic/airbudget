// Shared helpers for driving the real app inside the iframe. Every test
// file interacts with the app exactly like a user would: real DOM events
// on real elements, never a mocked or reimplemented DOM.

var APP_STORAGE_KEY = "airbudget-state-v1";

function seedState(partial) {
    var full = {
        period: partial.period || null,
        currency: partial.currency || null,
        categories: partial.categories || [],
        transactions: partial.transactions || [],
        detailMode: partial.detailMode || "day"
    };
    localStorage.setItem(APP_STORAGE_KEY, JSON.stringify(full));
}

// index.html registers a cache-first service worker; tests.html unregisters
// any leftover registration before the suite runs (see tests.html), so a
// plain cache-busted navigation is enough to always get the current files.
function loadApp() {
    return new Promise(function (resolve) {
        var iframe = document.getElementById("app-frame");
        iframe.addEventListener("load", function onLoad() {
            iframe.removeEventListener("load", onLoad);
            resolve(iframe.contentWindow);
        });
        iframe.src = "../index.html?v=" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
    });
}

// partialState === null clears storage (fresh install / onboarding tests).
// Otherwise seeds storage with the given state before the app boots.
async function freshApp(partialState) {
    if (partialState === null) {
        localStorage.removeItem(APP_STORAGE_KEY);
    } else {
        seedState(partialState || {});
    }
    return await loadApp();
}

function setValue(el, value) {
    el.value = value;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
}

function isActive(screenEl) {
    return screenEl.classList.contains("active");
}

function isHidden(el) {
    return el.classList.contains("hidden");
}

function baseCategory(overrides) {
    var category = {
        id: "cat-" + Math.random().toString(36).slice(2, 8),
        emoji: "🛒",
        name: "Groceries",
        max: 100,
        type: "expense",
        hidden: false
    };
    for (var key in overrides) {
        category[key] = overrides[key];
    }
    return category;
}

function pad2(n) {
    return n < 10 ? "0" + n : "" + n;
}

function nowDatetime() {
    var d = new Date();
    return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate()) + "T" + pad2(d.getHours()) + ":" + pad2(d.getMinutes());
}

function daysAgoDatetime(n) {
    var d = new Date();
    d.setDate(d.getDate() - n);
    return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate()) + "T12:00";
}

function baseTransaction(overrides) {
    var transaction = {
        id: "txn-" + Math.random().toString(36).slice(2, 8),
        datetime: new Date().toISOString().slice(0, 16),
        categoryId: null,
        amount: 10,
        comment: ""
    };
    for (var key in overrides) {
        transaction[key] = overrides[key];
    }
    return transaction;
}
