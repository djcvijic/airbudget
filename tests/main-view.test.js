suite("main view: category tiles", function () {
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
