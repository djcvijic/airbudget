function seededForTransactions(overrides) {
    var state = {
        period: "monthly",
        currency: "USD",
        categories: [
            baseCategory({ id: "cat-groceries", emoji: "🛒", name: "Groceries", type: "expense", max: 200 }),
            baseCategory({ id: "cat-salary", emoji: "💰", name: "Salary", type: "income", max: null })
        ],
        transactions: []
    };
    for (var key in overrides) {
        state[key] = overrides[key];
    }
    return state;
}

function tileAddZone(win, categoryId) {
    var tile = win.categoryGridEl.querySelector('.category-tile[data-id="' + categoryId + '"]');
    return tile.querySelector(".category-tile-add-zone");
}

suite("transaction screen", function () {
    test("opening via a tile presets that category and focuses the amount", async function () {
        var win = await freshApp(seededForTransactions());
        tileAddZone(win, "cat-groceries").click();

        assertTrue(isActive(win.transactionScreen));
        assertEqual(win.transactionCategorySelect.value, "cat-groceries");
        assertEqual(win.document.activeElement.id, win.transactionAmountInput.id);
    });

    test("opening via the top-bar button has no preset category and focuses the category select", async function () {
        var win = await freshApp(seededForTransactions());
        win.document.getElementById("open-transaction-button").click();

        assertTrue(isActive(win.transactionScreen));
        assertEqual(win.transactionCategorySelect.value, "");
        assertEqual(win.document.activeElement.id, win.transactionCategorySelect.id);
    });

    test("expense category shows a minus sign, income shows a plus sign", async function () {
        var win = await freshApp(seededForTransactions());
        win.document.getElementById("open-transaction-button").click();

        setValue(win.transactionCategorySelect, "cat-groceries");
        assertEqual(win.transactionAmountSignEl.textContent, "−");
        assertTrue(win.transactionAmountSignEl.className.indexOf("amount-spend") !== -1);

        setValue(win.transactionCategorySelect, "cat-salary");
        assertEqual(win.transactionAmountSignEl.textContent, "+");
        assertTrue(win.transactionAmountSignEl.className.indexOf("amount-income") !== -1);
    });

    test("missing category or amount blocks saving", async function () {
        var win = await freshApp(seededForTransactions());
        win.document.getElementById("open-transaction-button").click();

        win.document.getElementById("transaction-apply-button").click();

        assertTrue(win.transactionErrorEl.textContent.length > 0);
        assertEqual(win.state.transactions.length, 0);
        assertTrue(isActive(win.transactionScreen));
    });

    test("a negative amount is rejected", async function () {
        var win = await freshApp(seededForTransactions());
        tileAddZone(win, "cat-groceries").click();
        setValue(win.transactionAmountInput, "-5");

        win.document.getElementById("transaction-apply-button").click();

        assertTrue(win.transactionErrorEl.textContent.length > 0);
        assertEqual(win.state.transactions.length, 0);
    });

    test("a valid expense transaction saves and updates the dashboard", async function () {
        var win = await freshApp(seededForTransactions());
        tileAddZone(win, "cat-groceries").click();
        setValue(win.transactionAmountInput, "42.5");
        setValue(win.transactionCommentInput, "weekly shop");

        win.document.getElementById("transaction-apply-button").click();

        assertTrue(isActive(win.mainViewScreen));
        assertEqual(win.state.transactions.length, 1);
        assertEqual(win.state.transactions[0].categoryId, "cat-groceries");
        assertClose(win.state.transactions[0].amount, 42.5);
        assertEqual(win.state.transactions[0].comment, "weekly shop");

        var tile = win.categoryGridEl.querySelector('.category-tile[data-id="cat-groceries"]');
        var amountText = tile.querySelector(".category-tile-amount-value").textContent;
        assertEqual(amountText, "-42.50");
    });

    test("an income transaction is stored unsigned but shown as a credit", async function () {
        var win = await freshApp(seededForTransactions());
        tileAddZone(win, "cat-salary").click();
        setValue(win.transactionAmountInput, "1500");

        win.document.getElementById("transaction-apply-button").click();

        assertEqual(win.state.transactions[0].amount, 1500, "amount is stored unsigned");

        var tile = win.categoryGridEl.querySelector('.category-tile[data-id="cat-salary"]');
        assertTrue(tile.querySelector(".category-tile-amounts").className.indexOf("amount-income") !== -1);
    });

    test("cancel discards without saving", async function () {
        var win = await freshApp(seededForTransactions());
        tileAddZone(win, "cat-groceries").click();
        setValue(win.transactionAmountInput, "99");

        win.document.getElementById("transaction-cancel-button").click();

        assertTrue(isActive(win.mainViewScreen));
        assertEqual(win.state.transactions.length, 0);
    });

    test("hidden categories are excluded from the picker unless already selected", async function () {
        var seeded = seededForTransactions();
        seeded.categories.push(baseCategory({ id: "cat-hidden", emoji: "🙈", name: "Hidden", type: "expense", hidden: true }));
        var win = await freshApp(seeded);

        win.buildTransactionCategoryOptions();
        var optionsWithoutPreset = [].map.call(win.transactionCategorySelect.options, function (o) { return o.value; });
        assertTrue(optionsWithoutPreset.indexOf("cat-hidden") === -1);

        win.buildTransactionCategoryOptions("cat-hidden");
        var optionsWithPreset = [].map.call(win.transactionCategorySelect.options, function (o) { return o.value; });
        assertTrue(optionsWithPreset.indexOf("cat-hidden") !== -1);
    });

    test("clicking a hidden category's tile shows a toast instead of opening the screen", async function () {
        var seeded = seededForTransactions();
        seeded.categories.push(baseCategory({ id: "cat-hidden", emoji: "🙈", name: "Hidden", type: "expense", hidden: true }));
        var win = await freshApp(seeded);

        tileAddZone(win, "cat-hidden").click();

        assertFalse(isActive(win.transactionScreen));
        assertTrue(win.toastEl.classList.contains("visible"));
    });
});
