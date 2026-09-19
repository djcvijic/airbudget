// Read-only report for the dashboard's current period (reuses its
// periodOffset). Flagged tiles are a stripped-down, non-interactive
// dashboard tile — no add/history buttons — reusing its CSS classes.

var reportModal = document.getElementById("report-modal");
var reportTitleEl = document.getElementById("report-title");
var reportExpectedLabelEl = document.getElementById("report-expected-label");
var reportExpectedValueEl = document.getElementById("report-expected-value");
var reportActualValueEl = document.getElementById("report-actual-value");
var reportOnTrackMessageEl = document.getElementById("report-on-track-message");
var reportBelowTargetMessageEl = document.getElementById("report-below-target-message");
var reportProblemGridEl = document.getElementById("report-problem-grid");
var reportRealityCheckMessageEl = document.getElementById("report-reality-check-message");
var reportAccuracyMessageEl = document.getElementById("report-accuracy-message");

// Flags an expense over budget or unbudgeted-but-spent, and an income
// unset-but-received or short of its expected amount (including zero).
function isReportProblem(entry) {
    if (entry.overMax) {
        return true;
    }
    if (entry.type === "expense") {
        return entry.max == null && entry.spend > 0;
    }
    var actualIncome = -entry.spend;
    return entry.max == null ? actualIncome !== 0 : actualIncome < entry.max;
}

function buildReportProblemTile(entry) {
    var tile = document.createElement("div");
    tile.className = "category-tile" + (entry.overMax ? " category-tile-over" : "");
    tile.dataset.id = entry.id;

    var emojiZone = document.createElement("div");
    emojiZone.className = "category-tile-add-zone";
    var emojiEl = document.createElement("div");
    emojiEl.className = "category-tile-emoji";
    emojiEl.textContent = entry.emoji;
    emojiZone.appendChild(emojiEl);
    tile.appendChild(emojiZone);

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

    return tile;
}

function renderReportAmount(el, amount) {
    if (amount === 0) {
        el.className = "report-row-value balance-amount";
        el.textContent = formatCurrency(0);
        return;
    }
    var isPositive = amount > 0;
    el.className = "report-row-value balance-amount" + (isPositive ? " amount-income" : " amount-spend");
    el.textContent = (isPositive ? "+" : "-") + formatCurrency(Math.abs(amount));
}

function openReportModal() {
    var range = getPeriodRange(state.period, periodOffset);
    reportTitleEl.textContent = "Report: " + formatPeriodLabel(range.start, range.end);
    reportExpectedLabelEl.textContent = "Expected balance this " + GOAL_PERIOD_UNIT_NAMES[state.period] + ":";

    var expectedSavings = getExpectedPeriodicIncome();
    renderReportAmount(reportExpectedValueEl, expectedSavings);

    var entries = getSortedCategoryEntries(range.start, range.end);
    var actualSavings = -entries.reduce(function (sum, e) { return sum + e.spend; }, 0);
    renderReportAmount(reportActualValueEl, actualSavings);

    var onTrack = actualSavings >= expectedSavings;
    reportOnTrackMessageEl.style.display = onTrack ? "" : "none";
    reportRealityCheckMessageEl.style.display = onTrack ? "" : "none";
    reportBelowTargetMessageEl.style.display = onTrack ? "none" : "";
    reportProblemGridEl.style.display = onTrack ? "none" : "";
    reportAccuracyMessageEl.style.display = onTrack ? "none" : "";

    reportProblemGridEl.innerHTML = "";
    if (!onTrack) {
        entries.filter(isReportProblem).forEach(function (entry) {
            reportProblemGridEl.appendChild(buildReportProblemTile(entry));
        });
    }

    openModal(reportModal);
}
