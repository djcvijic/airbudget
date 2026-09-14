// First-run onboarding screen: period + currency, explained rather than
// dropped in a modal. Distinct from the Settings modal (settings.js) even
// though it reuses the same picker builders, since onboarding has no
// existing data to protect and nothing to close back to. Calls
// openCategoriesScreen() only inside a function body, so categories.js just
// needs to load before Continue is clicked, not before this file parses.

var onboardingScreen = document.getElementById("onboarding-screen");
var onboardingPeriodOptionsEl = document.getElementById("onboarding-period-options");
var onboardingCurrencySelect = document.getElementById("onboarding-currency-select");
var onboardingErrorEl = document.getElementById("onboarding-error");

buildPeriodOptions(onboardingPeriodOptionsEl);
buildCurrencyOptions(onboardingCurrencySelect);

// Best-effort locale guess for the currency preselect: maximize() fills in
// a region even for a language-only tag like "en", then CURRENCY_BY_REGION
// maps that region onto the curated currency list. Falls back to USD.
function guessCurrencyFromLocale() {
    var lang = (navigator.languages && navigator.languages[0]) || navigator.language || "en-US";
    var region = null;

    try {
        var locale = new Intl.Locale(lang);
        region = (locale.maximize ? locale.maximize() : locale).region || null;
    } catch (e) {
        region = null;
    }

    if (!region) {
        var parts = lang.split("-");
        region = parts.length > 1 ? parts[parts.length - 1].toUpperCase() : null;
    }

    return (region && CURRENCY_BY_REGION[region]) || "USD";
}

// Preselects Monthly and a locale-guessed currency the first time this is
// reached; if the categories step's back button returns here, state.period
// and state.currency are already set from applyOnboarding, so those are
// shown instead of resetting the user's choice.
function openOnboardingScreen() {
    onboardingErrorEl.textContent = "";

    var periodToSelect = state.period || "monthly";
    selectPeriodOption(onboardingPeriodOptionsEl, periodToSelect);

    onboardingCurrencySelect.value = state.currency || guessCurrencyFromLocale();

    showScreen(onboardingScreen);
}

function applyOnboarding() {
    var selectedInput = onboardingPeriodOptionsEl.querySelector("input:checked");
    if (!selectedInput) {
        onboardingErrorEl.textContent = "Choose a period.";
        return;
    }

    state.period = selectedInput.value;
    state.currency = onboardingCurrencySelect.value;
    saveState();

    openCategoriesScreen(true);
}
