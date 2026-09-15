// Boot sequence and all event wiring. Loads last, after every other script.

function boot() {
    if (!state.period || !state.currency) {
        openOnboardingScreen();
    } else if (state.categories.length === 0) {
        openCategoriesScreen(true);
    } else {
        goToMainView();
    }
}

function main() {
    document.getElementById("onboarding-continue-button").addEventListener("click", applyOnboarding);

    document.getElementById("add-category-button").addEventListener("click", addCategoryRow);
    document.getElementById("categories-auto-create-button").addEventListener("click", createCategoriesAutomatically);
    document.getElementById("categories-back-button").addEventListener("click", backFromCategories);
    document.getElementById("categories-onboarding-back-button").addEventListener("click", backFromCategories);
    document.getElementById("categories-revert-button").addEventListener("click", revertCategories);
    document.getElementById("categories-done-button").addEventListener("click", applyCategories);
    document.getElementById("categories-close-button").addEventListener("click", backFromCategories);
    document.getElementById("categories-unsaved-apply-button").addEventListener("click", applyCategories);
    document.getElementById("categories-unsaved-revert-button").addEventListener("click", revertCategories);

    document.getElementById("period-prev-button").addEventListener("click", goToPreviousPeriod);
    document.getElementById("period-next-button").addEventListener("click", goToNextPeriod);
    document.getElementById("period-current-button").addEventListener("click", goToCurrentPeriod);

    document.getElementById("install-banner-action-button").addEventListener("click", installApp);
    document.getElementById("install-banner-dismiss-button").addEventListener("click", dismissInstallBanner);

    // Only one of settings/categories can be the active screen at a time,
    // so nesting these guards is safe: whichever one isn't active is a
    // no-op and just calls through to navigateFn.
    function goToScreen(navigateFn) {
        goFromSettings(function () {
            goFromCategories(navigateFn);
        });
    }

    document.getElementById("open-home-button").addEventListener("click", function () {
        goToScreen(goToMainView);
    });
    document.getElementById("open-transaction-button").addEventListener("click", function () {
        goToScreen(function () {
            openTransactionScreen();
        });
    });
    document.getElementById("transaction-back-button").addEventListener("click", cancelTransaction);
    document.getElementById("transaction-cancel-button").addEventListener("click", cancelTransaction);
    document.getElementById("open-settings-button").addEventListener("click", function () {
        goToScreen(openSettingsScreen);
    });
    document.getElementById("settings-back-button").addEventListener("click", backFromSettings);
    document.getElementById("settings-revert-button").addEventListener("click", revertSettings);
    document.getElementById("settings-unsaved-apply-button").addEventListener("click", applySettings);
    document.getElementById("settings-unsaved-revert-button").addEventListener("click", revertSettings);
    document.getElementById("open-categories-button").addEventListener("click", function () {
        goToScreen(function () {
            openCategoriesScreen(false);
        });
    });
    document.getElementById("open-detail-button").addEventListener("click", function () {
        goToScreen(function () {
            openDetailView();
        });
    });

    document.getElementById("detail-back-button").addEventListener("click", backFromDetail);
    detailModeButtons.forEach(function (button) {
        button.addEventListener("click", function () {
            setDetailMode(button.dataset.mode);
        });
    });

    document.getElementById("settings-apply-button").addEventListener("click", applySettings);
    document.getElementById("settings-close-button").addEventListener("click", backFromSettings);
    document.getElementById("transaction-apply-button").addEventListener("click", applyTransaction);

    document.getElementById("export-data-button").addEventListener("click", exportData);
    document.getElementById("import-data-button").addEventListener("click", openImportPicker);
    document.getElementById("delete-data-button").addEventListener("click", openDeleteConfirmModal);
    var deleteConfirmButtonEl = document.getElementById("delete-confirm-button");
    deleteConfirmButtonEl.addEventListener("mousedown", startDeleteHold);
    deleteConfirmButtonEl.addEventListener("touchstart", startDeleteHold);
    deleteConfirmButtonEl.addEventListener("mouseup", cancelDeleteHold);
    deleteConfirmButtonEl.addEventListener("mouseleave", cancelDeleteHold);
    deleteConfirmButtonEl.addEventListener("touchend", cancelDeleteHold);
    deleteConfirmButtonEl.addEventListener("contextmenu", function (e) {
        e.preventDefault();
    });

    function dismissModals() {
        pendingSettingsNavigation = null;
        pendingCategoriesNavigation = null;
        closeModals();
    }

    document.querySelectorAll(".modal-close").forEach(function (button) {
        button.addEventListener("click", dismissModals);
    });

    modalOverlay.addEventListener("click", function (e) {
        if (e.target === modalOverlay) {
            dismissModals();
        }
    });

    document.addEventListener("keydown", function (e) {
        if (e.altKey && e.metaKey && (e.code === "KeyR" || e.key.toLowerCase() === "r")) {
            e.preventDefault();
            fillRandomDebugData();
            return;
        }

        if (e.key === "Escape" && !modalOverlay.classList.contains("hidden")) {
            dismissModals();
        }
    });

    boot();
}

main();

// Skipped on localhost: the service worker is cache-first, so during local
// dev it would keep serving pre-edit files after every change instead of
// the fresh ones, unless CACHE_NAME is bumped on every single edit.
if (location.hostname !== "localhost" && "serviceWorker" in navigator) {
    window.addEventListener("load", function () {
        navigator.serviceWorker.register("sw.js");
    });
}

if (navigator.storage && navigator.storage.persist) {
    navigator.storage.persist();
}
