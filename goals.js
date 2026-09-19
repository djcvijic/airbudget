// Goals screen: an optional savings-goal amount, plus (once budgets are
// set up) an estimate of how long reaching it will take and when. Reopened
// from the dashboard like settings/categories; onboarding's 3rd step is
// this same screen, forced. Calls goToMainView()/openCategoriesScreen()
// only inside a function body, so those files just need to load before a
// click happens, not before this file parses.

var goalsScreen = document.getElementById("goals-screen");
var goalsBackButton = document.getElementById("goals-back-button");
var goalsOnboardingBackButton = document.getElementById("goals-onboarding-back-button");
var goalsTitleEl = document.getElementById("goals-title");
var goalsCurrencyLabel = document.getElementById("goals-currency-label");
var goalsAmountInput = document.getElementById("goals-amount-input");
var goalsLastSetEl = document.getElementById("goals-last-set");
var goalsResultsEl = document.getElementById("goals-results");
var goalsDurationOutputEl = document.getElementById("goals-duration-output");
var goalsDateOutputEl = document.getElementById("goals-date-output");
var goalsNoSavingsMessageEl = document.getElementById("goals-no-savings-message");
var goalsErrorEl = document.getElementById("goals-error");
var goalsCancelButton = document.getElementById("goals-cancel-button");
var goalsDoneButton = document.getElementById("goals-done-button");
var goalsUnsavedModal = document.getElementById("goals-unsaved-modal");

var goalsForced = false;
var goalsOriginalAmount = null;
var pendingGoalsNavigation = null;

var goalsDraft = createStepDraft();

function hasUnsavedGoalsChanges() {
    return goalsAmountInput.value !== goalsOriginalAmount;
}

// Mirrors categories.js's forced/reopened split.
function updateGoalsActionButtons() {
    if (goalsForced) {
        goalsCancelButton.style.display = "none";
        goalsDoneButton.style.display = "";
        goalsDoneButton.disabled = false;
        return;
    }
    goalsCancelButton.style.display = "";
    goalsDoneButton.style.display = "";
    goalsDoneButton.disabled = !hasUnsavedGoalsChanges();
}

// Hidden while the input is dirty, since it would otherwise describe a
// goal that's no longer what's shown; reappears (dated today) once applied.
function updateGoalsLastSet() {
    if (hasUnsavedGoalsChanges() || !state.goalSetDate) {
        goalsLastSetEl.textContent = "";
        return;
    }
    goalsLastSetEl.textContent = "Last set on: " + formatDatePart(parseDateOnly(state.goalSetDate), true);
}

var GOAL_PERIOD_UNIT_NAMES = { daily: "day", weekly: "week", monthly: "month", yearly: "year" };

function pluralize(count, singular) {
    return count + " " + singular + (count === 1 ? "" : "s");
}

// Adding calendar months/years can overflow a short month (Jan 31 + 1
// month isn't Mar 3) — clamp to the target month's last real day instead.
function addMonthsClamped(date, months) {
    var targetMonthFirst = new Date(date.getFullYear(), date.getMonth() + months, 1);
    var daysInTargetMonth = new Date(targetMonthFirst.getFullYear(), targetMonthFirst.getMonth() + 1, 0).getDate();
    var day = Math.min(date.getDate(), daysInTargetMonth);
    return new Date(targetMonthFirst.getFullYear(), targetMonthFirst.getMonth(), day);
}

function addPeriodsToDate(date, period, count) {
    if (period === "daily") {
        return new Date(date.getFullYear(), date.getMonth(), date.getDate() + count);
    }
    if (period === "weekly") {
        return new Date(date.getFullYear(), date.getMonth(), date.getDate() + count * 7);
    }
    if (period === "monthly") {
        return addMonthsClamped(date, count);
    }
    return addMonthsClamped(date, count * 12);
}

// Previews the typed amount live, but anchors the target date to the
// last applied set-date (or today), not to unsaved edits.
function updateGoalsResults() {
    goalsResultsEl.style.display = "none";
    goalsNoSavingsMessageEl.style.display = "none";

    var raw = goalsAmountInput.value;
    var goalAmount = raw === "" ? NaN : parseFloat(raw);
    if (isNaN(goalAmount) || goalAmount <= 0) {
        goalsDurationOutputEl.textContent = "";
        goalsDateOutputEl.textContent = "";
        return;
    }

    var expectedPeriodicIncome = getExpectedPeriodicIncome();
    if (expectedPeriodicIncome <= 0) {
        goalsNoSavingsMessageEl.style.display = "";
        return;
    }

    goalsResultsEl.style.display = "";
    var goalPeriodCount = Math.ceil(goalAmount / expectedPeriodicIncome);
    goalsDurationOutputEl.textContent = pluralize(goalPeriodCount, GOAL_PERIOD_UNIT_NAMES[state.period]);

    var baseDate = state.goalSetDate ? parseDateOnly(state.goalSetDate) : startOfDay(new Date());
    goalsDateOutputEl.textContent = formatDatePart(addPeriodsToDate(baseDate, state.period, goalPeriodCount), true);
}

function openGoalsScreen(forced) {
    goalsForced = forced;
    goalsErrorEl.textContent = "";
    goalsBackButton.style.display = forced ? "none" : "";
    goalsOnboardingBackButton.style.display = forced ? "" : "none";
    goalsTitleEl.classList.toggle("onboarding-heading", forced);
    goalsDoneButton.textContent = forced ? "Done" : "Apply";

    goalsCurrencyLabel.textContent = state.currency;
    var draftAmount = goalsDraft.get();
    if (forced && draftAmount != null) {
        goalsAmountInput.value = draftAmount;
    } else {
        goalsAmountInput.value = state.goalAmount != null ? state.goalAmount : "";
    }

    goalsOriginalAmount = goalsAmountInput.value;
    updateGoalsActionButtons();
    updateGoalsLastSet();
    updateGoalsResults();

    showScreen(goalsScreen);

    // showScreen() would show the top bar here (already onboarded by
    // step 3) — override it back off, like steps 1-2 get for free.
    if (forced) {
        topBarEl.style.display = "none";
        document.body.classList.add("no-top-bar");
    }
}

function applyGoals() {
    var raw = goalsAmountInput.value;
    var amount = raw === "" ? null : parseFloat(raw);
    if (raw !== "" && (isNaN(amount) || amount < 0)) {
        goalsErrorEl.textContent = "Amount must be 0 or greater, or left blank.";
        return;
    }

    state.goalAmount = amount;
    state.goalSetDate = formatDateOnly(new Date());
    if (saveMeta()) {
        showToast("Goal saved");
    }

    var wasForced = goalsForced;
    goalsForced = false;
    goalsDraft.clear();

    closeModals();
    if (wasForced) {
        goToMainView();
        return;
    }

    goalsOriginalAmount = goalsAmountInput.value;
    updateGoalsActionButtons();
    updateGoalsLastSet();
    updateGoalsResults();
    resolvePendingGoalsNavigation();
}

function resolvePendingGoalsNavigation() {
    var navigateFn = pendingGoalsNavigation || goToMainView;
    pendingGoalsNavigation = null;
    navigateFn();
}

function revertGoals() {
    goalsAmountInput.value = goalsOriginalAmount;
    goalsErrorEl.textContent = "";
    updateGoalsActionButtons();
    updateGoalsLastSet();
    updateGoalsResults();

    closeModals();
    resolvePendingGoalsNavigation();
}

// Same warn-before-leaving pattern as settings/categories; forced is never gated.
function goFromGoals(navigateFn) {
    if (!goalsScreen.classList.contains("active") || goalsForced || !hasUnsavedGoalsChanges()) {
        navigateFn();
        return;
    }
    pendingGoalsNavigation = navigateFn;
    openModal(goalsUnsavedModal);
}

function backFromGoals() {
    // Onboarding's own back button returns to the forced categories step
    // instead of the dashboard (which doesn't exist yet at that point),
    // and skips the unsaved-changes warning — same as the rest of onboarding.
    if (goalsForced) {
        goalsDraft.save(goalsAmountInput.value);
        openCategoriesScreen(true);
        return;
    }

    goFromGoals(goToMainView);
}

goalsAmountInput.addEventListener("input", function () {
    updateGoalsActionButtons();
    updateGoalsLastSet();
    updateGoalsResults();
});
