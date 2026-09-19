function seededForReport(overrides) {
    var state = {
        period: "monthly",
        currency: "USD",
        categories: [
            baseCategory({ id: "salary", emoji: "💰", name: "Salary", type: "income", max: 3000 }),
            baseCategory({ id: "rent", emoji: "🏠", name: "Rent", type: "expense", max: 1000 }),
            baseCategory({ id: "groceries", emoji: "🛒", name: "Groceries", type: "expense", max: 300 })
        ]
    };
    for (var key in overrides) {
        state[key] = overrides[key];
    }
    return state;
}

suite("main view: report", function () {
    test("the report button is hidden on the current period and appears once you navigate away", async function () {
        var win = await freshApp(seededForReport({
            transactions: [baseTransaction({ categoryId: "rent", amount: 500, datetime: monthsAgoDatetime(1) })]
        }));

        assertEqual(win.periodCurrentRow.style.display, "none");

        win.document.getElementById("period-prev-button").click();

        assertNotEqual(win.periodCurrentRow.style.display, "none");
    });

    test("shows the period title, and expected and actual balance for the viewed period", async function () {
        var win = await freshApp(seededForReport({
            transactions: [
                baseTransaction({ categoryId: "salary", amount: 3000, datetime: monthsAgoDatetime(1) }),
                baseTransaction({ categoryId: "rent", amount: 1000, datetime: monthsAgoDatetime(1) }),
                baseTransaction({ categoryId: "groceries", amount: 200, datetime: monthsAgoDatetime(1) })
            ]
        }));
        win.periodOffset = -1;
        var range = win.getPeriodRange(win.state.period, win.periodOffset);

        win.openReportModal();

        assertFalse(isHidden(win.reportModal));
        assertEqual(win.reportTitleEl.textContent, "Report: " + win.formatPeriodLabel(range.start, range.end));
        assertEqual(win.reportExpectedLabelEl.textContent, "Expected balance this month:");
        assertEqual(win.reportExpectedValueEl.textContent, "+1,700.00 USD");
        assertEqual(win.reportActualValueEl.textContent, "+1,800.00 USD");
    });

    test("shows the on-track message and reality-check paragraph when actual balance meets or exceeds expected", async function () {
        var win = await freshApp(seededForReport({
            transactions: [
                baseTransaction({ categoryId: "salary", amount: 3000, datetime: monthsAgoDatetime(1) }),
                baseTransaction({ categoryId: "rent", amount: 1000, datetime: monthsAgoDatetime(1) }),
                baseTransaction({ categoryId: "groceries", amount: 200, datetime: monthsAgoDatetime(1) })
            ]
        }));
        win.periodOffset = -1;

        win.openReportModal();

        assertNotEqual(win.reportOnTrackMessageEl.style.display, "none");
        assertNotEqual(win.reportRealityCheckMessageEl.style.display, "none");
        assertEqual(win.reportBelowTargetMessageEl.style.display, "none");
        assertEqual(win.reportProblemGridEl.style.display, "none");
        assertEqual(win.reportAccuracyMessageEl.style.display, "none");
    });

    test("shows the below-target message and inert over-budget tiles when actual balance falls short", async function () {
        var win = await freshApp(seededForReport({
            transactions: [
                baseTransaction({ categoryId: "salary", amount: 3000, datetime: monthsAgoDatetime(1) }),
                baseTransaction({ categoryId: "rent", amount: 1000, datetime: monthsAgoDatetime(1) }),
                baseTransaction({ categoryId: "groceries", amount: 700, datetime: monthsAgoDatetime(1) })
            ]
        }));
        win.periodOffset = -1;

        win.openReportModal();

        assertEqual(win.reportOnTrackMessageEl.style.display, "none");
        assertEqual(win.reportRealityCheckMessageEl.style.display, "none");
        assertNotEqual(win.reportBelowTargetMessageEl.style.display, "none");
        assertNotEqual(win.reportProblemGridEl.style.display, "none");
        assertNotEqual(win.reportAccuracyMessageEl.style.display, "none");

        var tiles = win.reportProblemGridEl.querySelectorAll(".category-tile");
        assertEqual(tiles.length, 1);
        assertEqual(tiles[0].dataset.id, "groceries");
        assertTrue(tiles[0].querySelector(".category-tile-add-icon") === null, "no plus icon");
        assertTrue(tiles[0].querySelector(".category-tile-divider") === null, "no bottom divider");
        assertTrue(tiles[0].querySelector(".category-tile-history-zone") === null, "no receipt zone");
    });

    test("also includes categories with spend but no budget set, in the same order as the main view", async function () {
        var win = await freshApp(seededForReport({
            categories: [
                baseCategory({ id: "salary", emoji: "💰", name: "Salary", type: "income", max: 3000 }),
                baseCategory({ id: "rent", emoji: "🏠", name: "Rent", type: "expense", max: 1000 }),
                baseCategory({ id: "groceries", emoji: "🛒", name: "Groceries", type: "expense", max: 300 }),
                baseCategory({ id: "coffee", emoji: "☕", name: "Coffee", type: "expense", max: null })
            ],
            transactions: [
                baseTransaction({ categoryId: "salary", amount: 3000, datetime: monthsAgoDatetime(1) }),
                baseTransaction({ categoryId: "rent", amount: 1000, datetime: monthsAgoDatetime(1) }),
                baseTransaction({ categoryId: "groceries", amount: 700, datetime: monthsAgoDatetime(1) }),
                baseTransaction({ categoryId: "coffee", amount: 50, datetime: monthsAgoDatetime(1) })
            ]
        }));
        win.periodOffset = -1;
        var range = win.getPeriodRange(win.state.period, win.periodOffset);
        var expectedIds = win.getSortedCategoryEntries(range.start, range.end)
            .filter(win.isReportProblem)
            .map(function (e) { return e.id; });

        win.openReportModal();

        var tileIds = Array.from(win.reportProblemGridEl.querySelectorAll(".category-tile")).map(function (t) { return t.dataset.id; });
        assertEqual(tileIds.join(","), expectedIds.join(","));
        assertTrue(tileIds.indexOf("coffee") !== -1, "the unbudgeted category with spend must be included");

        var coffeeTile = win.reportProblemGridEl.querySelector('.category-tile[data-id="coffee"]');
        assertFalse(coffeeTile.classList.contains("category-tile-over"), "an unbudgeted category was never actually over its budget");
    });

    test("also includes income categories with no expected amount, or that fell short of it", async function () {
        var win = await freshApp(seededForReport({
            categories: [
                baseCategory({ id: "salary", emoji: "💰", name: "Salary", type: "income", max: 3000 }),
                baseCategory({ id: "rent", emoji: "🏠", name: "Rent", type: "expense", max: 1000 }),
                baseCategory({ id: "groceries", emoji: "🛒", name: "Groceries", type: "expense", max: 300 }),
                baseCategory({ id: "freelance", emoji: "💻", name: "Freelance", type: "income", max: null }),
                baseCategory({ id: "bonus", emoji: "🎁", name: "Bonus", type: "income", max: 500 }),
                baseCategory({ id: "dividends", emoji: "📈", name: "Dividends", type: "income", max: 200 })
            ],
            transactions: [
                baseTransaction({ categoryId: "salary", amount: 3000, datetime: monthsAgoDatetime(1) }),
                baseTransaction({ categoryId: "rent", amount: 1000, datetime: monthsAgoDatetime(1) }),
                baseTransaction({ categoryId: "groceries", amount: 700, datetime: monthsAgoDatetime(1) }),
                baseTransaction({ categoryId: "freelance", amount: 50, datetime: monthsAgoDatetime(1) }),
                baseTransaction({ categoryId: "bonus", amount: 100, datetime: monthsAgoDatetime(1) })
            ]
        }));
        win.periodOffset = -1;

        win.openReportModal();

        var tileIds = Array.from(win.reportProblemGridEl.querySelectorAll(".category-tile")).map(function (t) { return t.dataset.id; });
        assertTrue(tileIds.indexOf("freelance") !== -1, "income with no expected amount, but some received, is flagged");
        assertTrue(tileIds.indexOf("bonus") !== -1, "income below its expected amount is flagged");
        assertTrue(tileIds.indexOf("dividends") !== -1, "income that never arrived at all is flagged");
        assertTrue(tileIds.indexOf("salary") === -1, "income that met its expected amount is not flagged");

        var freelanceTile = win.reportProblemGridEl.querySelector('.category-tile[data-id="freelance"]');
        assertFalse(freelanceTile.classList.contains("category-tile-over"), "income tiles never get the over-budget border");
        assertEqual(freelanceTile.querySelector(".category-tile-amount-value").textContent, "+50.00");
        assertTrue(freelanceTile.querySelector(".category-tile-amounts").classList.contains("amount-income"));
    });

    test("the Done button closes the modal", async function () {
        var win = await freshApp(seededForReport({
            transactions: [baseTransaction({ categoryId: "rent", amount: 500, datetime: monthsAgoDatetime(1) })]
        }));
        win.periodOffset = -1;
        win.openReportModal();

        win.document.getElementById("report-done-button").click();

        assertTrue(isHidden(win.reportModal));
    });
});
