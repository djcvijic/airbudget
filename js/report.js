// Read-only report for the dashboard's current period (reuses its
// periodOffset), plus the banner nudging toward an unseen one. Flagged
// tiles are a stripped-down, non-interactive dashboard tile — no
// add/history buttons — reusing its CSS classes.

var reportScreen = document.getElementById("report-screen");
var reportPeriodLabelEl = document.getElementById("report-period-label");
var reportExpectedLabelEl = document.getElementById("report-expected-label");
var reportExpectedValueEl = document.getElementById("report-expected-value");
var reportActualValueEl = document.getElementById("report-actual-value");
var reportOnTrackMessageEl = document.getElementById("report-on-track-message");
var reportBelowTargetMessageEl = document.getElementById("report-below-target-message");
var reportProblemGridEl = document.getElementById("report-problem-grid");
var reportRealityCheckMessageEl = document.getElementById("report-reality-check-message");
var reportAccuracyMessageEl = document.getElementById("report-accuracy-message");
var reportBannerEl = document.getElementById("report-banner");

function lastSecondOfPeriod(range) {
    return new Date(range.end.getTime() - 1000);
}

// Skips periods with no transactions, so a fresh account shows no banner.
function hasUnseenReport() {
    var range = getPeriodRange(state.period, -1);
    if (getTransactionsInRange(range.start, range.end).length === 0) {
        return false;
    }
    var lastSecond = lastSecondOfPeriod(range);
    return !state.lastSeenReport || new Date(state.lastSeenReport) < lastSecond;
}

function updateReportBanner() {
    reportBannerEl.style.display = hasUnseenReport() ? "flex" : "none";
}

function markMostRecentReportSeen() {
    state.lastSeenReport = formatDateTime(lastSecondOfPeriod(getPeriodRange(state.period, -1)));
    saveMeta();
}

function dismissReportBanner() {
    markMostRecentReportSeen();
    updateReportBanner();
}

function openMostRecentReport() {
    periodOffset = -1;
    renderMainView();
    openReportModal();
}

// Flags an expense over budget and an income short of its expected amount.
// Only called with a set budget/expectation — the || 0 fallback is for the
// tests, which also exercise unbudgeted entries directly.
function isReportProblem(entry) {
    return entry.type === "expense" ? entry.spend > (entry.max || 0) : -entry.spend < (entry.max || 0);
}

// Only the balance is colored — the operands are just its inputs, not
// something to react to.
function renderReportBalanceRow(containerEl, income, expense, balance, formatFn) {
    containerEl.className = "report-row-value report-equation";
    containerEl.innerHTML = "";

    var blankOperatorEl = document.createElement("span");
    blankOperatorEl.className = "report-equation-operator";

    var incomeEl = document.createElement("span");
    incomeEl.className = "balance-amount";
    incomeEl.textContent = formatFn(income);

    var minusEl = document.createElement("span");
    minusEl.className = "report-equation-operator";
    minusEl.textContent = "−";

    var expenseEl = document.createElement("span");
    expenseEl.className = "balance-amount";
    expenseEl.textContent = formatFn(expense);

    // Its own row spanning both columns, so the rule reads as one
    // unbroken line rather than two segments split by the column gap.
    var ruleEl = document.createElement("span");
    ruleEl.className = "report-equation-rule";

    var resultOperatorEl = document.createElement("span");
    resultOperatorEl.className = "report-equation-operator";

    var balanceEl = document.createElement("span");
    renderSignedAmount(balanceEl, "balance-amount", balance, balance > 0, formatFn);

    containerEl.appendChild(blankOperatorEl);
    containerEl.appendChild(incomeEl);
    containerEl.appendChild(minusEl);
    containerEl.appendChild(expenseEl);
    containerEl.appendChild(ruleEl);
    containerEl.appendChild(resultOperatorEl);
    containerEl.appendChild(balanceEl);
}

function buildReportProblemTile(entry) {
    var tile = buildTileShell(entry);

    var emojiZone = document.createElement("div");
    emojiZone.className = "category-tile-add-zone";
    var emojiEl = document.createElement("div");
    emojiEl.className = "category-tile-emoji";
    emojiEl.textContent = entry.emoji;
    emojiZone.appendChild(emojiEl);
    tile.appendChild(emojiZone);

    tile.appendChild(buildTileInfo(entry));

    return tile;
}

function openReportModal() {
    var range = getPeriodRange(state.period, periodOffset);

    // Only advances lastSeenReport, so opening an older period's report
    // afterward can't un-mark a more recent one as unseen.
    var lastSecond = lastSecondOfPeriod(range);
    if (!state.lastSeenReport || new Date(state.lastSeenReport) < lastSecond) {
        state.lastSeenReport = formatDateTime(lastSecond);
        saveMeta();
    }
    updateReportBanner();

    reportPeriodLabelEl.textContent = formatPeriodLabel(range.start, range.end);
    reportExpectedLabelEl.textContent = "Expected balance this " + GOAL_PERIOD_UNIT_NAMES[state.period] + ":";

    var expectedTotals = getExpectedPeriodTotals();
    var expectedSavings = expectedTotals.income - expectedTotals.expense;
    renderReportBalanceRow(reportExpectedValueEl, expectedTotals.income, expectedTotals.expense, expectedSavings, formatCurrency);

    var entries = getSortedCategoryEntries(range.start, range.end);
    var actualIncome = 0;
    var actualExpense = 0;
    entries.forEach(function (e) {
        if (e.type === "income") {
            actualIncome += -e.spend;
        } else {
            actualExpense += e.spend;
        }
    });
    var actualSavings = actualIncome - actualExpense;
    renderReportBalanceRow(reportActualValueEl, actualIncome, actualExpense, actualSavings, formatCurrency);

    var onTrack = actualSavings >= expectedSavings;
    reportOnTrackMessageEl.style.display = onTrack ? "" : "none";
    reportRealityCheckMessageEl.style.display = onTrack ? "" : "none";
    reportBelowTargetMessageEl.style.display = onTrack ? "none" : "";
    reportProblemGridEl.style.display = onTrack ? "none" : "";
    reportAccuracyMessageEl.style.display = onTrack ? "none" : "";

    // Unbudgeted categories have no threshold of their own to fail, so they
    // only show when their type overall caused the shortfall.
    var expensesOverBudget = actualExpense > expectedTotals.expense;
    var incomeUnderExpected = actualIncome < expectedTotals.income;

    reportProblemGridEl.innerHTML = "";
    if (!onTrack) {
        entries.filter(function (entry) {
            if (entry.max != null) {
                return isReportProblem(entry);
            }
            return entry.type === "expense" ? expensesOverBudget : incomeUnderExpected;
        }).forEach(function (entry) {
            reportProblemGridEl.appendChild(buildReportProblemTile(entry));
        });
    }

    showScreen(reportScreen);
}

function backFromReport() {
    goToMainView();
}
