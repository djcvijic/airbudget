function seededTwoCategories() {
    return {
        period: "monthly",
        currency: "USD",
        categories: [
            baseCategory({ id: "cat-groceries", emoji: "🛒", name: "Groceries", type: "expense", max: 200 }),
            baseCategory({ id: "cat-salary", emoji: "💰", name: "Salary", type: "income", max: null })
        ]
    };
}

async function openReopenedCategories() {
    var win = await freshApp(seededTwoCategories());
    assertTrue(isActive(win.mainViewScreen), "should boot straight to the dashboard");
    win.document.getElementById("open-categories-button").click();
    assertTrue(isActive(win.categoriesScreen));
    return win;
}

suite("categories screen: reopened (non-forced) editing", function () {
    test("reopened screen shows Apply, Back, Revert, and no forced chrome", async function () {
        var win = await openReopenedCategories();
        assertEqual(win.categoriesDoneButton.textContent, "Apply");
        assertNotEqual(win.categoriesBackButton.style.display, "none");
        assertEqual(win.categoriesOnboardingBackButton.style.display, "none");
        assertNotEqual(win.categoriesRevertButton.style.display, "none");
    });

    test("existing categories get a visibility toggle, never a delete button", async function () {
        var win = await openReopenedCategories();
        var rows = win.categoryRowsEl.querySelectorAll(".category-row");
        rows.forEach(function (row) {
            assertTrue(row.dataset.id.length > 0);
            assertTrue(row.querySelector(".category-row-visibility") !== null);
            assertTrue(row.querySelector(".category-row-delete") === null);
        });
    });

    test("clearing a category's emoji blocks Apply with an error", async function () {
        var win = await openReopenedCategories();
        var row = win.categoryRowsEl.querySelector('.category-row[data-id="cat-groceries"]');
        setValue(row.querySelector(".category-row-emoji"), "");

        win.categoriesDoneButton.click();

        assertTrue(win.categoriesErrorEl.textContent.indexOf("emoji") !== -1);
        assertTrue(isActive(win.categoriesScreen));
    });

    test("a negative budget blocks Apply with an error", async function () {
        var win = await openReopenedCategories();
        var row = win.categoryRowsEl.querySelector('.category-row[data-id="cat-groceries"]');
        setValue(row.querySelector(".category-row-max"), "-5");

        win.categoriesDoneButton.click();

        assertTrue(win.categoriesErrorEl.textContent.indexOf("0 or greater") !== -1);
        assertTrue(isActive(win.categoriesScreen));
    });

    test("switching a row to income disables and clears its budget field", async function () {
        var win = await openReopenedCategories();
        var row = win.categoryRowsEl.querySelector('.category-row[data-id="cat-groceries"]');
        var maxInput = row.querySelector(".category-row-max");
        setValue(maxInput, "150");

        var incomeButton = [].filter.call(row.querySelectorAll(".category-row-type-option"), function (b) {
            return b.textContent === "Income";
        })[0];
        incomeButton.click();

        assertTrue(maxInput.disabled);
        assertEqual(maxInput.value, "");
        assertEqual(row.dataset.type, "income");
    });

    test("valid edits apply and persist to state", async function () {
        var win = await openReopenedCategories();
        var row = win.categoryRowsEl.querySelector('.category-row[data-id="cat-groceries"]');
        setValue(row.querySelector(".category-row-name"), "Food & Drink");

        win.categoriesDoneButton.click();

        assertTrue(isActive(win.mainViewScreen));
        var saved = win.state.categories.filter(function (c) { return c.id === "cat-groceries"; })[0];
        assertEqual(saved.name, "Food & Drink");
    });

    test("auto-create adds every template once, then hides itself", async function () {
        var win = await openReopenedCategories();
        var before = win.categoryRowsEl.querySelectorAll(".category-row").length;

        win.categoriesAutoCreateButton.click();
        var afterFirst = win.categoryRowsEl.querySelectorAll(".category-row").length;
        assertEqual(afterFirst, before + win.CATEGORY_TEMPLATES.length);
        assertEqual(win.categoriesAutoCreateButton.style.display, "none");

        win.categoriesAutoCreateButton.click();
        var afterSecond = win.categoryRowsEl.querySelectorAll(".category-row").length;
        assertEqual(afterSecond, afterFirst, "a hidden button click must not add rows again");
    });

    test("auto-create button goes from visible to hidden on click, in forced mode", async function () {
        var win = await freshApp(null);
        win.document.getElementById("onboarding-continue-button").click();
        assertNotEqual(win.categoriesAutoCreateButton.style.display, "none");

        win.categoriesAutoCreateButton.click();

        assertEqual(win.categoriesAutoCreateButton.style.display, "none");
    });

    test("leaving with unsaved changes opens a warning modal", async function () {
        var win = await openReopenedCategories();
        var row = win.categoryRowsEl.querySelector('.category-row[data-id="cat-groceries"]');
        setValue(row.querySelector(".category-row-name"), "Changed Name");

        win.categoriesBackButton.click();

        assertFalse(isHidden(win.categoriesUnsavedModal));
        assertFalse(isHidden(win.modalOverlay));
    });

    test("reverting the warning modal discards the edit", async function () {
        var win = await openReopenedCategories();
        var row = win.categoryRowsEl.querySelector('.category-row[data-id="cat-groceries"]');
        setValue(row.querySelector(".category-row-name"), "Changed Name");
        win.categoriesBackButton.click();

        win.document.getElementById("categories-unsaved-revert-button").click();

        assertTrue(isActive(win.mainViewScreen));
        var saved = win.state.categories.filter(function (c) { return c.id === "cat-groceries"; })[0];
        assertEqual(saved.name, "Groceries", "revert must discard the unapplied edit");
    });

    test("applying from the warning modal saves the edit", async function () {
        var win = await openReopenedCategories();
        var row = win.categoryRowsEl.querySelector('.category-row[data-id="cat-groceries"]');
        setValue(row.querySelector(".category-row-name"), "Changed Name");
        win.categoriesBackButton.click();

        win.document.getElementById("categories-unsaved-apply-button").click();

        assertTrue(isActive(win.mainViewScreen));
        var saved = win.state.categories.filter(function (c) { return c.id === "cat-groceries"; })[0];
        assertEqual(saved.name, "Changed Name");
    });

    test("navigating away with no changes skips the warning modal", async function () {
        var win = await openReopenedCategories();
        win.categoriesBackButton.click();
        assertTrue(isActive(win.mainViewScreen));
        assertTrue(isHidden(win.categoriesUnsavedModal));
    });
});
