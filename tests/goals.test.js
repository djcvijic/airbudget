function seededForGoals(overrides) {
    var state = {
        period: "monthly",
        currency: "USD",
        categories: [baseCategory({ id: "cat-groceries", emoji: "🛒", name: "Groceries", type: "expense", max: 200 })]
    };
    for (var key in overrides) {
        state[key] = overrides[key];
    }
    return state;
}

suite("goals screen", function () {
    test("opens with the currency label and any existing goal prefilled", async function () {
        var win = await freshApp(seededForGoals({ goalAmount: 500, goalSetDate: "2026-01-15" }));
        win.document.getElementById("open-goals-button").click();

        assertTrue(isActive(win.goalsScreen));
        assertEqual(win.goalsCurrencyLabel.textContent, "USD");
        assertEqual(win.goalsAmountInput.value, "500");
        assertEqual(win.goalsLastSetEl.textContent, "Last set on: " + win.formatDatePart(win.parseDateOnly("2026-01-15"), true));
        assertNotEqual(win.goalsCancelButton.style.display, "none");
        assertNotEqual(win.goalsDoneButton.style.display, "none");
        assertTrue(win.goalsDoneButton.disabled);
    });

    test("opens with no goal set yet showing an empty field and no last-set line", async function () {
        var win = await freshApp(seededForGoals());
        win.document.getElementById("open-goals-button").click();

        assertEqual(win.goalsAmountInput.value, "");
        assertEqual(win.goalsLastSetEl.textContent, "");
        assertEqual(win.goalsResultsEl.style.display, "none");
    });

    test("editing the amount enables Apply and hides the last-set line", async function () {
        var win = await freshApp(seededForGoals({ goalAmount: 500, goalSetDate: "2026-01-15" }));
        win.document.getElementById("open-goals-button").click();

        setValue(win.goalsAmountInput, "750");

        assertFalse(win.goalsDoneButton.disabled);
        assertEqual(win.goalsLastSetEl.textContent, "");
    });

    test("applying saves the goal, dates it today, and shows a confirmation toast", async function () {
        var win = await freshApp(seededForGoals());
        win.document.getElementById("open-goals-button").click();
        setValue(win.goalsAmountInput, "1200");

        win.goalsDoneButton.click();

        assertEqual(win.state.goalAmount, 1200);
        assertEqual(win.state.goalSetDate, win.formatDateOnly(new Date()));
        assertEqual(win.toastEl.textContent, "Goal saved");
        assertTrue(win.goalsDoneButton.disabled, "back to a clean, disabled Apply after applying");
        assertTrue(win.goalsLastSetEl.textContent.length > 0);
    });

    test("applying with a blank amount clears the goal", async function () {
        var win = await freshApp(seededForGoals({ goalAmount: 500, goalSetDate: "2026-01-15" }));
        win.document.getElementById("open-goals-button").click();
        setValue(win.goalsAmountInput, "");

        win.goalsDoneButton.click();

        assertEqual(win.state.goalAmount, null);
        assertEqual(win.state.goalSetDate, win.formatDateOnly(new Date()));
    });

    test("a negative amount is rejected", async function () {
        var win = await freshApp(seededForGoals());
        win.document.getElementById("open-goals-button").click();
        setValue(win.goalsAmountInput, "-5");

        win.goalsDoneButton.click();

        assertTrue(win.goalsErrorEl.textContent.length > 0);
        assertEqual(win.state.goalAmount, null);
    });

    test("a storage failure while applying shows an error instead of a false success", async function () {
        var win = await freshApp(seededForGoals());
        win.document.getElementById("open-goals-button").click();
        setValue(win.goalsAmountInput, "1200");

        var originalSetItem = win.localStorage.setItem;
        win.localStorage.setItem = function () { throw new Error("quota"); };

        win.goalsDoneButton.click();

        win.localStorage.setItem = originalSetItem;

        assertEqual(win.toastEl.textContent, "Couldn't save — storage is full");
    });

    test("clicking Cancel with unsaved changes shows a warning instead of discarding immediately", async function () {
        var win = await freshApp(seededForGoals({ goalAmount: 500, goalSetDate: "2026-01-15" }));
        win.document.getElementById("open-goals-button").click();
        setValue(win.goalsAmountInput, "999");

        win.goalsCancelButton.click();

        assertTrue(isActive(win.goalsScreen), "navigation is blocked until the warning is resolved");
        assertFalse(isHidden(win.goalsUnsavedModal));
    });

    test("leaving with unsaved changes opens a warning modal", async function () {
        var win = await freshApp(seededForGoals());
        win.document.getElementById("open-goals-button").click();
        setValue(win.goalsAmountInput, "1200");

        win.document.getElementById("open-home-button").click();

        assertTrue(isActive(win.goalsScreen), "navigation is blocked until the warning is resolved");
        assertFalse(isHidden(win.goalsUnsavedModal));
    });

    test("discarding from the warning modal drops the edit and continues the navigation", async function () {
        var win = await freshApp(seededForGoals());
        win.document.getElementById("open-goals-button").click();
        setValue(win.goalsAmountInput, "1200");
        win.document.getElementById("open-home-button").click();

        win.document.getElementById("goals-unsaved-discard-button").click();

        assertTrue(isActive(win.mainViewScreen));
        assertEqual(win.state.goalAmount, null);
    });

    test("backing out of the warning modal keeps the edit and stays on the screen", async function () {
        var win = await freshApp(seededForGoals());
        win.document.getElementById("open-goals-button").click();
        setValue(win.goalsAmountInput, "1200");
        win.document.getElementById("open-home-button").click();

        win.document.getElementById("goals-unsaved-back-button").click();

        assertTrue(isActive(win.goalsScreen));
        assertTrue(isHidden(win.goalsUnsavedModal));
        assertEqual(win.goalsAmountInput.value, "1200");
    });

    test("navigating away with no changes skips the warning", async function () {
        var win = await freshApp(seededForGoals());
        win.document.getElementById("open-goals-button").click();

        win.document.getElementById("open-home-button").click();

        assertTrue(isActive(win.mainViewScreen));
        assertTrue(isHidden(win.goalsUnsavedModal));
    });

    test("clicking Cancel with no changes navigates back with no warning", async function () {
        var win = await freshApp(seededForGoals());
        win.document.getElementById("open-goals-button").click();

        win.goalsCancelButton.click();

        assertTrue(isActive(win.mainViewScreen));
        assertTrue(isHidden(win.goalsUnsavedModal));
    });
});

function seededForGoalsResults(overrides) {
    var state = seededForGoals({
        period: "weekly",
        categories: [
            baseCategory({ id: "salary", type: "income", max: 3000 }),
            baseCategory({ id: "rent", type: "expense", max: 1000 }),
            baseCategory({ id: "groceries", type: "expense", max: 500 })
        ],
        goalAmount: null,
        goalSetDate: null
    });
    for (var key in overrides) {
        state[key] = overrides[key];
    }
    return state;
}

suite("goals screen: duration/date preview", function () {
    test("previews the duration and target date as the amount is typed", async function () {
        var win = await freshApp(seededForGoalsResults());
        win.document.getElementById("open-goals-button").click();

        setValue(win.goalsAmountInput, "11000");

        assertEqual(win.goalsDurationOutputEl.textContent, "8 weeks");
        var expectedDate = win.addPeriodsToDate(win.startOfDay(new Date()), "weekly", 8);
        assertEqual(win.goalsDateOutputEl.textContent, win.formatDatePart(expectedDate, true));
    });

    test("uses singular wording for exactly one period", async function () {
        var win = await freshApp(seededForGoalsResults());
        win.document.getElementById("open-goals-button").click();

        setValue(win.goalsAmountInput, "1200");

        assertEqual(win.goalsDurationOutputEl.textContent, "1 week");
    });

    test("replaces the results with a message when budgets leave no expected savings", async function () {
        var win = await freshApp(seededForGoals({
            period: "weekly",
            categories: [baseCategory({ id: "rent", type: "expense", max: 1000 })]
        }));
        win.document.getElementById("open-goals-button").click();

        setValue(win.goalsAmountInput, "5000");

        assertEqual(win.goalsResultsEl.style.display, "none");
        assertNotEqual(win.goalsNoSavingsMessageEl.style.display, "none");
    });

    test("results reappear once the amount no longer produces a no-savings message", async function () {
        var win = await freshApp(seededForGoalsResults());
        win.document.getElementById("open-goals-button").click();

        setValue(win.goalsAmountInput, "11000");

        assertNotEqual(win.goalsResultsEl.style.display, "none");
        assertEqual(win.goalsNoSavingsMessageEl.style.display, "none");
    });

    test("an empty amount hides the results", async function () {
        var win = await freshApp(seededForGoalsResults());
        win.document.getElementById("open-goals-button").click();

        setValue(win.goalsAmountInput, "500");
        setValue(win.goalsAmountInput, "");

        assertEqual(win.goalsResultsEl.style.display, "none");
        assertEqual(win.goalsDurationOutputEl.textContent, "");
        assertEqual(win.goalsDateOutputEl.textContent, "");
    });

    test("a zero amount hides the results", async function () {
        var win = await freshApp(seededForGoalsResults());
        win.document.getElementById("open-goals-button").click();

        setValue(win.goalsAmountInput, "0");

        assertEqual(win.goalsResultsEl.style.display, "none");
        assertEqual(win.goalsNoSavingsMessageEl.style.display, "none");
    });

    test("the target date is anchored to the last applied set-date, not today, while previewing a new amount", async function () {
        var win = await freshApp(seededForGoalsResults({ goalAmount: 300, goalSetDate: "2026-01-01" }));
        win.document.getElementById("open-goals-button").click();

        setValue(win.goalsAmountInput, "1500");

        var expectedDate = win.addPeriodsToDate(win.parseDateOnly("2026-01-01"), "weekly", 1);
        assertEqual(win.goalsDateOutputEl.textContent, win.formatDatePart(expectedDate, true));
    });
});
