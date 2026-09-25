// Persistence and derived calculations. Every other file depends on the
// globals defined here (state, and the functions below); this file itself
// depends on nothing else.

// One key per concern rather than one blob: a settings change no longer
// rewrites the (much larger, ever-growing) transactions array, and vice
// versa.
var META_KEY = "airbudget-meta-v1";
var CATEGORIES_KEY = "airbudget-categories-v1";
var TRANSACTIONS_KEY = "airbudget-transactions-v1";

function defaultState() {
    return { period: null, currency: null, categories: [], transactions: [], detailMode: "day", goalAmount: null, goalSetDate: null, lastSeenReport: null };
}

function readJSON(key, fallback) {
    var raw = localStorage.getItem(key);
    if (!raw) {
        return fallback;
    }
    try {
        return JSON.parse(raw);
    } catch (e) {
        return fallback;
    }
}

function loadState() {
    var meta = readJSON(META_KEY, {});
    return {
        period: meta.period || null,
        currency: meta.currency || null,
        categories: readJSON(CATEGORIES_KEY, []),
        transactions: readJSON(TRANSACTIONS_KEY, []),
        detailMode: "day",
        goalAmount: meta.goalAmount != null ? meta.goalAmount : null,
        goalSetDate: meta.goalSetDate || null,
        lastSeenReport: meta.lastSeenReport || null
    };
}

// Copies each defaultState() field from the imported file when present.
// A field added to defaultState() later is picked up automatically, with
// no matching edit needed here or in any other reset path (deleteAllData,
// fillRandomDebugData). detailMode is excluded: it's session-only and
// never persisted (see loadState()).
function stateFromImport(imported) {
    var result = defaultState();
    Object.keys(result).forEach(function (key) {
        if (key !== "detailMode" && imported[key] !== undefined) {
            result[key] = imported[key];
        }
    });
    return result;
}

function persist(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
    } catch (e) {
        showToast("Couldn't save, storage is full");
        return false;
    }
}

function saveMeta() {
    return persist(META_KEY, {
        period: state.period,
        currency: state.currency,
        goalAmount: state.goalAmount,
        goalSetDate: state.goalSetDate,
        lastSeenReport: state.lastSeenReport
    });
}

function saveCategories() {
    return persist(CATEGORIES_KEY, state.categories);
}

function saveTransactions() {
    return persist(TRANSACTIONS_KEY, state.transactions);
}

var state = loadState();

// Keeps this tab's in-memory state from going stale when another tab
// (or an installed-app instance open alongside a browser tab) saves a
// change — otherwise this tab's next save would overwrite that change
// with its own outdated copy. The event only fires in tabs other than
// the one that wrote the change.
window.addEventListener("storage", function (e) {
    if (e.key === META_KEY) {
        var meta = readJSON(META_KEY, {});
        state.period = meta.period || null;
        state.currency = meta.currency || null;
        state.goalAmount = meta.goalAmount != null ? meta.goalAmount : null;
        state.goalSetDate = meta.goalSetDate || null;
        state.lastSeenReport = meta.lastSeenReport || null;
    } else if (e.key === CATEGORIES_KEY) {
        state.categories = readJSON(CATEGORIES_KEY, []);
    } else if (e.key === TRANSACTIONS_KEY) {
        state.transactions = readJSON(TRANSACTIONS_KEY, []);
    } else {
        return;
    }

    if (mainViewScreen.classList.contains("active")) {
        renderMainView();
    }
});

function isOnboardingComplete(s) {
    return !!(s.period && s.currency && s.categories.length > 0);
}

// Screens with no entry here (report-screen, onboarding) just leave every
// nav button unhighlighted, since neither has one of its own.
var NAV_BUTTON_ID_BY_SCREEN_ID = {
    "main-view-screen": "open-home-button",
    "transaction-screen": "open-transaction-button",
    "detail-screen": "open-detail-button",
    "goals-screen": "open-goals-button",
    "categories-screen": "open-categories-button",
    "settings-screen": "open-settings-button"
};

function showScreen(screen) {
    setActiveScreen(screen, NAV_BUTTON_ID_BY_SCREEN_ID, function () {
        return isOnboardingComplete(state);
    });
    document.body.classList.toggle("show-to-top", screen.id === "detail-screen");
}

// Remembers a forced onboarding step's not-yet-applied edit across one
// backward hop, so returning forward restores it without touching state.
function createStepDraft() {
    var value = null;
    return {
        save: function (v) { value = v; },
        get: function () { return value; },
        clear: function () { value = null; }
    };
}

function generateId(prefix) {
    return prefix + "-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
}

function startOfDay(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function formatDateTime(date) {
    return formatDateOnly(date) + "T" + pad2(date.getHours()) + ":" + pad2(date.getMinutes()) + ":" + pad2(date.getSeconds());
}

function getCategoryById(id) {
    return state.categories.filter(function (c) { return c.id === id; })[0];
}

// Weeks start Monday. Returns { start, end } as Date objects; end is
// exclusive (the start of the following period), so filtering can use
// datetime >= start && datetime < end.
function getPeriodRange(period, offset) {
    var today = startOfDay(new Date());
    var start, end;

    if (period === "daily") {
        start = new Date(today.getFullYear(), today.getMonth(), today.getDate() + offset);
        end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 1);
    } else if (period === "weekly") {
        var daysSinceMonday = (today.getDay() + 6) % 7;
        var monday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - daysSinceMonday);
        start = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + offset * 7);
        end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7);
    } else if (period === "monthly") {
        start = new Date(today.getFullYear(), today.getMonth() + offset, 1);
        end = new Date(start.getFullYear(), start.getMonth() + 1, 1);
    } else {
        start = new Date(today.getFullYear() + offset, 0, 1);
        end = new Date(start.getFullYear() + 1, 0, 1);
    }

    return { start: start, end: end };
}

// Date.UTC on just the y/m/d fields (not the real Date objects) keeps day
// math exact across DST transitions, which local-time ms subtraction would not.
function daysBetween(a, b) {
    return Math.round((Date.UTC(a.getFullYear(), a.getMonth(), a.getDate()) - Date.UTC(b.getFullYear(), b.getMonth(), b.getDate())) / 86400000);
}

// Inverse of getPeriodRange: which offset bucket a date falls into.
function getPeriodOffsetForDate(period, date) {
    var today = startOfDay(new Date());

    if (period === "daily") {
        return daysBetween(date, today);
    }
    if (period === "weekly") {
        var daysSinceMonday = (today.getDay() + 6) % 7;
        var monday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - daysSinceMonday);
        return Math.floor(daysBetween(date, monday) / 7);
    }
    if (period === "monthly") {
        return (date.getFullYear() - today.getFullYear()) * 12 + (date.getMonth() - today.getMonth());
    }
    return date.getFullYear() - today.getFullYear();
}

function getOffsetsWithTransactions(period) {
    var seen = {};
    state.transactions.forEach(function (t) {
        seen[getPeriodOffsetForDate(period, new Date(t.datetime))] = true;
    });
    return Object.keys(seen).map(Number);
}

// The nearest period offset with a transaction in the given direction (-1
// back, 1 forward) from fromOffset, or null if there isn't one. Offset 0
// (the current period) always counts as a valid target even when it's
// empty, so navigation can always return to it.
function findAdjacentPeriodOffset(period, fromOffset, direction) {
    var candidates = getOffsetsWithTransactions(period).concat([0]).filter(function (offset) {
        return direction < 0 ? offset < fromOffset : offset > fromOffset;
    });
    if (candidates.length === 0) {
        return null;
    }
    return direction < 0 ? Math.max.apply(null, candidates) : Math.min.apply(null, candidates);
}

function formatDatePart(date, includeYear) {
    var options = { month: "short", day: "numeric" };
    if (includeYear) {
        options.year = "numeric";
    }
    return date.toLocaleDateString(undefined, options);
}

function formatPeriodLabel(start, end) {
    var lastDay = new Date(end.getFullYear(), end.getMonth(), end.getDate() - 1);
    var currentYear = new Date().getFullYear();
    var showYear = start.getFullYear() !== currentYear || lastDay.getFullYear() !== currentYear;
    var sameDay = start.getFullYear() === lastDay.getFullYear()
        && start.getMonth() === lastDay.getMonth()
        && start.getDate() === lastDay.getDate();

    if (sameDay) {
        return formatDatePart(start, showYear);
    }
    return formatDatePart(start, showYear) + " - " + formatDatePart(lastDay, showYear);
}

function formatCurrency(amount) {
    return amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " " + state.currency;
}

// Shared by every signed, colored amount (dashboard total, report
// balances, detail rows). isIncome is caller-resolved rather than derived
// from amount's sign here, since that convention differs by screen: net
// spend positive, savings positive, or a transaction's fixed category type.
function renderSignedAmount(el, baseClassName, amount, isIncome, formatFn) {
    if (amount === 0) {
        el.className = baseClassName;
        el.textContent = formatFn(0);
        return;
    }
    el.className = baseClassName + (isIncome ? " amount-income" : " amount-spend");
    el.textContent = (isIncome ? "+" : "-") + formatFn(Math.abs(amount));
}

function getTransactionsInRange(start, end) {
    return state.transactions.filter(function (t) {
        var d = new Date(t.datetime);
        return d >= start && d < end;
    }).sort(function (a, b) {
        return new Date(b.datetime) - new Date(a.datetime);
    });
}

// Transaction amounts are always stored unsigned; a category's type (fixed
// per category) is what makes it an expense or income, not the amount's
// sign. Net spend here stays a signed value (positive = net expense,
// negative = net income) since everything downstream (sorting, over-max,
// progress bars, totals) already relies on that convention.
function getCategorySpend(categoryId, start, end) {
    var category = getCategoryById(categoryId);
    var sign = category && category.type === "income" ? -1 : 1;

    return sign * getTransactionsInRange(start, end)
        .filter(function (t) { return t.categoryId === categoryId; })
        .reduce(function (sum, t) { return sum + t.amount; }, 0);
}

// Frecency: each transaction contributes a weight that halves every
// half-life (the current period's length), so recent activity dominates
// but old activity still counts for something rather than a hard cutoff.
// Shared by the dashboard grid, the detail view's category-mode grouping,
// and the transaction screen's category picker, so all three rank
// categories the same way.
function categoryFrecencyScores() {
    var range = getPeriodRange(state.period, 0);
    var halfLifeDays = daysBetween(range.end, range.start);
    var now = new Date();
    var scores = {};
    state.transactions.forEach(function (t) {
        var ageInDays = Math.max(0, daysBetween(now, new Date(t.datetime)));
        var weight = Math.pow(2, -ageInDays / halfLifeDays);
        scores[t.categoryId] = (scores[t.categoryId] || 0) + weight;
    });
    return scores;
}

function getSortedCategoryEntries(start, end) {
    var scores = categoryFrecencyScores();
    var entries = state.categories.map(function (cat) {
        var spend = getCategorySpend(cat.id, start, end);
        return {
            id: cat.id,
            name: cat.name,
            emoji: cat.emoji,
            type: cat.type,
            max: cat.max,
            spend: spend,
            // Income has no over-budget warning: more income than expected
            // isn't a problem, only more expense than budgeted is.
            overMax: cat.type === "expense" && cat.max != null && spend > cat.max
        };
    });
    entries.sort(function (a, b) {
        var scoreDiff = (scores[b.id] || 0) - (scores[a.id] || 0);
        if (scoreDiff !== 0) {
            return scoreDiff;
        }
        return a.name.localeCompare(b.name);
    });
    return entries;
}

// Net recurring income per period if every category's budget/expected
// income is hit exactly: expense budgets subtract, income expectations
// add. Categories with no budget/expected amount set don't contribute.
function getExpectedPeriodicIncome() {
    return state.categories.reduce(function (sum, cat) {
        if (cat.max == null) {
            return sum;
        }
        return sum + (cat.type === "income" ? cat.max : -cat.max);
    }, 0);
}
