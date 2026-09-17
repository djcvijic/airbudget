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
    test("opening via a tile presets that category and starts the amount empty", async function () {
        var win = await freshApp(seededForTransactions());
        tileAddZone(win, "cat-groceries").click();

        assertTrue(isActive(win.transactionScreen));
        assertEqual(win.transactionCategorySelect.value, "cat-groceries");
        assertEqual(win.transactionAmountDisplayEl.textContent, "0.00 USD");
        assertTrue(win.transactionAmountDisplayEl.classList.contains("transaction-amount-display-empty"));
    });

    test("opening via the top-bar button has no preset category", async function () {
        var win = await freshApp(seededForTransactions());
        win.document.getElementById("open-transaction-button").click();

        assertTrue(isActive(win.transactionScreen));
        assertEqual(win.transactionCategorySelect.value, "");
    });

    test("a throwing showPicker still falls back to focusing the date input", async function () {
        var win = await freshApp(seededForTransactions());
        win.document.getElementById("open-transaction-button").click();
        win.transactionDatetimeInput.showPicker = function () {
            throw new Error("not allowed in this browser");
        };

        win.transactionDateDisplayEl.click();

        assertEqual(win.document.activeElement.id, win.transactionDatetimeInput.id);
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

    test("the numpad ignores a second decimal point", async function () {
        var win = await freshApp(seededForTransactions());
        tileAddZone(win, "cat-groceries").click();

        typeTransactionAmount(win, "4.2.5");

        assertEqual(win.transactionAmountDisplayEl.textContent, "4.25 USD");
    });

    test("the numpad ignores a third decimal digit", async function () {
        var win = await freshApp(seededForTransactions());
        tileAddZone(win, "cat-groceries").click();

        typeTransactionAmount(win, "4.256");

        assertEqual(win.transactionAmountDisplayEl.textContent, "4.25 USD");
    });

    test("backspace removes one character at a time", async function () {
        var win = await freshApp(seededForTransactions());
        tileAddZone(win, "cat-groceries").click();
        typeTransactionAmount(win, "12.5");

        win.transactionNumpadEl.querySelector('.transaction-numpad-button[data-value="backspace"]').click();

        assertEqual(win.transactionAmountDisplayEl.textContent, "12. USD");
    });

    test("a valid expense transaction saves and updates the dashboard", async function () {
        var win = await freshApp(seededForTransactions());
        tileAddZone(win, "cat-groceries").click();
        typeTransactionAmount(win, "42.5");
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
        assertEqual(win.toastEl.textContent, "Transaction added");
    });

    test("a storage failure while adding a transaction shows an error instead of a false success", async function () {
        var win = await freshApp(seededForTransactions());
        tileAddZone(win, "cat-groceries").click();
        typeTransactionAmount(win, "42.5");

        var originalSetItem = win.localStorage.setItem;
        win.localStorage.setItem = function () { throw new Error("quota"); };

        win.document.getElementById("transaction-apply-button").click();

        win.localStorage.setItem = originalSetItem;

        assertEqual(win.toastEl.textContent, "Couldn't save — storage is full");
    });

    test("an income transaction is stored unsigned but shown as a credit", async function () {
        var win = await freshApp(seededForTransactions());
        tileAddZone(win, "cat-salary").click();
        typeTransactionAmount(win, "1500");

        win.document.getElementById("transaction-apply-button").click();

        assertEqual(win.state.transactions[0].amount, 1500, "amount is stored unsigned");

        var tile = win.categoryGridEl.querySelector('.category-tile[data-id="cat-salary"]');
        assertTrue(tile.querySelector(".category-tile-amounts").className.indexOf("amount-income") !== -1);
    });

    test("cancel discards without saving", async function () {
        var win = await freshApp(seededForTransactions());
        tileAddZone(win, "cat-groceries").click();
        typeTransactionAmount(win, "99");

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

    test("editing an existing transaction prefills the form with Save and Delete shown", async function () {
        var win = await freshApp(seededForTransactions({
            transactions: [baseTransaction({ id: "txn-1", categoryId: "cat-groceries", amount: 42, comment: "existing" })]
        }));

        win.openEditTransactionScreen("txn-1");

        assertTrue(isActive(win.transactionScreen));
        assertEqual(win.transactionCategorySelect.value, "cat-groceries");
        assertEqual(win.transactionAmountDisplayEl.textContent, "42 USD");
        assertEqual(win.transactionCommentInput.value, "existing");
        assertEqual(win.transactionApplyButton.textContent, "Save");
        assertNotEqual(win.transactionDeleteButton.style.display, "none");
    });

    test("saving an edit updates the transaction in place and returns to the detail view", async function () {
        var win = await freshApp(seededForTransactions({
            transactions: [baseTransaction({ id: "txn-1", categoryId: "cat-groceries", amount: 42 })]
        }));
        win.openEditTransactionScreen("txn-1");

        clearTransactionAmount(win);
        typeTransactionAmount(win, "99");
        win.document.getElementById("transaction-apply-button").click();

        assertEqual(win.state.transactions.length, 1);
        assertEqual(win.state.transactions[0].id, "txn-1");
        assertClose(win.state.transactions[0].amount, 99);
        assertTrue(isActive(win.detailScreen), "editing from the detail view returns there, not the dashboard");
        assertEqual(win.toastEl.textContent, "Transaction updated");
    });

    test("a storage failure while saving an edit shows an error instead of a false success", async function () {
        var win = await freshApp(seededForTransactions({
            transactions: [baseTransaction({ id: "txn-1", categoryId: "cat-groceries", amount: 42 })]
        }));
        win.openEditTransactionScreen("txn-1");
        clearTransactionAmount(win);
        typeTransactionAmount(win, "99");

        var originalSetItem = win.localStorage.setItem;
        win.localStorage.setItem = function () { throw new Error("quota"); };

        win.document.getElementById("transaction-apply-button").click();

        win.localStorage.setItem = originalSetItem;

        assertEqual(win.toastEl.textContent, "Couldn't save — storage is full");
    });

    test("canceling an edit discards changes and returns to the detail view", async function () {
        var win = await freshApp(seededForTransactions({
            transactions: [baseTransaction({ id: "txn-1", categoryId: "cat-groceries", amount: 42 })]
        }));
        win.openEditTransactionScreen("txn-1");

        clearTransactionAmount(win);
        typeTransactionAmount(win, "999");
        win.document.getElementById("transaction-cancel-button").click();

        assertTrue(isActive(win.detailScreen));
        assertClose(win.state.transactions[0].amount, 42);
    });

    test("deleting a transaction requires confirmation, then removes it and returns to the detail view", async function () {
        var win = await freshApp(seededForTransactions({
            transactions: [baseTransaction({ id: "txn-1", categoryId: "cat-groceries", amount: 42 })]
        }));
        win.openEditTransactionScreen("txn-1");

        win.transactionDeleteButton.click();
        assertFalse(isHidden(win.transactionDeleteConfirmModal));
        assertEqual(win.state.transactions.length, 1, "nothing is deleted until confirmed");

        win.document.getElementById("transaction-delete-confirm-button").click();

        assertEqual(win.state.transactions.length, 0);
        assertTrue(isHidden(win.transactionDeleteConfirmModal));
        assertTrue(isActive(win.detailScreen));
        assertEqual(win.toastEl.textContent, "Transaction deleted");
    });

    test("a storage failure while deleting a transaction shows an error instead of a false success", async function () {
        var win = await freshApp(seededForTransactions({
            transactions: [baseTransaction({ id: "txn-1", categoryId: "cat-groceries", amount: 42 })]
        }));
        win.openEditTransactionScreen("txn-1");
        win.transactionDeleteButton.click();

        var originalSetItem = win.localStorage.setItem;
        win.localStorage.setItem = function () { throw new Error("quota"); };

        win.document.getElementById("transaction-delete-confirm-button").click();

        win.localStorage.setItem = originalSetItem;

        assertEqual(win.toastEl.textContent, "Couldn't save — storage is full");
        assertEqual(win.state.transactions.length, 0, "the in-memory delete still happens even though persisting it failed");
    });

    test("opening add mode after editing a transaction doesn't leak edit state onto the new save", async function () {
        var win = await freshApp(seededForTransactions({
            transactions: [baseTransaction({ id: "txn-1", categoryId: "cat-groceries", amount: 42 })]
        }));
        win.openEditTransactionScreen("txn-1");

        win.openTransactionScreen("cat-salary");

        assertEqual(win.transactionDeleteButton.style.display, "none");
        assertEqual(win.transactionCategorySelect.value, "cat-salary");
        assertEqual(win.transactionAmountValue, "", "the previous edit's amount must not carry over");

        typeTransactionAmount(win, "500");
        win.document.getElementById("transaction-apply-button").click();

        assertEqual(win.state.transactions.length, 2, "the original transaction stays and a new one is added");
        assertEqual(win.state.transactions[0].id, "txn-1");
        assertClose(win.state.transactions[0].amount, 42, "the earlier edit session must not leak into this save");
        assertTrue(isActive(win.mainViewScreen), "the add flow returns to the dashboard, not the detail view");
    });
});
