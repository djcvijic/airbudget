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
    test("reopened screen shows Back and no forced chrome, clean so Apply is disabled", async function () {
        var win = await openReopenedCategories();
        assertEqual(win.categoriesDoneButton.textContent, "Apply");
        assertNotEqual(win.categoriesBackButton.style.display, "none");
        assertEqual(win.categoriesOnboardingBackButton.style.display, "none");
        assertNotEqual(win.categoriesCancelButton.style.display, "none");
        assertNotEqual(win.categoriesDoneButton.style.display, "none");
        assertTrue(win.categoriesDoneButton.disabled);
    });

    test("editing a row enables Apply", async function () {
        var win = await openReopenedCategories();
        var row = win.categoryRowsEl.querySelector('.category-row[data-id="cat-groceries"]');
        setValue(row.querySelector(".category-row-name"), "Changed Name");

        assertFalse(win.categoriesDoneButton.disabled);
    });

    test("editing back to the original values disables Apply again", async function () {
        var win = await openReopenedCategories();
        var row = win.categoryRowsEl.querySelector('.category-row[data-id="cat-groceries"]');
        var nameInput = row.querySelector(".category-row-name");
        setValue(nameInput, "Changed Name");
        setValue(nameInput, "Groceries");

        assertTrue(win.categoriesDoneButton.disabled);
    });

    test("clicking Cancel with no changes navigates back with no warning", async function () {
        var win = await openReopenedCategories();

        win.categoriesCancelButton.click();

        assertTrue(isActive(win.mainViewScreen));
        assertTrue(isHidden(win.categoriesUnsavedModal));
    });

    test("clicking Cancel with unsaved changes shows a warning instead of discarding immediately", async function () {
        var win = await openReopenedCategories();
        var row = win.categoryRowsEl.querySelector('.category-row[data-id="cat-groceries"]');
        setValue(row.querySelector(".category-row-name"), "Changed Name");

        win.categoriesCancelButton.click();

        assertTrue(isActive(win.categoriesScreen), "navigation is blocked until the warning is resolved");
        assertFalse(isHidden(win.categoriesUnsavedModal));
    });

    test("applying a change shows a confirmation toast", async function () {
        var win = await openReopenedCategories();
        var row = win.categoryRowsEl.querySelector('.category-row[data-id="cat-groceries"]');
        setValue(row.querySelector(".category-row-name"), "Renamed");

        win.categoriesDoneButton.click();

        assertEqual(win.toastEl.textContent, "Categories saved");
    });

    test("a storage failure while applying shows an error instead of a false success", async function () {
        var win = await openReopenedCategories();
        var row = win.categoryRowsEl.querySelector('.category-row[data-id="cat-groceries"]');
        setValue(row.querySelector(".category-row-name"), "Renamed");

        var originalSetItem = win.localStorage.setItem;
        win.localStorage.setItem = function () { throw new Error("quota"); };

        win.categoriesDoneButton.click();

        win.localStorage.setItem = originalSetItem;

        assertEqual(win.toastEl.textContent, "Couldn't save — storage is full");
    });

    test("switching from a dirty reopened screen into forced mode resets Revert and Done", async function () {
        var win = await openReopenedCategories();
        var row = win.categoryRowsEl.querySelector('.category-row[data-id="cat-groceries"]');
        setValue(row.querySelector(".category-row-name"), "Changed Name");
        assertFalse(win.categoriesDoneButton.disabled);

        win.openCategoriesScreen(true);

        assertEqual(win.categoriesCancelButton.style.display, "none");
        assertNotEqual(win.categoriesDoneButton.style.display, "none");
        assertFalse(win.categoriesDoneButton.disabled);
    });

    test("existing categories get no delete button", async function () {
        var win = await openReopenedCategories();
        var rows = win.categoryRowsEl.querySelectorAll(".category-row");
        rows.forEach(function (row) {
            assertTrue(row.dataset.id.length > 0);
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

    test("switching a row to income keeps its budget field enabled, relabeled as Expected", async function () {
        var win = await openReopenedCategories();
        var row = win.categoryRowsEl.querySelector('.category-row[data-id="cat-groceries"]');
        var maxInput = row.querySelector(".category-row-max");
        setValue(maxInput, "150");

        var incomeButton = [].filter.call(row.querySelectorAll(".category-row-type-option"), function (b) {
            return b.textContent === "Income";
        })[0];
        incomeButton.click();

        assertFalse(maxInput.disabled);
        assertEqual(maxInput.value, "150");
        assertEqual(maxInput.placeholder, "Expected");
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

    test("discarding from the warning modal discards the edit", async function () {
        var win = await openReopenedCategories();
        var row = win.categoryRowsEl.querySelector('.category-row[data-id="cat-groceries"]');
        setValue(row.querySelector(".category-row-name"), "Changed Name");
        win.categoriesBackButton.click();

        win.document.getElementById("categories-unsaved-discard-button").click();

        assertTrue(isActive(win.mainViewScreen));
        var saved = win.state.categories.filter(function (c) { return c.id === "cat-groceries"; })[0];
        assertEqual(saved.name, "Groceries", "discard must drop the unapplied edit");
    });

    test("backing out of the warning modal keeps the edit and stays on the screen", async function () {
        var win = await openReopenedCategories();
        var row = win.categoryRowsEl.querySelector('.category-row[data-id="cat-groceries"]');
        setValue(row.querySelector(".category-row-name"), "Changed Name");
        win.categoriesBackButton.click();

        win.document.getElementById("categories-unsaved-back-button").click();

        assertTrue(isActive(win.categoriesScreen));
        assertTrue(isHidden(win.categoriesUnsavedModal));
        var row2 = win.categoryRowsEl.querySelector('.category-row[data-id="cat-groceries"]');
        assertEqual(row2.querySelector(".category-row-name").value, "Changed Name");
    });

    test("navigating away with no changes skips the warning modal", async function () {
        var win = await openReopenedCategories();
        win.categoriesBackButton.click();
        assertTrue(isActive(win.mainViewScreen));
        assertTrue(isHidden(win.categoriesUnsavedModal));
    });
});
