// Boot sequence and all event wiring. Loads last, after every other script.
// Also owns the dev-only debug shortcut (option+cmd+r fills random state),
// since it's a one-off app-specific tool rather than a screen of its own.

var DEBUG_CATEGORY_POOL = [
    { emoji: "🛒", name: "Groceries" },
    { emoji: "🍔", name: "Fast Food" },
    { emoji: "☕", name: "Coffee" },
    { emoji: "🎬", name: "Entertainment" },
    { emoji: "🚗", name: "Transport" },
    { emoji: "⛽", name: "Fuel" },
    { emoji: "🏠", name: "Rent" },
    { emoji: "💡", name: "Utilities" },
    { emoji: "📱", name: "Phone" },
    { emoji: "🌐", name: "Internet" },
    { emoji: "👕", name: "Clothing" },
    { emoji: "💊", name: "Health" },
    { emoji: "🏋️", name: "Gym" },
    { emoji: "📚", name: "Books" },
    { emoji: "🎮", name: "Gaming" },
    { emoji: "✈️", name: "Travel" },
    { emoji: "🎁", name: "Gifts" },
    { emoji: "🐶", name: "Pet" },
    { emoji: "🍺", name: "Bars" },
    { emoji: "🧴", name: "Personal Care" },
    { emoji: "🎵", name: "Music" },
    { emoji: "🛠️", name: "Maintenance" }
];

var DEBUG_COMMENT_POOL = [
    "with friends",
    "monthly",
    "one-off",
    "on sale",
    "for the trip",
    "reimbursed later",
    "forgot about this one"
];

var debugToastEl = document.getElementById("debug-toast");
var debugToastTimer = null;

function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomDebugComment() {
    return Math.random() < 0.35 ? DEBUG_COMMENT_POOL[randomInt(0, DEBUG_COMMENT_POOL.length - 1)] : "";
}

function randomAmount(min, max) {
    return Math.round((Math.random() * (max - min) + min) * 100) / 100;
}

function randomDatetimeInRange(start, end) {
    return formatDatetimeLocal(new Date(randomInt(start.getTime(), end.getTime() - 1)));
}

function shuffled(array) {
    var copy = array.slice();
    for (var i = copy.length - 1; i > 0; i--) {
        var j = randomInt(0, i);
        var temp = copy[i];
        copy[i] = copy[j];
        copy[j] = temp;
    }
    return copy;
}

function showDebugToast(message) {
    debugToastEl.textContent = message;
    debugToastEl.classList.add("visible");
    clearTimeout(debugToastTimer);
    debugToastTimer = setTimeout(function () {
        debugToastEl.classList.remove("visible");
    }, 2000);
}

function fillRandomDebugData() {
    state = defaultState();
    state.period = "monthly";
    state.currency = "RSD";

    var picks = shuffled(DEBUG_CATEGORY_POOL).slice(0, 16);
    var incomeIndexes = shuffled(picks.map(function (p, i) { return i; })).slice(0, 2);

    state.categories = picks.map(function (pick, i) {
        var isIncome = incomeIndexes.indexOf(i) !== -1;
        return {
            id: generateId("cat"),
            emoji: pick.emoji,
            name: pick.name,
            max: isIncome ? null : randomAmount(1000, 20000),
            type: isIncome ? "income" : "expense"
        };
    });

    // Both the current period and the one before it, so period navigation
    // (prev arrow / "Back to current") has something to look at too.
    var ranges = [getPeriodRange(state.period, 0), getPeriodRange(state.period, -1)];

    state.categories.forEach(function (category) {
        var amountCeiling = (category.max != null ? category.max : 20000) * 0.6;
        ranges.forEach(function (range) {
            var count = randomInt(0, 3);
            for (var i = 0; i < count; i++) {
                var amount = randomAmount(50, amountCeiling);
                state.transactions.push({
                    id: generateId("txn"),
                    datetime: randomDatetimeInRange(range.start, range.end),
                    categoryId: category.id,
                    amount: amount,
                    comment: randomDebugComment()
                });
            }
        });
    });

    saveState();
    periodOffset = 0;
    closeModals();
    boot();
    showDebugToast("Loaded random debug data");
}

function boot() {
    if (!state.period || !state.currency) {
        openOnboardingScreen();
    } else if (state.categories.length === 0) {
        openCategoriesScreen(true);
    } else {
        showScreen(mainViewScreen);
        renderMainView();
    }
}

function main() {
    document.getElementById("onboarding-continue-button").addEventListener("click", applyOnboarding);

    document.getElementById("add-category-button").addEventListener("click", addCategoryRow);
    document.getElementById("categories-auto-create-button").addEventListener("click", createCategoriesAutomatically);
    document.getElementById("categories-back-button").addEventListener("click", backFromCategories);
    document.getElementById("categories-onboarding-back-button").addEventListener("click", backFromCategories);
    document.getElementById("categories-revert-button").addEventListener("click", revertCategories);
    document.getElementById("categories-done-button").addEventListener("click", applyCategories);
    document.getElementById("categories-unsaved-apply-button").addEventListener("click", applyCategories);
    document.getElementById("categories-unsaved-revert-button").addEventListener("click", revertCategories);

    document.getElementById("period-prev-button").addEventListener("click", goToPreviousPeriod);
    document.getElementById("period-next-button").addEventListener("click", goToNextPeriod);
    document.getElementById("period-current-button").addEventListener("click", goToCurrentPeriod);

    // Only one of settings/categories can be the active screen at a time,
    // so nesting these guards is safe: whichever one isn't active is a
    // no-op and just calls through to navigateFn.
    function goToScreen(navigateFn) {
        goFromSettings(function () {
            goFromCategories(navigateFn);
        });
    }

    document.getElementById("open-transaction-button").addEventListener("click", function () {
        goToScreen(function () {
            openTransactionScreen();
        });
    });
    document.getElementById("transaction-back-button").addEventListener("click", cancelTransaction);
    document.getElementById("transaction-cancel-button").addEventListener("click", cancelTransaction);
    document.getElementById("open-settings-button").addEventListener("click", function () {
        goToScreen(openSettingsScreen);
    });
    document.getElementById("settings-back-button").addEventListener("click", backFromSettings);
    document.getElementById("settings-revert-button").addEventListener("click", revertSettings);
    document.getElementById("settings-unsaved-apply-button").addEventListener("click", applySettings);
    document.getElementById("settings-unsaved-revert-button").addEventListener("click", revertSettings);
    document.getElementById("open-categories-button").addEventListener("click", function () {
        goToScreen(function () {
            openCategoriesScreen(false);
        });
    });
    document.getElementById("open-detail-button").addEventListener("click", function () {
        goToScreen(function () {
            openDetailView();
        });
    });

    document.getElementById("detail-back-button").addEventListener("click", backFromDetail);
    detailModeButtons.forEach(function (button) {
        button.addEventListener("click", function () {
            setDetailMode(button.dataset.mode);
        });
    });

    document.getElementById("settings-apply-button").addEventListener("click", applySettings);
    document.getElementById("transaction-apply-button").addEventListener("click", applyTransaction);

    document.getElementById("delete-data-button").addEventListener("click", openDeleteConfirmModal);
    var deleteConfirmButtonEl = document.getElementById("delete-confirm-button");
    deleteConfirmButtonEl.addEventListener("mousedown", startDeleteHold);
    deleteConfirmButtonEl.addEventListener("touchstart", startDeleteHold);
    deleteConfirmButtonEl.addEventListener("mouseup", cancelDeleteHold);
    deleteConfirmButtonEl.addEventListener("mouseleave", cancelDeleteHold);
    deleteConfirmButtonEl.addEventListener("touchend", cancelDeleteHold);
    deleteConfirmButtonEl.addEventListener("contextmenu", function (e) {
        e.preventDefault();
    });

    function dismissModals() {
        pendingSettingsNavigation = null;
        pendingCategoriesNavigation = null;
        closeModals();
    }

    document.querySelectorAll(".modal-close").forEach(function (button) {
        button.addEventListener("click", dismissModals);
    });

    modalOverlay.addEventListener("click", function (e) {
        if (e.target === modalOverlay) {
            dismissModals();
        }
    });

    document.addEventListener("keydown", function (e) {
        if (e.altKey && e.metaKey && (e.code === "KeyR" || e.key.toLowerCase() === "r")) {
            e.preventDefault();
            fillRandomDebugData();
            return;
        }

        if (e.key === "Escape" && !modalOverlay.classList.contains("hidden")) {
            dismissModals();
        }
    });

    boot();
}

main();

if ("serviceWorker" in navigator) {
    window.addEventListener("load", function () {
        navigator.serviceWorker.register("sw.js");
    });
}
