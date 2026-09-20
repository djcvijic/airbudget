// Read-only report for the dashboard's current period (reuses its
// periodOffset), plus the banner nudging toward an unseen one. Flagged
// tiles are a stripped-down, non-interactive dashboard tile — no
// add/history buttons — reusing its CSS classes.

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
var reportBannerEl = document.getElementById("report-banner");

function lastSecondOfPeriod(range) {
    return new Date(range.end.getTime() - 1000);
}

// The most recent report is always last period relative to today, not a
// stored value, so it naturally advances once the current period rolls over.
function hasUnseenReport() {
    var lastSecond = lastSecondOfPeriod(getPeriodRange(state.period, -1));
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

    reportTitleEl.textContent = "Report: " + formatPeriodLabel(range.start, range.end);
    reportExpectedLabelEl.textContent = "Expected balance this " + GOAL_PERIOD_UNIT_NAMES[state.period] + ":";

    var expectedSavings = getExpectedPeriodicIncome();
    renderSignedAmount(reportExpectedValueEl, "report-row-value balance-amount", expectedSavings, expectedSavings > 0, formatCurrency);

    var entries = getSortedCategoryEntries(range.start, range.end);
    var actualSavings = -entries.reduce(function (sum, e) { return sum + e.spend; }, 0);
    renderSignedAmount(reportActualValueEl, "report-row-value balance-amount", actualSavings, actualSavings > 0, formatCurrency);

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
