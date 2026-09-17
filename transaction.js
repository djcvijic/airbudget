// Add/edit transaction screen. Adding is opened from a dashboard tile click
// (main-view.js) or the top bar's new-transaction button (main.js), the
// latter with no categoryId so the select just falls back to its first
// option; editing is opened from a detail-view row click (detail.js). The
// user always enters an unsigned amount, stored as-is — a transaction is an
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
var transactionAmountDisplayEl = document.getElementById("transaction-amount-display");
var transactionAmountSignEl = document.getElementById("transaction-amount-sign");
var transactionNumpadEl = document.getElementById("transaction-numpad");
var transactionCommentInput = document.getElementById("transaction-comment-input");
var transactionErrorEl = document.getElementById("transaction-error");
var transactionApplyButton = document.getElementById("transaction-apply-button");
var transactionDeleteButton = document.getElementById("transaction-delete-button");
var transactionDeleteConfirmModal = document.getElementById("transaction-delete-confirm-modal");

var transactionTimeOfDay = null;
var transactionSelectedDate = null;

// Built up one numpad tap at a time (digits, at most one ".", backspace);
// parsed to a number only when the form is actually applied. There's no
// minus-sign button, so a negative value can never be entered in the first
// place — applyTransaction() doesn't need to guard against one.
var transactionAmountValue = "";

function updateTransactionAmountDisplay() {
    transactionAmountDisplayEl.textContent = (transactionAmountValue || "0.00") + " " + state.currency;
    transactionAmountDisplayEl.classList.toggle("transaction-amount-display-empty", transactionAmountValue === "");
}

transactionNumpadEl.addEventListener("click", function (e) {
    var button = e.target.closest(".transaction-numpad-button");
    if (!button) {
        return;
    }

    var value = button.dataset.value;
    var decimalIndex = transactionAmountValue.indexOf(".");
    if (value === "backspace") {
        transactionAmountValue = transactionAmountValue.slice(0, -1);
    } else if (value === "." && decimalIndex !== -1) {
        return;
    } else if (value !== "." && decimalIndex !== -1 && transactionAmountValue.length - decimalIndex > 2) {
        return;
    } else {
        transactionAmountValue += value;
    }
    updateTransactionAmountDisplay();
});

// Set by whichever entry point opened the screen, so Apply/Cancel/Delete
// all land back wherever the user actually came from: the dashboard for a
// new transaction, or the detail view when editing one opened from there.
var transactionReturnTo = null;

var editingTransactionId = null;

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
    var opened = false;
    if (transactionDatetimeInput.showPicker) {
        try {
            transactionDatetimeInput.showPicker();
            opened = true;
        } catch (e) {
            // Some mobile browsers throw here even though showPicker exists
            // (e.g. treating this hidden proxy input as gesture-ineligible);
            // fall through to focus() below instead of doing nothing.
        }
    }
    if (!opened) {
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

// Ranks categories for the picker by the same frecency score as the
// dashboard grid and the detail view's category grouping (state.js).
function sortedTransactionCategories() {
    var scores = categoryFrecencyScores();

    return state.categories.slice().sort(function (a, b) {
        var scoreDiff = (scores[b.id] || 0) - (scores[a.id] || 0);
        if (scoreDiff !== 0) {
            return scoreDiff;
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
    placeholder.textContent = "Category";
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

function populateTransactionForm(categoryId, dateOnly, timeOfDay, amount, comment) {
    transactionErrorEl.textContent = "";
    var range = getPeriodRange(state.period, periodOffset);
    transactionPeriodLabelEl.textContent = formatPeriodLabel(range.start, range.end);
    buildTransactionCategoryOptions(categoryId);
    transactionCategorySelect.value = categoryId || "";
    transactionTimeOfDay = timeOfDay;
    transactionSelectedDate = dateOnly;
    transactionDatetimeInput.value = dateOnly;
    updateTransactionDateDisplay();
    transactionAmountValue = amount === "" ? "" : String(amount);
    updateTransactionAmountDisplay();
    transactionCommentInput.value = comment;
    updateTransactionAmountSign();

    showScreen(transactionScreen);
}

function openTransactionScreen(categoryId) {
    editingTransactionId = null;
    transactionReturnTo = goToMainView;
    transactionDeleteButton.style.display = "none";

    var now = new Date();
    populateTransactionForm(categoryId, formatDateOnly(now), { hours: now.getHours(), minutes: now.getMinutes() }, "", "");
}

// Opened by clicking a transaction row in the detail view (detail.js).
// Keeps the transaction's original time of day rather than resetting it to
// now, since only the user's edits (category/date/amount/comment) should
// change what gets saved.
function openEditTransactionScreen(transactionId) {
    var t = state.transactions.filter(function (x) { return x.id === transactionId; })[0];
    if (!t) {
        return;
    }

    editingTransactionId = transactionId;
    transactionReturnTo = openDetailView;
    transactionDeleteButton.style.display = "";

    var datetime = new Date(t.datetime);
    var timeOfDay = { hours: datetime.getHours(), minutes: datetime.getMinutes() };
    populateTransactionForm(t.categoryId, formatDateOnly(datetime), timeOfDay, t.amount, t.comment || "");
}

function applyTransaction() {
    var dateOnly = transactionDatetimeInput.value;
    var categoryId = transactionCategorySelect.value;
    var amount = parseFloat(transactionAmountValue);
    var comment = transactionCommentInput.value.trim();

    if (!dateOnly || !categoryId || isNaN(amount) || !isFinite(amount)) {
        transactionErrorEl.textContent = "A date, category, and a positive numeric amount are required.";
        return;
    }

    var datetime = dateOnly + "T" + pad2(transactionTimeOfDay.hours) + ":" + pad2(transactionTimeOfDay.minutes);

    if (editingTransactionId) {
        var existing = state.transactions.filter(function (t) { return t.id === editingTransactionId; })[0];
        existing.datetime = datetime;
        existing.categoryId = categoryId;
        existing.amount = amount;
        existing.comment = comment;
    } else {
        state.transactions.push({
            id: generateId("txn"),
            datetime: datetime,
            categoryId: categoryId,
            amount: amount,
            comment: comment
        });
    }
    if (saveTransactions()) {
        showToast(editingTransactionId ? "Transaction updated" : "Transaction added");
    }

    transactionReturnTo();
}

function openTransactionDeleteConfirmModal() {
    openModal(transactionDeleteConfirmModal);
}

function deleteCurrentTransaction() {
    state.transactions = state.transactions.filter(function (t) { return t.id !== editingTransactionId; });
    if (saveTransactions()) {
        showToast("Transaction deleted");
    }

    closeModals();
    transactionReturnTo();
}

function cancelTransaction() {
    transactionReturnTo();
}
