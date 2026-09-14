// Dashboard: the main view. A category tile has two distinct clickable
// zones — the emoji/plus area adds a transaction (only when periodOffset is
// 0, otherwise the period is read-only) and the receipt area below the
// divider always opens that category's history — with the progress bar and
// amount in between not clickable at all. Calls openTransactionScreen()/
// openDetailView() only inside a function body (the click handler), so
// transaction.js/detail.js just need to load before a click happens, not
// before this file parses.

var mainViewScreen = document.getElementById("main-view-screen");
var periodLabelEl = document.getElementById("period-label");
var periodCurrentRow = document.getElementById("period-current-row");
var totalProgressAmountEl = document.getElementById("total-progress-amount");
var categoryGridEl = document.getElementById("category-grid");

var periodOffset = 0;

function renderTotalProgress(entries) {
    var totalSpend = entries.reduce(function (sum, e) { return sum + e.spend; }, 0);

    if (totalSpend === 0) {
        totalProgressAmountEl.className = "total-progress-amount balance-amount";
        totalProgressAmountEl.textContent = formatCurrency(0);
        return;
    }

    var isIncome = totalSpend < 0;
    totalProgressAmountEl.className = "total-progress-amount balance-amount" + (isIncome ? " amount-income" : " amount-spend");
    totalProgressAmountEl.textContent = (isIncome ? "+" : "-") + formatCurrency(Math.abs(totalSpend));
}

// Keeps tile amounts to ~5 characters so they fit the compact grid: plain
// 2-decimal below 100, whole numbers up to 99999, then K/M/etc via the
// built-in Intl compact notation beyond that.
function formatCompactAmount(amount) {
    var abs = Math.abs(amount);
    if (abs > 99999) {
        return new Intl.NumberFormat(undefined, {
            notation: "compact",
            maximumFractionDigits: 0
        }).format(amount);
    }
    return amount.toFixed(abs > 99.99 ? 0 : 2);
}

function buildCategoryTile(entry) {
    var tile = document.createElement("div");
    tile.className = "category-tile" + (entry.overMax ? " category-tile-over" : "");
    tile.dataset.id = entry.id;

    var addZone = document.createElement("button");
    addZone.type = "button";
    addZone.className = "category-tile-add-zone";
    addZone.disabled = periodOffset !== 0;

    var addIcon = document.createElement("i");
    addIcon.className = "fa-solid fa-plus category-tile-add-icon";

    var emojiEl = document.createElement("div");
    emojiEl.className = "category-tile-emoji";
    emojiEl.textContent = entry.emoji;

    addZone.appendChild(addIcon);
    addZone.appendChild(emojiEl);
    tile.appendChild(addZone);

    var infoEl = document.createElement("div");
    infoEl.className = "category-tile-info";

    var track = document.createElement("div");
    track.className = "category-tile-progress-track";
    var fill = document.createElement("div");
    fill.className = "category-tile-progress-fill";
    var percent = entry.max != null && entry.max > 0 ? (Math.abs(entry.spend) / entry.max) * 100 : 0;
    fill.style.width = Math.max(0, Math.min(100, percent)) + "%";
    track.appendChild(fill);
    infoEl.appendChild(track);

    // Same expense/income convention as the balance and transaction history:
    // pink with a minus, blue with a plus, plain black with no sign at zero.
    var isIncome = entry.spend < 0;
    var isZero = entry.spend === 0;

    var amountsEl = document.createElement("div");
    amountsEl.className = "category-tile-amounts" + (isZero ? "" : (isIncome ? " amount-income" : " amount-spend"));

    var amountValueEl = document.createElement("div");
    amountValueEl.className = "category-tile-amount-value";
    amountValueEl.textContent = (isZero ? "" : (isIncome ? "+" : "-")) + formatCompactAmount(Math.abs(entry.spend));

    var amountCurrencyEl = document.createElement("div");
    amountCurrencyEl.className = "category-tile-amount-currency";
    amountCurrencyEl.textContent = state.currency;

    amountsEl.appendChild(amountValueEl);
    amountsEl.appendChild(amountCurrencyEl);
    infoEl.appendChild(amountsEl);
    tile.appendChild(infoEl);

    var divider = document.createElement("div");
    divider.className = "category-tile-divider";
    tile.appendChild(divider);

    var historyZone = document.createElement("button");
    historyZone.type = "button";
    historyZone.className = "category-tile-history-zone";
    historyZone.innerHTML = '<i class="fa-solid fa-receipt"></i>';

    // Nested inside the history zone (not a separate element) so clicking
    // the warning icon also opens history, same as clicking anywhere else
    // in that zone.
    if (entry.overMax) {
        var warningEl = document.createElement("div");
        warningEl.className = "category-tile-warning";
        warningEl.title = "Over budget";
        warningEl.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i>';
        historyZone.appendChild(warningEl);
    }

    tile.appendChild(historyZone);

    return tile;
}

function renderMainView() {
    var range = getPeriodRange(state.period, periodOffset);
    periodLabelEl.textContent = formatPeriodLabel(range.start, range.end);
    periodCurrentRow.style.display = periodOffset === 0 ? "none" : "flex";

    var entries = getSortedCategorySpends(range.start, range.end);
    renderTotalProgress(entries);

    categoryGridEl.innerHTML = "";
    entries.forEach(function (entry) {
        categoryGridEl.appendChild(buildCategoryTile(entry));
    });
}

function goToMainView() {
    showScreen(mainViewScreen);
    renderMainView();
}

function handleCategoryGridClick(event) {
    var tile = event.target.closest(".category-tile");
    if (!tile) {
        return;
    }

    var categoryId = tile.dataset.id;

    if (event.target.closest(".category-tile-history-zone")) {
        openDetailView("category", categoryId);
        return;
    }

    if (!event.target.closest(".category-tile-add-zone") || periodOffset !== 0) {
        return;
    }

    var category = getCategoryById(categoryId);
    if (category && category.hidden) {
        showToast("This category is hidden from new transactions");
        return;
    }

    openTransactionScreen(categoryId);
}

function goToPreviousPeriod() {
    periodOffset -= 1;
    renderMainView();
}

function goToNextPeriod() {
    periodOffset += 1;
    renderMainView();
}

function goToCurrentPeriod() {
    periodOffset = 0;
    renderMainView();
}

categoryGridEl.addEventListener("click", handleCategoryGridClick);
