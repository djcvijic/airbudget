suite("main view: category tiles", function () {
    test("a tile's add-zone is soft-disabled when viewing a past period", async function () {
        var win = await freshApp({
            period: "monthly",
            currency: "USD",
            categories: [baseCategory({ id: "cat-groceries", emoji: "🛒", name: "Groceries", type: "expense", max: 200 })],
            transactions: []
        });
        win.periodOffset = -1;
        win.renderMainView();

        tileAddZone(win, "cat-groceries").click();

        assertTrue(isActive(win.mainViewScreen));
        assertTrue(win.toastEl.textContent.length > 0);
    });

    test("a tile's history zone is soft-disabled when the category has no transactions in the current period", async function () {
        var win = await freshApp({
            period: "monthly",
            currency: "USD",
            categories: [baseCategory({ id: "cat-rent", emoji: "🏠", name: "Rent", type: "expense", max: 1000 })],
            transactions: []
        });

        tileHistoryZone(win, "cat-rent").click();

        assertTrue(isActive(win.mainViewScreen), "history zone while disabled must not navigate away");
        assertTrue(win.toastEl.textContent.length > 0);
    });
});
