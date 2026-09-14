// Persistence and derived calculations. Every other file depends on the
// globals defined here (state, and the functions below); this file itself
// depends on nothing else.

var STORAGE_KEY = "airbudget-state-v1";

function defaultState() {
    return { period: null, currency: null, categories: [], transactions: [], detailMode: "day" };
}

function loadState() {
    var raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
        return defaultState();
    }
    try {
        var parsed = JSON.parse(raw);
        return {
            period: parsed.period || null,
            currency: parsed.currency || null,
            categories: parsed.categories || [],
            transactions: parsed.transactions || [],
            detailMode: parsed.detailMode || "day"
        };
    } catch (e) {
        return defaultState();
    }
}

function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

var state = loadState();

function isOnboardingComplete(s) {
    return !!(s.period && s.currency && s.categories.length > 0);
}

// Generic screen/modal show-hide helpers. No app-specific logic — shared
// here (rather than duplicated per screen file) because every screen and
// both modals need them, and no single screen file owns them.
var modalOverlay = document.getElementById("modal-overlay");
var topBarEl = document.getElementById("top-bar");

function showScreen(screen) {
    document.querySelectorAll(".screen").forEach(function (s) {
        s.classList.remove("active");
    });
    screen.classList.add("active");

    var showTopBar = isOnboardingComplete(state);
    topBarEl.style.display = showTopBar ? "" : "none";
    document.body.classList.toggle("no-top-bar", !showTopBar);

    document.body.classList.toggle("detail-screen-active", screen.id === "detail-screen");

    window.scrollTo(0, 0);
}

function openModal(modal) {
    modalOverlay.classList.remove("hidden");
    modal.classList.remove("hidden");
}

function closeModals() {
    modalOverlay.classList.add("hidden");
    document.querySelectorAll(".modal").forEach(function (modal) {
        modal.classList.add("hidden");
    });
}

function generateId(prefix) {
    return prefix + "-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
}

function startOfDay(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function pad2(n) {
    return n < 10 ? "0" + n : "" + n;
}

function formatDateOnly(date) {
    return date.getFullYear() + "-" + pad2(date.getMonth() + 1) + "-" + pad2(date.getDate());
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
    return amount.toFixed(2) + " " + state.currency;
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

// Over-max categories first, then by spend descending, tied broken by max
// descending (categories with no max sort as if max were 0). Shared by the
// dashboard grid and the detail view's category-mode grouping so both stay
// consistent.
function compareCategoriesBySpend(a, b) {
    if (a.overMax !== b.overMax) {
        return a.overMax ? -1 : 1;
    }
    if (b.spend !== a.spend) {
        return b.spend - a.spend;
    }
    return (b.max || 0) - (a.max || 0);
}

function getSortedCategorySpends(start, end) {
    var entries = state.categories.map(function (cat) {
        var spend = getCategorySpend(cat.id, start, end);
        return {
            id: cat.id,
            name: cat.name,
            emoji: cat.emoji,
            max: cat.max,
            spend: spend,
            overMax: cat.max != null && spend > cat.max
        };
    });
    entries.sort(compareCategoriesBySpend);
    return entries;
}
