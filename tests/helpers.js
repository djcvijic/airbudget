// Shared helpers for driving the real app inside the iframe. Every test
// file interacts with the app exactly like a user would: real DOM events
// on real elements, never a mocked or reimplemented DOM.

var APP_META_KEY = "airbudget-meta-v1";
var APP_CATEGORIES_KEY = "airbudget-categories-v1";
var APP_TRANSACTIONS_KEY = "airbudget-transactions-v1";
var APP_STORAGE_KEYS = [APP_META_KEY, APP_CATEGORIES_KEY, APP_TRANSACTIONS_KEY];

function seedState(partial) {
    localStorage.setItem(APP_META_KEY, JSON.stringify({
        period: partial.period || null,
        currency: partial.currency || null,
        detailMode: partial.detailMode || "day"
    }));
    localStorage.setItem(APP_CATEGORIES_KEY, JSON.stringify(partial.categories || []));
    localStorage.setItem(APP_TRANSACTIONS_KEY, JSON.stringify(partial.transactions || []));
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
        iframe.src = "../index.html?testMode=1&v=" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
    });
}

// partialState === null clears storage (fresh install / onboarding tests).
// Otherwise seeds storage with the given state before the app boots.
async function freshApp(partialState) {
    if (partialState === null) {
        APP_STORAGE_KEYS.forEach(function (key) { localStorage.removeItem(key); });
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

// Drives the transaction screen's numpad the same way a user's taps would,
// one button per character (digits and ".") — there's no text input to set
// a value on directly anymore.
function typeTransactionAmount(win, text) {
    text.split("").forEach(function (char) {
        win.transactionNumpadEl.querySelector('.transaction-numpad-button[data-value="' + char + '"]').click();
    });
}

// Numpad taps only ever append or backspace, so replacing an amount that's
// already there (e.g. when editing) means clearing it first, same as a
// real user would.
function clearTransactionAmount(win) {
    var backspace = win.transactionNumpadEl.querySelector('.transaction-numpad-button[data-value="backspace"]');
    while (win.transactionAmountValue !== "") {
        backspace.click();
    }
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

function monthsAgoDatetime(n) {
    var d = new Date();
    var targetMonth = new Date(d.getFullYear(), d.getMonth() - n, 1);
    var lastDayOfTargetMonth = new Date(targetMonth.getFullYear(), targetMonth.getMonth() + 1, 0).getDate();
    var day = Math.min(d.getDate(), lastDayOfTargetMonth);
    return targetMonth.getFullYear() + "-" + pad2(targetMonth.getMonth() + 1) + "-" + pad2(day) + "T12:00";
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
