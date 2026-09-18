suite("state.js: getPeriodRange", function () {
    test("daily offset 0 spans exactly today", async function () {
        var win = await freshApp({ period: "daily", currency: "USD" });
        var range = win.getPeriodRange("daily", 0);
        var today = new Date();

        assertEqual(range.start.getFullYear(), today.getFullYear());
        assertEqual(range.start.getMonth(), today.getMonth());
        assertEqual(range.start.getDate(), today.getDate());
        assertEqual(range.start.getHours(), 0);

        var oneDayMs = 24 * 60 * 60 * 1000;
        assertEqual(range.end.getTime() - range.start.getTime(), oneDayMs);
    });

    test("daily offset -1 is exactly one day before offset 0", async function () {
        var win = await freshApp({ period: "daily", currency: "USD" });
        var today = win.getPeriodRange("daily", 0);
        var yesterday = win.getPeriodRange("daily", -1);

        assertEqual(today.start.getTime() - yesterday.start.getTime(), 24 * 60 * 60 * 1000);
        assertEqual(yesterday.end.getTime(), today.start.getTime());
    });

    test("weekly starts on Monday and spans 7 days", async function () {
        var win = await freshApp({ period: "weekly", currency: "USD" });
        var range = win.getPeriodRange("weekly", 0);

        assertEqual(range.start.getDay(), 1, "week must start on Monday");
        assertEqual(range.end.getTime() - range.start.getTime(), 7 * 24 * 60 * 60 * 1000);

        var today = new Date();
        assertTrue(today >= range.start && today < range.end, "today must fall inside its own week");
    });

    test("weekly offset moves by whole weeks", async function () {
        var win = await freshApp({ period: "weekly", currency: "USD" });
        var thisWeek = win.getPeriodRange("weekly", 0);
        var nextWeek = win.getPeriodRange("weekly", 1);

        assertEqual(nextWeek.start.getTime() - thisWeek.start.getTime(), 7 * 24 * 60 * 60 * 1000);
    });

    test("monthly offset 0 spans the calendar month", async function () {
        var win = await freshApp({ period: "monthly", currency: "USD" });
        var range = win.getPeriodRange("monthly", 0);
        var today = new Date();

        assertEqual(range.start.getDate(), 1);
        assertEqual(range.start.getMonth(), today.getMonth());
        assertEqual(range.start.getFullYear(), today.getFullYear());
        assertEqual(range.end.getDate(), 1);

        var expectedEndMonth = (today.getMonth() + 1) % 12;
        assertEqual(range.end.getMonth(), expectedEndMonth);
    });

    test("monthly offset crosses a year boundary correctly", async function () {
        var win = await freshApp({ period: "monthly", currency: "USD" });
        var jan = win.getPeriodRange("monthly", 0);
        var monthsPastFullYear = 13;
        var farFuture = win.getPeriodRange("monthly", monthsPastFullYear);
        var expectedMonth = (jan.start.getMonth() + monthsPastFullYear) % 12;
        var expectedYear = jan.start.getFullYear() + Math.floor((jan.start.getMonth() + monthsPastFullYear) / 12);
        assertEqual(farFuture.start.getMonth(), expectedMonth);
        assertEqual(farFuture.start.getFullYear(), expectedYear);
    });

    test("yearly offset 0 spans Jan 1 to Jan 1", async function () {
        var win = await freshApp({ period: "yearly", currency: "USD" });
        var range = win.getPeriodRange("yearly", 0);
        var currentYear = new Date().getFullYear();

        assertEqual(range.start.getFullYear(), currentYear);
        assertEqual(range.start.getMonth(), 0);
        assertEqual(range.start.getDate(), 1);
        assertEqual(range.end.getFullYear(), currentYear + 1);
    });
});

suite("state.js: formatPeriodLabel / formatCurrency", function () {
    test("formatCurrency appends the ISO currency code with 2 decimals", async function () {
        var win = await freshApp({ period: "monthly", currency: "EUR" });
        assertEqual(win.formatCurrency(12.5), "12.50 EUR");
        assertEqual(win.formatCurrency(0), "0.00 EUR");
    });

    test("formatCurrency adds a thousands separator for large amounts", async function () {
        var win = await freshApp({ period: "monthly", currency: "EUR" });
        assertEqual(win.formatCurrency(12345.6), "12,345.60 EUR");
        assertEqual(win.formatCurrency(1234567.89), "1,234,567.89 EUR");
    });

    test("formatPeriodLabel collapses a single-day range to one date", async function () {
        var win = await freshApp({ period: "daily", currency: "USD" });
        var start = new Date(2026, 2, 15);
        var end = new Date(2026, 2, 16);
        var label = win.formatPeriodLabel(start, end);
        assertTrue(label.indexOf("Mar") !== -1 && label.indexOf("15") !== -1, "expected Mar and 15 in either locale order, got: " + label);
        assertFalse(label.indexOf(" - ") !== -1, "a single day must not render as a range: " + label);
    });

    test("formatPeriodLabel shows a range for multi-day periods", async function () {
        var win = await freshApp({ period: "monthly", currency: "USD" });
        var start = new Date(2026, 2, 1);
        var end = new Date(2026, 3, 1);
        var label = win.formatPeriodLabel(start, end);
        assertTrue(label.indexOf(" - ") !== -1, "expected a range separator, got: " + label);
        assertTrue(label.indexOf("1") !== -1 && label.indexOf("31") !== -1, "expected day 1 and day 31, got: " + label);
    });
});

suite("state.js: getCategorySpend sign convention", function () {
    test("expense category sums transactions as positive spend", async function () {
        var win = await freshApp({ period: "monthly", currency: "USD" });
        var cat = baseCategory({ type: "expense" });
        win.state.categories = [cat];
        win.state.transactions = [
            baseTransaction({ categoryId: cat.id, amount: 10, datetime: nowDatetime() }),
            baseTransaction({ categoryId: cat.id, amount: 5, datetime: nowDatetime() })
        ];

        var range = win.getPeriodRange("monthly", 0);
        assertClose(win.getCategorySpend(cat.id, range.start, range.end), 15);
    });

    test("income category sums transactions as negative net spend", async function () {
        var win = await freshApp({ period: "monthly", currency: "USD" });
        var cat = baseCategory({ type: "income", max: null });
        win.state.categories = [cat];
        win.state.transactions = [
            baseTransaction({ categoryId: cat.id, amount: 1000, datetime: nowDatetime() })
        ];

        var range = win.getPeriodRange("monthly", 0);
        assertClose(win.getCategorySpend(cat.id, range.start, range.end), -1000);
    });

    test("transactions outside the range are excluded", async function () {
        var win = await freshApp({ period: "monthly", currency: "USD" });
        var cat = baseCategory({ type: "expense" });
        win.state.categories = [cat];
        win.state.transactions = [
            baseTransaction({ categoryId: cat.id, amount: 999, datetime: "2000-01-01T00:00" })
        ];

        var range = win.getPeriodRange("monthly", 0);
        assertClose(win.getCategorySpend(cat.id, range.start, range.end), 0);
    });
});

suite("state.js: getSortedCategoryEntries", function () {
    test("sorts by frecency, not spend or over-max status", async function () {
        var win = await freshApp({ period: "monthly", currency: "USD" });
        var overBudget = baseCategory({ id: "over", type: "expense", max: 10 });
        var underBudget = baseCategory({ id: "under", type: "expense", max: 100 });
        win.state.categories = [overBudget, underBudget];
        win.state.transactions = [
            baseTransaction({ categoryId: overBudget.id, amount: 20, datetime: nowDatetime() }),
            baseTransaction({ categoryId: underBudget.id, amount: 5, datetime: nowDatetime() }),
            baseTransaction({ categoryId: underBudget.id, amount: 5, datetime: nowDatetime() })
        ];

        var range = win.getPeriodRange("monthly", 0);
        var entries = win.getSortedCategoryEntries(range.start, range.end);

        var overEntry = entries.filter(function (e) { return e.id === "over"; })[0];
        assertTrue(overEntry.overMax, "overMax is still computed, for the tile warning icon");
        assertEqual(entries[0].id, "under", "two recent transactions outrank one, despite the other category being over max");
    });

    test("income never counts as over-max, even past its expected amount", async function () {
        var win = await freshApp({ period: "monthly", currency: "USD" });
        var salary = baseCategory({ id: "salary", type: "income", max: 1000 });
        win.state.categories = [salary];
        win.state.transactions = [
            baseTransaction({ categoryId: salary.id, amount: 1500, datetime: nowDatetime() })
        ];

        var range = win.getPeriodRange("monthly", 0);
        var entries = win.getSortedCategoryEntries(range.start, range.end);

        assertFalse(entries[0].overMax);
    });
});

suite("state.js: getExpectedPeriodicIncome", function () {
    test("sums income expectations and subtracts expense budgets", async function () {
        var win = await freshApp({ period: "weekly", currency: "USD" });
        win.state.categories = [
            baseCategory({ id: "salary", type: "income", max: 3000 }),
            baseCategory({ id: "rent", type: "expense", max: 1000 }),
            baseCategory({ id: "groceries", type: "expense", max: 500 })
        ];

        assertEqual(win.getExpectedPeriodicIncome(), 1500);
    });

    test("categories with no budget/expected amount set don't contribute", async function () {
        var win = await freshApp({ period: "weekly", currency: "USD" });
        win.state.categories = [
            baseCategory({ id: "salary", type: "income", max: 1000 }),
            baseCategory({ id: "misc", type: "expense", max: null })
        ];

        assertEqual(win.getExpectedPeriodicIncome(), 1000);
    });

    test("can be negative when budgets exceed expected income", async function () {
        var win = await freshApp({ period: "weekly", currency: "USD" });
        win.state.categories = [
            baseCategory({ id: "rent", type: "expense", max: 1000 })
        ];

        assertEqual(win.getExpectedPeriodicIncome(), -1000);
    });
});

suite("state.js: getPeriodOffsetForDate", function () {
    test("monthly buckets a date by calendar-month distance from today", async function () {
        var win = await freshApp({ period: "monthly", currency: "USD" });
        var today = new Date();
        var threeMonthsAgo = new Date(today.getFullYear(), today.getMonth() - 3, 10);
        assertEqual(win.getPeriodOffsetForDate("monthly", threeMonthsAgo), -3);
    });

    test("weekly buckets a date by whole weeks from this week's Monday", async function () {
        var win = await freshApp({ period: "weekly", currency: "USD" });
        var thisWeek = win.getPeriodRange("weekly", 0);
        var nextWeekDay = new Date(thisWeek.start.getFullYear(), thisWeek.start.getMonth(), thisWeek.start.getDate() + 9);
        assertEqual(win.getPeriodOffsetForDate("weekly", nextWeekDay), 1);
    });

    test("daily buckets a date by whole days from today", async function () {
        var win = await freshApp({ period: "daily", currency: "USD" });
        var today = new Date();
        var yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1, 23, 0);
        assertEqual(win.getPeriodOffsetForDate("daily", yesterday), -1);
    });
});

suite("state.js: findAdjacentPeriodOffset", function () {
    test("current period (0) is always a valid target even with no transactions", async function () {
        var win = await freshApp({ period: "monthly", currency: "USD" });
        win.state.transactions = [];
        assertEqual(win.findAdjacentPeriodOffset("monthly", -5, 1), 0);
    });

    test("skips over empty periods to the nearest one with a transaction", async function () {
        var win = await freshApp({ period: "monthly", currency: "USD" });
        var cat = baseCategory({ type: "expense" });
        win.state.categories = [cat];
        win.state.transactions = [
            baseTransaction({ categoryId: cat.id, amount: 10, datetime: monthsAgoDatetime(5) })
        ];

        assertEqual(win.findAdjacentPeriodOffset("monthly", 0, -1), -5);
    });

    test("returns null when there is nothing further in that direction", async function () {
        var win = await freshApp({ period: "monthly", currency: "USD" });
        win.state.transactions = [];
        assertEqual(win.findAdjacentPeriodOffset("monthly", 0, -1), null);
        assertEqual(win.findAdjacentPeriodOffset("monthly", 0, 1), null);
    });
});

suite("main-view.js: formatCompactAmount", function () {
    test("amounts under 100 keep 2 decimals", async function () {
        var win = await freshApp({ period: "monthly", currency: "USD" });
        assertEqual(win.formatCompactAmount(12.5), "12.50");
        assertEqual(win.formatCompactAmount(0), "0.00");
    });

    test("amounts from 100 to 99999 drop decimals", async function () {
        var win = await freshApp({ period: "monthly", currency: "USD" });
        assertEqual(win.formatCompactAmount(150.75), "151");
        assertEqual(win.formatCompactAmount(99999), "99999");
    });

    test("amounts over 99999 use compact notation", async function () {
        var win = await freshApp({ period: "monthly", currency: "USD" });
        var result = win.formatCompactAmount(150000);
        assertTrue(/^150K$/i.test(result), "expected compact notation like 150K, got: " + result);
    });
});

suite("categories.js: limitToOneGrapheme", function () {
    test("keeps a single simple emoji intact", async function () {
        var win = await freshApp({ period: "monthly", currency: "USD" });
        assertEqual(win.limitToOneGrapheme("🛒"), "🛒");
    });

    test("truncates typed text after the first grapheme", async function () {
        var win = await freshApp({ period: "monthly", currency: "USD" });
        assertEqual(win.limitToOneGrapheme("🛒abc"), "🛒");
        assertEqual(win.limitToOneGrapheme("ab"), "a");
    });

    test("keeps a multi-codepoint flag emoji intact as one grapheme", async function () {
        var win = await freshApp({ period: "monthly", currency: "USD" });
        var flag = "🇷🇸";
        assertEqual(win.limitToOneGrapheme(flag), flag);
    });

    test("empty input stays empty", async function () {
        var win = await freshApp({ period: "monthly", currency: "USD" });
        assertEqual(win.limitToOneGrapheme(""), "");
    });
});

suite("transaction.js: sortedTransactionCategories (frecency)", function () {
    test("any usage ranks above none, zero-usage ties broken by name", async function () {
        var win = await freshApp({ period: "monthly", currency: "USD" });
        var zebra = baseCategory({ id: "a", name: "Zebra" });
        var apple = baseCategory({ id: "b", name: "Apple" });
        var mango = baseCategory({ id: "c", name: "Mango" });
        win.state.categories = [zebra, apple, mango];
        win.state.transactions = [
            baseTransaction({ categoryId: apple.id, amount: 1, datetime: nowDatetime() }),
            baseTransaction({ categoryId: apple.id, amount: 1, datetime: nowDatetime() })
        ];

        var sorted = win.sortedTransactionCategories();
        assertEqual(sorted[0].id, apple.id, "the only category with transactions ranks first");
        assertEqual(sorted[1].id, mango.id, "zero-usage tie broken alphabetically: Mango before Zebra");
        assertEqual(sorted[2].id, zebra.id, "zero-usage tie broken alphabetically: Mango before Zebra");
    });

    test("a handful of old transactions decay below a single recent one", async function () {
        var win = await freshApp({ period: "daily", currency: "USD" });
        var recent = baseCategory({ id: "recent", name: "Recent" });
        var old = baseCategory({ id: "old", name: "Old" });
        win.state.categories = [old, recent];
        win.state.transactions = [
            baseTransaction({ categoryId: recent.id, amount: 1, datetime: nowDatetime() })
        ];
        for (var i = 0; i < 10; i++) {
            win.state.transactions.push(baseTransaction({ categoryId: old.id, amount: 1, datetime: daysAgoDatetime(10) }));
        }

        var sorted = win.sortedTransactionCategories();
        assertEqual(sorted[0].id, recent.id, "one transaction today outweighs ten from 10 half-lives ago (daily period, 1-day half-life)");
    });
});

suite("onboarding.js: guessCurrencyFromLocale", function () {
    test("always returns a code present in the curated currency list", async function () {
        var win = await freshApp(null);
        var guess = win.guessCurrencyFromLocale();
        var codes = win.CURRENCIES.map(function (c) { return c.code; });
        assertTrue(codes.indexOf(guess) !== -1, "guessed currency " + guess + " is not in CURRENCIES");
    });
});
