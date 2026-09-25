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

    test("shows the period title, and expected and actual balance as a stacked income/expense/balance equation", async function () {
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

        assertTrue(isActive(win.reportScreen));
        assertEqual(win.reportPeriodLabelEl.textContent, win.formatPeriodLabel(range.start, range.end));
        assertEqual(win.reportExpectedLabelEl.textContent, "Expected balance this month:");
        assertEqual(win.reportExpectedValueEl.textContent, "3,000.00 USD−1,300.00 USD+1,700.00 USD");
        assertEqual(win.reportExpectedValueEl.querySelectorAll(".balance-amount")[1].textContent, "1,300.00 USD");
        assertTrue(win.reportExpectedValueEl.querySelector(".report-equation-rule") !== null);
        assertEqual(win.reportExpectedValueEl.querySelectorAll(".amount-income, .amount-spend").length, 1);
        assertEqual(win.reportExpectedValueEl.querySelector(".amount-income").textContent, "+1,700.00 USD");
        assertEqual(win.reportActualValueEl.textContent, "3,000.00 USD−1,200.00 USD+1,800.00 USD");
        assertEqual(win.reportActualValueEl.querySelectorAll(".balance-amount")[1].textContent, "1,200.00 USD");
        assertTrue(win.reportActualValueEl.querySelector(".report-equation-rule") !== null);
        assertEqual(win.reportActualValueEl.querySelectorAll(".amount-income, .amount-spend").length, 1);
        assertEqual(win.reportActualValueEl.querySelector(".amount-income").textContent, "+1,800.00 USD");
    });

    test("still renders the equation when one side is zero", async function () {
        var win = await freshApp(seededForReport({
            categories: [
                baseCategory({ id: "salary", emoji: "💰", name: "Salary", type: "income", max: 3000 })
            ],
            transactions: [
                baseTransaction({ categoryId: "salary", amount: 3000, datetime: monthsAgoDatetime(1) })
            ]
        }));
        win.periodOffset = -1;

        win.openReportModal();

        assertEqual(win.reportExpectedValueEl.textContent, "3,000.00 USD−0.00 USD+3,000.00 USD");
        assertTrue(win.reportExpectedValueEl.querySelector(".report-equation-rule") !== null);
        assertEqual(win.reportActualValueEl.textContent, "3,000.00 USD−0.00 USD+3,000.00 USD");
        assertTrue(win.reportActualValueEl.querySelector(".report-equation-rule") !== null);
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

    test("also includes income categories that fell short of their expected amount", async function () {
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
        assertTrue(tileIds.indexOf("freelance") === -1, "income with no expected amount is never flagged, since received income can't go negative");
        assertTrue(tileIds.indexOf("bonus") !== -1, "income below its expected amount is flagged");
        assertTrue(tileIds.indexOf("dividends") !== -1, "income that never arrived at all is flagged");
        assertTrue(tileIds.indexOf("salary") === -1, "income that met its expected amount is not flagged");

        var bonusTile = win.reportProblemGridEl.querySelector('.category-tile[data-id="bonus"]');
        assertFalse(bonusTile.classList.contains("category-tile-over"), "income tiles never get the over-budget border");
        assertEqual(bonusTile.querySelector(".category-tile-amount-value").textContent, "+100");
        assertTrue(bonusTile.querySelector(".category-tile-amounts").classList.contains("amount-income"));
    });

    test("hides an over-budget expense category when expenses overall stayed within budget", async function () {
        var win = await freshApp(seededForReport({
            categories: [
                baseCategory({ id: "salary", emoji: "💰", name: "Salary", type: "income", max: 3000 }),
                baseCategory({ id: "rent", emoji: "🏠", name: "Rent", type: "expense", max: 1000 }),
                baseCategory({ id: "groceries", emoji: "🛒", name: "Groceries", type: "expense", max: 2000 })
            ],
            transactions: [
                baseTransaction({ categoryId: "salary", amount: 1000, datetime: monthsAgoDatetime(1) }),
                baseTransaction({ categoryId: "rent", amount: 1200, datetime: monthsAgoDatetime(1) })
            ]
        }));
        win.periodOffset = -1;

        win.openReportModal();

        assertNotEqual(win.reportProblemGridEl.style.display, "none");
        var tileIds = Array.from(win.reportProblemGridEl.querySelectorAll(".category-tile")).map(function (t) { return t.dataset.id; });
        assertTrue(tileIds.indexOf("salary") !== -1, "income short of expectations is the actual cause, so it's shown");
        assertTrue(tileIds.indexOf("rent") === -1, "over its own budget, but expenses overall stayed within budget, so it's hidden");
    });

    test("hides a short income category when income overall met or exceeded expectations", async function () {
        var win = await freshApp(seededForReport({
            categories: [
                baseCategory({ id: "salary", emoji: "💰", name: "Salary", type: "income", max: 2000 }),
                baseCategory({ id: "bonus", emoji: "🎁", name: "Bonus", type: "income", max: 1000 }),
                baseCategory({ id: "rent", emoji: "🏠", name: "Rent", type: "expense", max: 500 })
            ],
            transactions: [
                baseTransaction({ categoryId: "salary", amount: 3000, datetime: monthsAgoDatetime(1) }),
                baseTransaction({ categoryId: "rent", amount: 800, datetime: monthsAgoDatetime(1) })
            ]
        }));
        win.periodOffset = -1;

        win.openReportModal();

        assertNotEqual(win.reportProblemGridEl.style.display, "none");
        var tileIds = Array.from(win.reportProblemGridEl.querySelectorAll(".category-tile")).map(function (t) { return t.dataset.id; });
        assertTrue(tileIds.indexOf("rent") !== -1, "over budget is the actual cause, so it's shown");
        assertTrue(tileIds.indexOf("bonus") === -1, "short of its own expectation, but income overall met or exceeded expectations, so it's hidden");
    });

    test("records the last second of the viewed period as the last-seen report, and persists it", async function () {
        var win = await freshApp(seededForReport({
            transactions: [baseTransaction({ categoryId: "rent", amount: 500, datetime: monthsAgoDatetime(1) })]
        }));
        win.periodOffset = -1;
        var range = win.getPeriodRange(win.state.period, win.periodOffset);
        var expected = win.formatDateTime(new Date(range.end.getTime() - 1000));

        win.openReportModal();

        assertEqual(win.state.lastSeenReport, expected);

        var reloaded = await loadApp();
        assertEqual(reloaded.state.lastSeenReport, expected);
    });

    test("the back button returns to the dashboard", async function () {
        var win = await freshApp(seededForReport({
            transactions: [baseTransaction({ categoryId: "rent", amount: 500, datetime: monthsAgoDatetime(1) })]
        }));
        win.periodOffset = -1;
        win.openReportModal();

        win.document.getElementById("report-back-button").click();

        assertTrue(isActive(win.mainViewScreen));
    });

    test("opening an older period's report doesn't un-mark a more recently seen report", async function () {
        var win = await freshApp(seededForReport({}));
        win.periodOffset = -1;
        win.openReportModal();
        var mostRecentSeen = win.state.lastSeenReport;

        win.periodOffset = -2;
        win.openReportModal();

        assertEqual(win.state.lastSeenReport, mostRecentSeen);
    });
});

suite("main view: report banner", function () {
    test("shows on the dashboard when the most recent period's report hasn't been seen", async function () {
        var win = await freshApp(seededForReport({}));

        assertEqual(win.reportBannerEl.style.display, "flex");
        assertTrue(win.mainViewScreen.contains(win.reportBannerEl), "only ever shown on the main screen");
    });

    test("hides once the most recent period's report has been seen", async function () {
        var win = await freshApp(seededForReport({}));
        var range = win.getPeriodRange(win.state.period, -1);
        win.state.lastSeenReport = win.formatDateTime(new Date(range.end.getTime() - 1000));

        win.updateReportBanner();

        assertEqual(win.reportBannerEl.style.display, "none");
    });

    test("the X dismisses it and marks the most recent report as seen, without opening it", async function () {
        var win = await freshApp(seededForReport({}));
        var range = win.getPeriodRange(win.state.period, -1);
        var expected = win.formatDateTime(new Date(range.end.getTime() - 1000));

        win.document.getElementById("report-banner-dismiss-button").click();

        assertEqual(win.state.lastSeenReport, expected);
        assertEqual(win.reportBannerEl.style.display, "none");
        assertFalse(isActive(win.reportScreen));
    });

    test("See report navigates to the most recent period, opens its report, and dismisses the banner", async function () {
        var win = await freshApp(seededForReport({
            transactions: [baseTransaction({ categoryId: "rent", amount: 500, datetime: monthsAgoDatetime(1) })]
        }));

        win.document.getElementById("report-banner-see-button").click();

        assertEqual(win.periodOffset, -1);
        assertTrue(isActive(win.reportScreen));
        assertEqual(win.reportBannerEl.style.display, "none");
    });
});
