function seededForDetail() {
    var periodWideEnoughForTodayAndYesterday = "yearly";
    return {
        period: periodWideEnoughForTodayAndYesterday,
        currency: "USD",
        categories: [
            baseCategory({ id: "cat-groceries", emoji: "🛒", name: "Groceries", type: "expense", max: 200 }),
            baseCategory({ id: "cat-salary", emoji: "💰", name: "Salary", type: "income", max: null })
        ],
        transactions: [
            baseTransaction({ id: "t1", categoryId: "cat-groceries", amount: 30, datetime: nowDatetime() }),
            baseTransaction({ id: "t2", categoryId: "cat-salary", amount: 1000, datetime: nowDatetime() }),
            baseTransaction({ id: "t3", categoryId: "cat-groceries", amount: 20, datetime: daysAgoDatetime(1) })
        ]
    };
}

suite("detail view", function () {
    test("day mode groups by day, most recent first, expanded by default", async function () {
        var win = await freshApp(seededForDetail());
        win.document.getElementById("open-detail-button").click();

        assertTrue(isActive(win.detailScreen));
        assertEqual(win.state.detailMode, "day");

        var groups = win.detailListEl.querySelectorAll(".collapsible-group");
        assertEqual(groups.length, 2, "two distinct days should produce two groups");
        assertFalse(groups[0].classList.contains("collapsed"), "day groups start expanded");

        var todayBalance = groups[0].querySelector(".detail-group-balance").textContent;
        assertEqual(todayBalance, "+970.00 USD", "today nets income (1000) against expense (30)");

        var yesterdayBalance = groups[1].querySelector(".detail-group-balance").textContent;
        assertEqual(yesterdayBalance, "-20.00 USD");
    });

    test("category mode groups by category, sorted by frecency, collapsed by default", async function () {
        var win = await freshApp(seededForDetail());
        win.document.getElementById("open-detail-button").click();

        var categoryButton = [].filter.call(win.detailModeButtons, function (b) { return b.dataset.mode === "category"; })[0];
        categoryButton.click();

        assertEqual(win.state.detailMode, "category");
        var groups = win.detailListEl.querySelectorAll(".collapsible-group");
        assertEqual(groups.length, 2);
        assertTrue(groups[0].classList.contains("collapsed"), "category groups start collapsed");

        assertEqual(groups[0].id, "detail-category-cat-groceries", "two transactions outrank one, more recent overall");
        assertEqual(groups[1].id, "detail-category-cat-salary");
    });

    test("category mode sorts each category's transactions by datetime descending, not amount", async function () {
        var seeded = seededForDetail();
        seeded.transactions = [
            baseTransaction({ id: "smaller-but-newer", categoryId: "cat-groceries", amount: 5, datetime: nowDatetime() }),
            baseTransaction({ id: "bigger-but-older", categoryId: "cat-groceries", amount: 50, datetime: daysAgoDatetime(1) })
        ];
        var win = await freshApp(seeded);

        win.openDetailView("category");

        var group = win.document.getElementById("detail-category-cat-groceries");
        var rows = group.querySelectorAll(".detail-transaction");
        assertEqual(rows[0].querySelector(".detail-transaction-amount").textContent, "-5.00 USD");
        assertEqual(rows[1].querySelector(".detail-transaction-amount").textContent, "-50.00 USD");
    });

    test("clicking a group header toggles its collapsed state", async function () {
        var win = await freshApp(seededForDetail());
        win.document.getElementById("open-detail-button").click();

        var group = win.detailListEl.querySelector(".collapsible-group");
        assertFalse(group.classList.contains("collapsed"));

        group.querySelector(".collapsible-group-header").click();
        assertTrue(group.classList.contains("collapsed"));

        group.querySelector(".collapsible-group-header").click();
        assertFalse(group.classList.contains("collapsed"));
    });

    test("opening from a tile's history button scrolls to and expands that category", async function () {
        var win = await freshApp(seededForDetail());
        win.openDetailView("category", "cat-groceries");

        var target = win.document.getElementById("detail-category-cat-groceries");
        var other = win.document.getElementById("detail-category-cat-salary");

        assertFalse(target.classList.contains("collapsed"), "the targeted category auto-expands");
        assertTrue(other.classList.contains("collapsed"), "other categories stay collapsed");
    });

    test("a tile's history zone always opens category mode regardless of the current mode", async function () {
        var win = await freshApp(seededForDetail());
        var tile = win.categoryGridEl.querySelector('.category-tile[data-id="cat-groceries"]');
        tile.querySelector(".category-tile-history-zone").click();

        assertTrue(isActive(win.detailScreen));
        assertEqual(win.state.detailMode, "category");
    });

    test("the selected grouping does not survive a reload", async function () {
        var win = await freshApp(seededForDetail());
        win.document.getElementById("open-detail-button").click();
        var categoryButton = [].filter.call(win.detailModeButtons, function (b) { return b.dataset.mode === "category"; })[0];
        categoryButton.click();
        assertEqual(win.state.detailMode, "category");

        var reloaded = await loadApp();

        assertEqual(reloaded.state.detailMode, "day");
    });

    test("leaving and returning to the detail screen resets to day mode", async function () {
        var win = await freshApp(seededForDetail());
        win.document.getElementById("open-detail-button").click();
        var categoryButton = [].filter.call(win.detailModeButtons, function (b) { return b.dataset.mode === "category"; })[0];
        categoryButton.click();
        assertEqual(win.state.detailMode, "category");

        win.document.getElementById("detail-back-button").click();
        win.document.getElementById("open-detail-button").click();

        assertEqual(win.state.detailMode, "day");
    });

    test("back button returns to the dashboard", async function () {
        var win = await freshApp(seededForDetail());
        win.document.getElementById("open-detail-button").click();
        win.document.getElementById("detail-back-button").click();

        assertTrue(isActive(win.mainViewScreen));
    });

    test("clicking a transaction row opens it for editing", async function () {
        var win = await freshApp(seededForDetail());
        win.document.getElementById("open-detail-button").click();

        var row = win.detailListEl.querySelector(".detail-transaction");
        row.click();

        assertTrue(isActive(win.transactionScreen));
        assertEqual(win.transactionApplyButton.textContent, "Save");
        assertNotEqual(win.transactionDeleteButton.style.display, "none");
    });
});
