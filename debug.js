// Dev-only debug shortcut (option+cmd+r, wired in main.js) that fills the
// app with random state for manual testing. Its own file since it's a
// distinct feature, not part of boot sequence/event wiring.

var DEBUG_CATEGORY_POOL = [
    { emoji: "🛒", name: "Groceries" },
    { emoji: "🍔", name: "Fast Food" },
    { emoji: "☕", name: "Coffee" },
    { emoji: "🎬", name: "Entertainment" },
    { emoji: "🚗", name: "Transport" },
    { emoji: "⛽", name: "Fuel" },
    { emoji: "🏠", name: "Rent" },
    { emoji: "💡", name: "Utilities" },
    { emoji: "📱", name: "Phone" },
    { emoji: "🌐", name: "Internet" },
    { emoji: "👕", name: "Clothing" },
    { emoji: "💊", name: "Health" },
    { emoji: "🏋️", name: "Gym" },
    { emoji: "📚", name: "Books" },
    { emoji: "🎮", name: "Gaming" },
    { emoji: "✈️", name: "Travel" },
    { emoji: "🎁", name: "Gifts" },
    { emoji: "🐶", name: "Pet" },
    { emoji: "🍺", name: "Bars" },
    { emoji: "🧴", name: "Personal Care" },
    { emoji: "🎵", name: "Music" },
    { emoji: "🛠️", name: "Maintenance" }
];

var DEBUG_COMMENT_POOL = [
    "with friends",
    "monthly",
    "one-off",
    "on sale",
    "for the trip",
    "reimbursed later",
    "forgot about this one"
];

function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomDebugComment() {
    return Math.random() < 0.35 ? DEBUG_COMMENT_POOL[randomInt(0, DEBUG_COMMENT_POOL.length - 1)] : "";
}

function randomAmount(min, max) {
    return Math.round((Math.random() * (max - min) + min) * 100) / 100;
}

function randomDatetimeInRange(start, end) {
    return formatDatetimeLocal(new Date(randomInt(start.getTime(), end.getTime() - 1)));
}

function shuffled(array) {
    var copy = array.slice();
    for (var i = copy.length - 1; i > 0; i--) {
        var j = randomInt(0, i);
        var temp = copy[i];
        copy[i] = copy[j];
        copy[j] = temp;
    }
    return copy;
}

function fillRandomDebugData() {
    state = defaultState();
    state.period = "monthly";
    state.currency = "RSD";

    var picks = shuffled(DEBUG_CATEGORY_POOL).slice(0, 16);
    var incomeIndexes = shuffled(picks.map(function (p, i) { return i; })).slice(0, 2);

    state.categories = picks.map(function (pick, i) {
        var isIncome = incomeIndexes.indexOf(i) !== -1;
        return {
            id: generateId("cat"),
            emoji: pick.emoji,
            name: pick.name,
            max: randomAmount(1000, 20000),
            type: isIncome ? "income" : "expense"
        };
    });

    // Both the current period and the one before it, so period navigation
    // (prev arrow / "Back to current") has something to look at too.
    var ranges = [getPeriodRange(state.period, 0), getPeriodRange(state.period, -1)];

    state.categories.forEach(function (category) {
        var amountCeiling = (category.max != null ? category.max : 20000) * 0.6;
        ranges.forEach(function (range) {
            var count = randomInt(0, 3);
            for (var i = 0; i < count; i++) {
                var amount = randomAmount(50, amountCeiling);
                state.transactions.push({
                    id: generateId("txn"),
                    datetime: randomDatetimeInRange(range.start, range.end),
                    categoryId: category.id,
                    amount: amount,
                    comment: randomDebugComment()
                });
            }
        });
    });

    saveMeta();
    saveCategories();
    saveTransactions();
    periodOffset = 0;
    closeModals();
    boot();
    showToast("Loaded random debug data");
}
