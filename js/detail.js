// Detail/history screen. Shares the dashboard's periodOffset (main-view.js)
// rather than having its own period nav, since period navigation is a
// dashboard-only feature per spec.

var detailScreen = document.getElementById("detail-screen");
var detailPeriodLabelEl = document.getElementById("detail-period-label");
var detailModeSwitch = document.getElementById("detail-mode-switch");
var detailModeButtons = document.querySelectorAll(".detail-mode-option");
var detailListEl = document.getElementById("detail-list");

function formatDayHeader(date) {
    return date.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
}

function buildTransactionRow(t) {
    var category = getCategoryById(t.categoryId);

    var emojiEl = document.createElement("span");
    emojiEl.className = "detail-transaction-emoji";
    emojiEl.textContent = category ? category.emoji : "";

    var dateEl = document.createElement("span");
    dateEl.className = "detail-transaction-date";
    dateEl.textContent = new Date(t.datetime).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric"
    });

    var amountEl = document.createElement("span");
    renderSignedAmount(amountEl, "detail-transaction-amount", t.amount, category && category.type === "income", formatCurrency);

    var top = document.createElement("div");
    top.className = "detail-transaction-top";
    top.appendChild(dateEl);
    top.appendChild(amountEl);

    // Holds the top row and the comment, so the emoji can sit to the left
    // of both and stay vertically centered against the pair as a whole.
    var content = document.createElement("div");
    content.className = "detail-transaction-content";
    content.appendChild(top);

    if (t.comment) {
        var commentEl = document.createElement("div");
        commentEl.className = "detail-transaction-comment";
        commentEl.textContent = t.comment;
        content.appendChild(commentEl);
    }

    var row = document.createElement("button");
    row.type = "button";
    row.className = "detail-transaction";
    row.appendChild(emojiEl);
    row.appendChild(content);
    row.addEventListener("click", function () {
        openEditTransactionScreen(t.id);
    });

    return row;
}

// Builds a collapsible group: clicking the header toggles a "collapsed"
// class on the group element, which CSS uses to hide the body. balance is
// the group's net transaction sum (positive = spend, negative = income),
// shown on the header using the same sign/color convention as individual
// transaction amounts.
function buildDetailGroup(title, balance, elementId, collapsed) {
    var groupEl = document.createElement("div");
    groupEl.className = "detail-group" + (collapsed ? " collapsed" : "");
    if (elementId) {
        groupEl.id = elementId;
    }

    var header = document.createElement("button");
    header.type = "button";
    header.className = "detail-group-header";
    header.addEventListener("click", function () {
        groupEl.classList.toggle("collapsed");
    });

    var titleEl = document.createElement("span");
    titleEl.className = "detail-group-title";

    var chevronEl = document.createElement("i");
    chevronEl.className = "fa-solid fa-angle-right detail-group-chevron";

    var titleTextEl = document.createElement("span");
    titleTextEl.textContent = title;

    titleEl.appendChild(chevronEl);
    titleEl.appendChild(titleTextEl);

    var balanceEl = document.createElement("span");
    renderSignedAmount(balanceEl, "detail-group-balance balance-amount", balance, balance < 0, formatCurrency);

    header.appendChild(titleEl);
    header.appendChild(balanceEl);

    var bodyWrapper = document.createElement("div");
    bodyWrapper.className = "detail-group-body";

    var body = document.createElement("div");
    body.className = "detail-group-body-inner";
    bodyWrapper.appendChild(body);

    groupEl.appendChild(header);
    groupEl.appendChild(bodyWrapper);

    return { el: groupEl, body: body };
}

// Transactions arrive already sorted datetime desc, so grouping in
// iteration order keeps both days and same-day transactions desc.
function renderByDay(transactions) {
    var days = [];
    var currentKey = null;
    var currentDay = null;

    transactions.forEach(function (t) {
        var date = new Date(t.datetime);
        var key = formatDateOnly(date);

        if (key !== currentKey) {
            currentKey = key;
            currentDay = { date: date, transactions: [] };
            days.push(currentDay);
        }

        currentDay.transactions.push(t);
    });

    days.forEach(function (day) {
        // A day can mix categories of both types, so each transaction's
        // sign comes from its own category, not a single shared one.
        var net = day.transactions.reduce(function (sum, t) {
            var category = getCategoryById(t.categoryId);
            var sign = category && category.type === "income" ? -1 : 1;
            return sum + t.amount * sign;
        }, 0);
        var group = buildDetailGroup(formatDayHeader(day.date), net, null);
        day.transactions.forEach(function (t) {
            group.body.appendChild(buildTransactionRow(t));
        });
        detailListEl.appendChild(group.el);
    });
}

function renderByCategory(start, end) {
    var entries = getSortedCategoryEntries(start, end);

    entries.forEach(function (entry) {
        var transactions = getTransactionsInRange(start, end)
            .filter(function (t) { return t.categoryId === entry.id; });

        if (transactions.length === 0) {
            return;
        }

        var title = entry.emoji + (entry.name ? " " + entry.name : "");
        var group = buildDetailGroup(title, entry.spend, "detail-category-" + entry.id, true);

        transactions.forEach(function (t) {
            group.body.appendChild(buildTransactionRow(t));
        });

        detailListEl.appendChild(group.el);
    });
}

function renderDetailView() {
    var range = getPeriodRange(state.period, periodOffset);
    detailPeriodLabelEl.textContent = formatPeriodLabel(range.start, range.end);

    detailModeSwitch.dataset.mode = state.detailMode;
    detailModeButtons.forEach(function (button) {
        button.classList.toggle("selected", button.dataset.mode === state.detailMode);
    });

    detailListEl.innerHTML = "";

    if (state.detailMode === "day") {
        renderByDay(getTransactionsInRange(range.start, range.end));
    } else {
        renderByCategory(range.start, range.end);
    }
}

// mode is optional. Omit it to reset to day mode, the default whenever the
// screen opens fresh. Pass it to force a specific grouping instead — a
// tile's history button always forces category mode.
function openDetailView(mode, scrollToCategoryId) {
    state.detailMode = mode || "day";

    showScreen(detailScreen);
    renderDetailView();

    if (scrollToCategoryId) {
        var target = document.getElementById("detail-category-" + scrollToCategoryId);
        if (target) {
            target.classList.remove("collapsed");
            target.scrollIntoView();
        }
    }
}

function setDetailMode(mode) {
    if (mode === state.detailMode) {
        return;
    }
    state.detailMode = mode;
    renderDetailView();
}

function backFromDetail() {
    goToMainView();
}
