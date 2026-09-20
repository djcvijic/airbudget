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

    test("opens clean: Cancel and Apply are both shown, Apply disabled", async function () {
        var win = await freshApp(seededForSettings());
        win.document.getElementById("open-settings-button").click();

        assertNotEqual(win.settingsCancelButton.style.display, "none");
        assertNotEqual(win.settingsApplyButton.style.display, "none");
        assertTrue(win.settingsApplyButton.disabled);
    });

    test("changing a value enables Apply", async function () {
        var win = await freshApp(seededForSettings());
        win.document.getElementById("open-settings-button").click();
        setValue(win.settingsCurrencySelect, "EUR");

        assertFalse(win.settingsApplyButton.disabled);
    });

    test("unapplied changes trigger a warning when leaving", async function () {
        var win = await freshApp(seededForSettings());
        win.document.getElementById("open-settings-button").click();
        setValue(win.settingsCurrencySelect, "EUR");

        win.document.getElementById("settings-back-button").click();

        assertFalse(isHidden(win.settingsUnsavedModal));
    });

    test("discarding from the warning modal discards the change", async function () {
        var win = await freshApp(seededForSettings());
        win.document.getElementById("open-settings-button").click();
        setValue(win.settingsCurrencySelect, "EUR");
        win.document.getElementById("settings-back-button").click();

        win.document.getElementById("settings-unsaved-discard-button").click();

        assertTrue(isActive(win.mainViewScreen));
        assertEqual(win.state.currency, "USD");
    });

    test("backing out of the warning modal keeps the edit and stays on the screen", async function () {
        var win = await freshApp(seededForSettings());
        win.document.getElementById("open-settings-button").click();
        setValue(win.settingsCurrencySelect, "EUR");
        win.document.getElementById("settings-back-button").click();

        win.document.getElementById("settings-unsaved-back-button").click();

        assertTrue(isActive(win.settingsScreen));
        assertTrue(isHidden(win.settingsUnsavedModal));
        assertEqual(win.settingsCurrencySelect.value, "EUR");
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

    test("clicking Cancel with no changes navigates back with no warning", async function () {
        var win = await freshApp(seededForSettings());
        win.document.getElementById("open-settings-button").click();

        win.settingsCancelButton.click();

        assertTrue(isActive(win.mainViewScreen));
        assertTrue(isHidden(win.settingsUnsavedModal));
    });

    test("clicking Cancel with unsaved changes shows a warning instead of discarding immediately", async function () {
        var win = await freshApp(seededForSettings());
        win.document.getElementById("open-settings-button").click();
        setValue(win.settingsCurrencySelect, "EUR");

        win.settingsCancelButton.click();

        assertTrue(isActive(win.settingsScreen), "navigation is blocked until the warning is resolved");
        assertFalse(isHidden(win.settingsUnsavedModal));
    });

    test("navigating away with no changes skips the warning", async function () {
        var win = await freshApp(seededForSettings());
        win.document.getElementById("open-settings-button").click();
        win.document.getElementById("settings-back-button").click();

        assertTrue(isActive(win.mainViewScreen));
        assertTrue(isHidden(win.settingsUnsavedModal));
    });

    test("export produces a JSON file with the whole state", async function () {
        var win = await freshApp(seededForSettings());
        win.document.getElementById("open-settings-button").click();

        var capturedBlob = null;
        var capturedDownload = null;
        var originalCreate = win.URL.createObjectURL;
        var originalClick = win.HTMLAnchorElement.prototype.click;
        win.URL.createObjectURL = function (blob) { capturedBlob = blob; return "blob:captured"; };
        win.HTMLAnchorElement.prototype.click = function () { capturedDownload = this.download; };

        win.exportData();

        win.URL.createObjectURL = originalCreate;
        win.HTMLAnchorElement.prototype.click = originalClick;

        var text = await capturedBlob.text();
        var content = JSON.parse(text);
        assertTrue(/^airbudget-\d{4}-\d{2}-\d{2}\.json$/.test(capturedDownload), "expected a dated filename, got: " + capturedDownload);
        assertEqual(content.currency, "USD");
        assertEqual(content.categories.length, 1);
    });

    test("importing a file overwrites the whole state and reboots", async function () {
        var win = await freshApp(seededForSettings());
        win.document.getElementById("open-settings-button").click();

        var payload = {
            period: "weekly",
            currency: "EUR",
            categories: [baseCategory({ id: "imported-cat", name: "Imported" })],
            transactions: [],
            detailMode: "category"
        };
        var file = new win.File([JSON.stringify(payload)], "backup.json", { type: "application/json" });
        var dataTransfer = new win.DataTransfer();
        dataTransfer.items.add(file);
        win.importFileInput.files = dataTransfer.files;
        win.importFileInput.dispatchEvent(new win.Event("change", { bubbles: true }));
        await wait(50);

        assertEqual(win.state.period, "weekly");
        assertEqual(win.state.currency, "EUR");
        assertEqual(win.state.categories[0].id, "imported-cat");
        assertTrue(isActive(win.mainViewScreen));
    });

    test("a round trip through export and import preserves goal and report-seen state", async function () {
        var seeded = seededForSettings();
        seeded.goalAmount = 5000;
        seeded.goalSetDate = "2026-01-01";
        seeded.lastSeenReport = "2026-01-31T23:59:59";
        var win = await freshApp(seeded);
        win.document.getElementById("open-settings-button").click();

        var capturedBlob = null;
        var originalCreate = win.URL.createObjectURL;
        var originalClick = win.HTMLAnchorElement.prototype.click;
        win.URL.createObjectURL = function (blob) { capturedBlob = blob; return "blob:captured"; };
        win.HTMLAnchorElement.prototype.click = function () { };
        win.exportData();
        win.URL.createObjectURL = originalCreate;
        win.HTMLAnchorElement.prototype.click = originalClick;
        var exported = await capturedBlob.text();

        var file = new win.File([exported], "backup.json", { type: "application/json" });
        var dataTransfer = new win.DataTransfer();
        dataTransfer.items.add(file);
        win.importFileInput.files = dataTransfer.files;
        win.importFileInput.dispatchEvent(new win.Event("change", { bubbles: true }));
        await wait(50);

        assertEqual(win.state.goalAmount, 5000);
        assertEqual(win.state.goalSetDate, "2026-01-01");
        assertEqual(win.state.lastSeenReport, "2026-01-31T23:59:59");
    });

    test("importing invalid JSON shows an error and leaves state untouched", async function () {
        var win = await freshApp(seededForSettings());
        win.document.getElementById("open-settings-button").click();
        var before = JSON.stringify(win.state);

        var file = new win.File(["not json"], "garbage.json", { type: "application/json" });
        var dataTransfer = new win.DataTransfer();
        dataTransfer.items.add(file);
        win.importFileInput.files = dataTransfer.files;
        win.importFileInput.dispatchEvent(new win.Event("change", { bubbles: true }));
        await wait(50);

        assertEqual(JSON.stringify(win.state), before);
        assertTrue(isActive(win.settingsScreen), "an invalid import must not navigate away");
    });

    test("clicking delete erases all data (instant in test mode)", async function () {
        var win = await freshApp(seededForSettings());
        win.document.getElementById("open-settings-button").click();
        win.document.getElementById("delete-data-button").click();

        win.deleteConfirmButton.dispatchEvent(new MouseEvent("mousedown"));

        assertEqual(win.state.categories.length, 0);
        assertEqual(win.state.period, null);
        assertTrue(isActive(win.onboardingScreen), "boot() re-runs onboarding once data is gone");
        assertEqual(win.toastEl.textContent, "All data deleted");
    });

    test("a storage failure during delete-all shows an error and leaves the data intact", async function () {
        var win = await freshApp(seededForSettings());
        win.document.getElementById("open-settings-button").click();
        win.document.getElementById("delete-data-button").click();

        var originalRemoveItem = win.localStorage.removeItem;
        win.localStorage.removeItem = function () { throw new Error("blocked"); };

        win.deleteConfirmButton.dispatchEvent(new MouseEvent("mousedown"));

        win.localStorage.removeItem = originalRemoveItem;

        assertEqual(win.state.categories.length, 1, "data must survive a failed deletion");
        assertFalse(isActive(win.onboardingScreen), "boot() must not run when deletion failed");
        assertEqual(win.toastEl.textContent, "Couldn't delete — try again");
    });

    test("applying settings shows a confirmation toast", async function () {
        var win = await freshApp(seededForSettings());
        win.document.getElementById("open-settings-button").click();
        setValue(win.settingsCurrencySelect, "EUR");

        win.document.getElementById("settings-apply-button").click();

        assertEqual(win.toastEl.textContent, "Settings saved");
    });

    test("a storage failure while applying settings shows an error instead of a false success", async function () {
        var win = await freshApp(seededForSettings());
        win.document.getElementById("open-settings-button").click();
        setValue(win.settingsCurrencySelect, "EUR");

        var originalSetItem = win.localStorage.setItem;
        win.localStorage.setItem = function () { throw new Error("quota"); };

        win.document.getElementById("settings-apply-button").click();

        win.localStorage.setItem = originalSetItem;

        assertEqual(win.toastEl.textContent, "Couldn't save — storage is full");
    });
});
