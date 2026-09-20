suite("onboarding flow", function () {
    test("fresh install boots straight into onboarding with no bottom nav", async function () {
        var win = await freshApp(null);
        assertTrue(isActive(win.onboardingScreen), "onboarding screen should be active");
        assertEqual(win.bottomNavEl.style.display, "none");
        assertTrue(win.document.body.classList.contains("no-bottom-nav"));
    });

    test("continuing without a chosen period shows an error and stays put", async function () {
        var win = await freshApp(null);
        var radios = win.onboardingPeriodOptionsEl.querySelectorAll("input");
        radios.forEach(function (r) { r.checked = false; });

        win.document.getElementById("onboarding-continue-button").click();

        assertTrue(win.onboardingErrorEl.textContent.length > 0);
        assertTrue(isActive(win.onboardingScreen));
    });

    test("period + currency -> forced categories -> forced goals -> dashboard", async function () {
        var win = await freshApp(null);

        var weeklyRadio = win.onboardingPeriodOptionsEl.querySelector('input[value="weekly"]');
        weeklyRadio.checked = true;
        weeklyRadio.dispatchEvent(new Event("change", { bubbles: true }));
        setValue(win.onboardingCurrencySelect, "EUR");

        win.document.getElementById("onboarding-continue-button").click();

        assertTrue(isActive(win.categoriesScreen), "categories screen should open, forced");
        assertEqual(win.categoriesBackButton.style.display, "none");
        assertNotEqual(win.categoriesOnboardingBackButton.style.display, "none");
        assertEqual(win.categoriesDoneButton.textContent, "Next");
        assertEqual(win.state.period, "weekly");
        assertEqual(win.state.currency, "EUR");

        win.document.getElementById("add-category-button").click();
        var row = win.categoryRowsEl.querySelector(".category-row");
        setValue(row.querySelector(".category-row-emoji"), "🛒");
        setValue(row.querySelector(".category-row-name"), "Groceries");

        win.categoriesDoneButton.click();

        assertFalse(win.toastEl.classList.contains("visible"), "no confirmation toast when finishing an onboarding step");
        assertTrue(isActive(win.goalsScreen), "goals screen should open next, forced");
        assertEqual(win.goalsBackButton.style.display, "none");
        assertNotEqual(win.goalsOnboardingBackButton.style.display, "none");
        assertEqual(win.goalsDoneButton.textContent, "Done");
        assertEqual(win.bottomNavEl.style.display, "none", "bottom nav stays hidden through the 3rd onboarding step too");
        assertEqual(win.state.categories.length, 1);
        assertEqual(win.state.categories[0].name, "Groceries");

        win.goalsDoneButton.click();

        assertTrue(isActive(win.mainViewScreen), "dashboard should open after onboarding completes");
        assertEqual(win.bottomNavEl.style.display, "", "bottom nav reappears once onboarding is complete");
    });

    test("backing out of forced categories returns to onboarding and preserves the draft", async function () {
        var win = await freshApp(null);

        win.document.getElementById("onboarding-continue-button").click();
        assertTrue(isActive(win.categoriesScreen));

        win.document.getElementById("add-category-button").click();
        var row = win.categoryRowsEl.querySelector(".category-row");
        setValue(row.querySelector(".category-row-emoji"), "🎬");
        setValue(row.querySelector(".category-row-name"), "Movies");

        win.categoriesOnboardingBackButton.click();
        assertTrue(isActive(win.onboardingScreen), "back button returns to onboarding step 1");
        assertEqual(win.onboardingPeriodOptionsEl.querySelector("input:checked").value, "monthly");

        win.document.getElementById("onboarding-continue-button").click();
        assertTrue(isActive(win.categoriesScreen));

        var restoredRow = win.categoryRowsEl.querySelector(".category-row");
        assertEqual(restoredRow.querySelector(".category-row-emoji").value, "🎬");
        assertEqual(restoredRow.querySelector(".category-row-name").value, "Movies");
    });

    test("applying with no categories at all shows an error", async function () {
        var win = await freshApp(null);
        win.document.getElementById("onboarding-continue-button").click();
        assertEqual(win.categoryRowsEl.querySelectorAll(".category-row").length, 0);

        win.categoriesDoneButton.click();

        assertTrue(win.categoriesErrorEl.textContent.length > 0);
        assertTrue(isActive(win.categoriesScreen));
    });

    test("auto-create stays used after a round trip through goals onboarding", async function () {
        var win = await freshApp(null);
        win.document.getElementById("onboarding-continue-button").click();
        win.document.getElementById("categories-auto-create-button").click();
        assertEqual(win.categoriesAutoCreateButton.style.display, "none");

        win.categoriesDoneButton.click();
        assertTrue(isActive(win.goalsScreen));

        win.goalsOnboardingBackButton.click();
        assertTrue(isActive(win.categoriesScreen));
        assertEqual(win.categoriesAutoCreateButton.style.display, "none", "auto-create must not reappear after returning from goals");
        assertTrue(win.categoryRowsEl.querySelectorAll(".category-row").length > 1, "the auto-created rows are still there too");
    });

    test("an unapplied goal amount survives a round trip back to categories onboarding", async function () {
        var win = await freshApp(null);
        win.document.getElementById("onboarding-continue-button").click();
        win.document.getElementById("add-category-button").click();
        var row = win.categoryRowsEl.querySelector(".category-row");
        setValue(row.querySelector(".category-row-emoji"), "🛒");
        setValue(row.querySelector(".category-row-name"), "Groceries");
        win.categoriesDoneButton.click();
        assertTrue(isActive(win.goalsScreen));

        setValue(win.goalsAmountInput, "2500");
        win.goalsOnboardingBackButton.click();
        assertTrue(isActive(win.categoriesScreen));
        assertEqual(win.state.goalAmount, null, "nothing is applied yet");

        win.categoriesDoneButton.click();
        assertTrue(isActive(win.goalsScreen));
        assertEqual(win.goalsAmountInput.value, "2500", "the unapplied goal amount is preserved");
    });

    test("the import button opens the same file picker as settings", async function () {
        var win = await freshApp(null);
        var clicked = false;
        win.importFileInput.click = function () { clicked = true; };

        win.document.getElementById("onboarding-import-button").click();

        assertTrue(clicked);
    });
});
