// New-transaction screen, opened from a dashboard tile click (main-view.js)
// or the top bar's new-transaction button (main.js), the latter with no
// categoryId so the select just falls back to its first option. The user
// always enters an unsigned amount, stored as-is — a transaction is an
// expense or income purely based on its category's type, shown live via
// the +/- indicator next to the input, never by negating the amount.
// Unlike settings/categories, leaving this screen never warns about
// unsaved input — Back and Cancel both just discard and return.
//
// The exact time of day is never shown or editable anywhere in the app,
// only the date — but a transaction's datetime still needs a real time
// component, so the time-of-day at the moment the screen opens is kept
// in transactionTimeOfDay and stitched back onto whatever date the user
// picks when the transaction is saved.

var transactionScreen = document.getElementById("transaction-screen");
var transactionPeriodLabelEl = document.getElementById("transaction-period-label");
var transactionDateDisplayEl = document.getElementById("transaction-date-display");
var transactionDateTextEl = document.getElementById("transaction-date-text");
var transactionDatetimeInput = document.getElementById("transaction-datetime-input");
var transactionCategorySelect = document.getElementById("transaction-category-select");
var transactionAmountInput = document.getElementById("transaction-amount-input");
var transactionAmountSignEl = document.getElementById("transaction-amount-sign");
var transactionCommentInput = document.getElementById("transaction-comment-input");
var transactionCurrencyLabel = document.getElementById("transaction-currency-label");
var transactionErrorEl = document.getElementById("transaction-error");

var transactionTimeOfDay = null;
var transactionSelectedDate = null;

function updateTransactionAmountSign() {
    var category = getCategoryById(transactionCategorySelect.value);
    var isIncome = category && category.type === "income";
    transactionAmountSignEl.textContent = isIncome ? "+" : "−";
    transactionAmountSignEl.className = "transaction-amount-sign" + (isIncome ? " amount-income" : " amount-spend");
}

transactionCategorySelect.addEventListener("change", updateTransactionAmountSign);

// The native date input's own value is "YYYY-MM-DD"; parsing that directly
// via `new Date(string)` reads it as UTC, which can roll it back a day in
// negative-UTC timezones. Parse the components explicitly instead.
function parseDateOnly(value) {
    var parts = value.split("-");
    return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
}

// formatDayHeader is defined in detail.js (loaded after this file), but
// this only runs from a click/change handler, long after boot finishes.
function updateTransactionDateDisplay() {
    var value = transactionDatetimeInput.value;
    transactionDateTextEl.textContent = value ? formatDayHeader(parseDateOnly(value)) : "";
}

transactionDateDisplayEl.addEventListener("click", function () {
    if (transactionDatetimeInput.showPicker) {
        transactionDatetimeInput.showPicker();
    } else {
        transactionDatetimeInput.focus();
    }
});

// The native picker's own "Clear" control would empty the input; a
// transaction always needs a date, so an empty value is rejected and
// reset back to today instead of letting it stick.
transactionDatetimeInput.addEventListener("change", function () {
    if (!transactionDatetimeInput.value) {
        transactionSelectedDate = formatDateOnly(new Date());
        transactionDatetimeInput.value = transactionSelectedDate;
    } else {
        transactionSelectedDate = transactionDatetimeInput.value;
    }
    updateTransactionDateDisplay();
});

// Used by the debug data generator (main.js) for random full timestamps;
// the transaction screen itself only ever works with the date portion.
function formatDatetimeLocal(date) {
    return formatDateOnly(date) + "T" + pad2(date.getHours()) + ":" + pad2(date.getMinutes());
}

// Ranks categories for the picker: most transactions in the current
// (real, not-viewed) period first, ties broken by all-time transaction
// count, remaining ties broken alphabetically by name.
function sortedTransactionCategories() {
    var range = getPeriodRange(state.period, 0);

    function countInRange(categoryId) {
        return getTransactionsInRange(range.start, range.end)
            .filter(function (t) { return t.categoryId === categoryId; }).length;
    }

    function countAllTime(categoryId) {
        return state.transactions.filter(function (t) { return t.categoryId === categoryId; }).length;
    }

    return state.categories.slice().sort(function (a, b) {
        var currentDiff = countInRange(b.id) - countInRange(a.id);
        if (currentDiff !== 0) {
            return currentDiff;
        }
        var allTimeDiff = countAllTime(b.id) - countAllTime(a.id);
        if (allTimeDiff !== 0) {
            return allTimeDiff;
        }
        return a.name.localeCompare(b.name);
    });
}

// Hidden categories are left out of the picker, except the one already
// selected (e.g. from clicking a dashboard tile directly) so the select
// still reflects it correctly instead of silently falling back.
function buildTransactionCategoryOptions(currentCategoryId) {
    transactionCategorySelect.innerHTML = "";

    var placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "Select";
    placeholder.disabled = true;
    transactionCategorySelect.appendChild(placeholder);

    sortedTransactionCategories().forEach(function (category) {
        if (category.hidden && category.id !== currentCategoryId) {
            return;
        }
        var option = document.createElement("option");
        option.value = category.id;
        option.textContent = category.emoji + (category.name ? " " + category.name : "");
        transactionCategorySelect.appendChild(option);
    });
}

function openTransactionScreen(categoryId) {
    transactionErrorEl.textContent = "";
    var range = getPeriodRange(state.period, periodOffset);
    transactionPeriodLabelEl.textContent = formatPeriodLabel(range.start, range.end);
    buildTransactionCategoryOptions(categoryId);
    transactionCategorySelect.value = categoryId || "";
    var now = new Date();
    transactionTimeOfDay = { hours: now.getHours(), minutes: now.getMinutes() };
    transactionSelectedDate = formatDateOnly(now);
    transactionDatetimeInput.value = transactionSelectedDate;
    updateTransactionDateDisplay();
    transactionAmountInput.value = "";
    transactionCommentInput.value = "";
    transactionCurrencyLabel.textContent = state.currency;
    updateTransactionAmountSign();

    showScreen(transactionScreen);
}

function applyTransaction() {
    var dateOnly = transactionDatetimeInput.value;
    var categoryId = transactionCategorySelect.value;
    var amount = parseFloat(transactionAmountInput.value);
    var comment = transactionCommentInput.value.trim();

    if (!dateOnly || !categoryId || isNaN(amount) || !isFinite(amount) || amount < 0) {
        transactionErrorEl.textContent = "A date, category, and a positive numeric amount are required.";
        return;
    }

    var datetime = dateOnly + "T" + pad2(transactionTimeOfDay.hours) + ":" + pad2(transactionTimeOfDay.minutes);

    state.transactions.push({
        id: generateId("txn"),
        datetime: datetime,
        categoryId: categoryId,
        amount: amount,
        comment: comment
    });
    saveTransactions();

    goToMainView();
}

function cancelTransaction() {
    goToMainView();
}
