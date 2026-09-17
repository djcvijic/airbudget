// Settings screen: period + currency (reopened later from the dashboard to
// change either), plus the "delete my data" confirm modal. The period +
// currency picker itself (PERIODS, buildPeriodOptions, buildCurrencyOptions)
// is shared with the onboarding screen (onboarding.js), which is why the
// builders take a target container/select instead of assuming the settings
// screen's own elements. Calls goToMainView()/boot() only inside a
// function body, so those files just need to load before a click happens,
// not before this file parses.

var PERIODS = [
    { value: "daily", label: "Daily" },
    { value: "weekly", label: "Weekly" },
    { value: "monthly", label: "Monthly" },
    { value: "yearly", label: "Yearly" }
];

var settingsScreen = document.getElementById("settings-screen");
var settingsPeriodOptionsEl = document.getElementById("settings-period-options");
var settingsCurrencySelect = document.getElementById("settings-currency-select");
var settingsErrorEl = document.getElementById("settings-error");
var settingsRevertButton = document.getElementById("settings-revert-button");
var settingsApplyButton = document.getElementById("settings-apply-button");
var settingsCloseButton = document.getElementById("settings-close-button");
var settingsUnsavedModal = document.getElementById("settings-unsaved-modal");
var importFileInput = document.getElementById("import-file-input");
var deleteDataButton = document.getElementById("delete-data-button");
var deleteConfirmModal = document.getElementById("delete-confirm-modal");
var deleteConfirmButton = document.getElementById("delete-confirm-button");

var settingsOriginalPeriod = null;
var settingsOriginalCurrency = null;
var pendingSettingsNavigation = null;

var DELETE_HOLD_MS = 2000;
var deleteHoldTimer = null;

function updatePeriodSelection(containerEl) {
    var labels = containerEl.querySelectorAll(".settings-period-option");
    labels.forEach(function (label) {
        var input = label.querySelector("input");
        label.classList.toggle("selected", input.checked);
    });
}

// Shared by this screen and onboarding.js: checks the radio matching period,
// then refreshes the visible highlight to match.
function selectPeriodOption(containerEl, period) {
    var radios = containerEl.querySelectorAll("input");
    radios.forEach(function (input) {
        input.checked = input.value === period;
    });
    updatePeriodSelection(containerEl);
}

function buildPeriodOptions(containerEl) {
    PERIODS.forEach(function (period) {
        var label = document.createElement("label");
        label.className = "settings-period-option";

        var input = document.createElement("input");
        input.type = "radio";
        input.name = containerEl.id;
        input.value = period.value;
        input.addEventListener("change", function () {
            updatePeriodSelection(containerEl);
        });

        var span = document.createElement("span");
        span.textContent = period.label;

        label.appendChild(input);
        label.appendChild(span);
        containerEl.appendChild(label);
    });
}

function buildCurrencyOptions(selectEl) {
    CURRENCIES.forEach(function (currency) {
        var option = document.createElement("option");
        option.value = currency.code;
        option.textContent = currency.code + " - " + currency.name;
        selectEl.appendChild(option);
    });
}

buildPeriodOptions(settingsPeriodOptionsEl);
buildCurrencyOptions(settingsCurrencySelect);

settingsScreen.addEventListener("change", updateSettingsActionButtons);

function openSettingsScreen() {
    settingsErrorEl.textContent = "";

    selectPeriodOption(settingsPeriodOptionsEl, state.period);

    settingsCurrencySelect.value = state.currency;

    settingsOriginalPeriod = state.period;
    settingsOriginalCurrency = state.currency;
    updateSettingsActionButtons();

    showScreen(settingsScreen);
}

function hasUnsavedSettingsChanges() {
    var selectedInput = settingsPeriodOptionsEl.querySelector("input:checked");
    var selectedPeriod = selectedInput ? selectedInput.value : null;
    return selectedPeriod !== settingsOriginalPeriod
        || settingsCurrencySelect.value !== settingsOriginalCurrency;
}

function updateSettingsActionButtons() {
    var dirty = hasUnsavedSettingsChanges();
    settingsRevertButton.style.display = dirty ? "" : "none";
    settingsApplyButton.style.display = dirty ? "" : "none";
    settingsCloseButton.style.display = dirty ? "none" : "";
}

function resolvePendingSettingsNavigation() {
    var navigateFn = pendingSettingsNavigation || goToMainView;
    pendingSettingsNavigation = null;
    navigateFn();
}

function applySettings() {
    var selectedInput = settingsPeriodOptionsEl.querySelector("input:checked");
    if (!selectedInput) {
        settingsErrorEl.textContent = "Choose a period.";
        return;
    }

    state.period = selectedInput.value;
    state.currency = settingsCurrencySelect.value;
    if (saveMeta()) {
        showToast("Settings saved");
    }

    closeModals();
    resolvePendingSettingsNavigation();
}

function revertSettings() {
    closeModals();
    resolvePendingSettingsNavigation();
}

// Routes any attempt to leave the settings screen (the back button, or one
// of the top-bar nav buttons while settings is open) through the same
// unsaved-changes warning. navigateFn runs immediately when there's nothing
// to lose; otherwise it's stashed and only runs once Apply/Revert resolves
// the warning.
function goFromSettings(navigateFn) {
    if (!settingsScreen.classList.contains("active") || !hasUnsavedSettingsChanges()) {
        navigateFn();
        return;
    }
    pendingSettingsNavigation = navigateFn;
    openModal(settingsUnsavedModal);
}

function backFromSettings() {
    goFromSettings(goToMainView);
}

function openDeleteConfirmModal() {
    openModal(deleteConfirmModal);
}

function startDeleteHold() {
    deleteConfirmButton.classList.add("holding");
    deleteHoldTimer = setTimeout(function () {
        deleteConfirmButton.classList.remove("holding");
        // Guard against a stray fire after the modal was already dismissed
        // (close button, overlay click, Escape) while the hold was pending.
        if (deleteConfirmModal.classList.contains("hidden")) {
            return;
        }
        deleteAllData();
    }, DELETE_HOLD_MS);
}

function cancelDeleteHold() {
    clearTimeout(deleteHoldTimer);
    deleteConfirmButton.classList.remove("holding");
}

function deleteAllData() {
    try {
        localStorage.removeItem(META_KEY);
        localStorage.removeItem(CATEGORIES_KEY);
        localStorage.removeItem(TRANSACTIONS_KEY);
    } catch (e) {
        showToast("Couldn't delete — try again");
        return;
    }

    state = defaultState();
    periodOffset = 0;
    showToast("All data deleted");

    closeModals();
    boot();
}

function exportData() {
    var blob = new Blob([JSON.stringify(state)], { type: "application/json" });
    var url = URL.createObjectURL(blob);

    var link = document.createElement("a");
    link.href = url;
    link.download = "airbudget-" + formatDateOnly(new Date()) + ".json";
    link.click();

    URL.revokeObjectURL(url);
}

function openImportPicker() {
    importFileInput.click();
}

// Overwrites the whole app state with the picked file's contents, no
// merge — the file is expected to be a previous export() output.
function importData() {
    var file = importFileInput.files[0];
    importFileInput.value = "";
    if (!file) {
        return;
    }

    var reader = new FileReader();
    reader.onload = function () {
        var imported;
        try {
            imported = JSON.parse(reader.result);
        } catch (e) {
            showToast("That file isn't valid JSON");
            return;
        }

        if (!imported || !Array.isArray(imported.categories) || !Array.isArray(imported.transactions)) {
            showToast("That file doesn't look like an airbudget export");
            return;
        }

        state = {
            period: imported.period || null,
            currency: imported.currency || null,
            categories: imported.categories,
            transactions: imported.transactions,
            detailMode: imported.detailMode || "day"
        };
        saveMeta();
        saveCategories();
        saveTransactions();
        periodOffset = 0;

        boot();
        showToast("Data imported");
    };
    reader.onerror = function () {
        showToast("Couldn't read that file");
    };
    reader.readAsText(file);
}

importFileInput.addEventListener("change", importData);
