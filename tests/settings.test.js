function seededForSettings() {
    return {
        period: "monthly",
        currency: "USD",
        categories: [baseCategory({ id: "cat-groceries", emoji: "🛒", name: "Groceries", type: "expense", max: 200 })]
    };
}

suite("settings screen", function () {
    test("opens preselected to the current period and currency", async function () {
        var win = await freshApp(seededForSettings());
        win.document.getElementById("open-settings-button").click();

        assertTrue(isActive(win.settingsScreen));
        assertEqual(win.settingsPeriodOptionsEl.querySelector("input:checked").value, "monthly");
        assertEqual(win.settingsCurrencySelect.value, "USD");
    });

    test("unapplied changes trigger a warning when leaving", async function () {
        var win = await freshApp(seededForSettings());
        win.document.getElementById("open-settings-button").click();
        setValue(win.settingsCurrencySelect, "EUR");

        win.document.getElementById("settings-back-button").click();

        assertFalse(isHidden(win.settingsUnsavedModal));
    });

    test("reverting the warning discards the change", async function () {
        var win = await freshApp(seededForSettings());
        win.document.getElementById("open-settings-button").click();
        setValue(win.settingsCurrencySelect, "EUR");
        win.document.getElementById("settings-back-button").click();

        win.document.getElementById("settings-unsaved-revert-button").click();

        assertTrue(isActive(win.mainViewScreen));
        assertEqual(win.state.currency, "USD");
    });

    test("applying saves the new period and currency", async function () {
        var win = await freshApp(seededForSettings());
        win.document.getElementById("open-settings-button").click();

        var weeklyRadio = win.settingsPeriodOptionsEl.querySelector('input[value="weekly"]');
        weeklyRadio.checked = true;
        weeklyRadio.dispatchEvent(new Event("change", { bubbles: true }));
        setValue(win.settingsCurrencySelect, "GBP");

        win.document.getElementById("settings-apply-button").click();

        assertTrue(isActive(win.mainViewScreen));
        assertEqual(win.state.period, "weekly");
        assertEqual(win.state.currency, "GBP");

        var tile = win.categoryGridEl.querySelector(".category-tile-amount-currency");
        assertEqual(tile.textContent, "GBP");
    });

    test("navigating away with no changes skips the warning", async function () {
        var win = await freshApp(seededForSettings());
        win.document.getElementById("open-settings-button").click();
        win.document.getElementById("settings-back-button").click();

        assertTrue(isActive(win.mainViewScreen));
        assertTrue(isHidden(win.settingsUnsavedModal));
    });

    test("releasing the delete-hold button early cancels the deletion", async function () {
        var win = await freshApp(seededForSettings());
        win.document.getElementById("open-settings-button").click();
        win.document.getElementById("delete-data-button").click();
        assertFalse(isHidden(win.deleteConfirmModal));

        win.deleteConfirmButton.dispatchEvent(new MouseEvent("mousedown"));
        await wait(300);
        win.deleteConfirmButton.dispatchEvent(new MouseEvent("mouseup"));
        await wait(win.DELETE_HOLD_MS + 200);

        assertEqual(win.state.categories.length, 1, "data must survive a cancelled hold");
    });

    test("holding delete for the full duration erases all data", async function () {
        var win = await freshApp(seededForSettings());
        win.document.getElementById("open-settings-button").click();
        win.document.getElementById("delete-data-button").click();

        win.deleteConfirmButton.dispatchEvent(new MouseEvent("mousedown"));
        await wait(win.DELETE_HOLD_MS + 200);

        assertEqual(win.state.categories.length, 0);
        assertEqual(win.state.period, null);
        assertTrue(isActive(win.onboardingScreen), "boot() re-runs onboarding once data is gone");
    });
});
