// Categories screen: add and edit categories (no delete). Reused for
// onboarding step 2 (forced: no back/revert, requires >=1 valid category)
// and later reopen from the dashboard (edit rows in place; leaving with
// unapplied changes warns, same as the settings screen).
// Calls goToMainView() only inside a function body, so main-view.js just
// needs to load before applyCategories() runs, not before this file parses.

var categoriesScreen = document.getElementById("categories-screen");
var categoryRowsEl = document.getElementById("category-rows");
var categoriesErrorEl = document.getElementById("categories-error");
var categoriesTitleEl = document.getElementById("categories-title");
var categoriesBackButton = document.getElementById("categories-back-button");
var categoriesOnboardingBackButton = document.getElementById("categories-onboarding-back-button");
var categoriesRevertButton = document.getElementById("categories-revert-button");
var categoriesAutoCreateButton = document.getElementById("categories-auto-create-button");
var categoriesDoneButton = document.getElementById("categories-done-button");
var categoriesCloseButton = document.getElementById("categories-close-button");
var categoriesDescriptionEl = document.getElementById("categories-description");
var categoriesUnsavedModal = document.getElementById("categories-unsaved-modal");

var categoriesForced = false;
var categoriesAutoCreated = false;
var categoriesOriginalSnapshot = null;
var pendingCategoriesNavigation = null;

var categoriesDraft = createStepDraft();

// Templates for "Create automatically", added as unapplied rows the user
// can still edit or remove before Apply. Salary is the one income entry
// and stays first; the rest are common expense categories, already listed
// alphabetically here rather than sorted at use time.
var CATEGORY_TEMPLATES = [
    { emoji: "💰", name: "Salary", type: "income" },
    { emoji: "💸", name: "Bills", type: "expense" },
    { emoji: "🎉", name: "Entertainment", type: "expense" },
    { emoji: "🎁", name: "Gifts", type: "expense" },
    { emoji: "🍽️", name: "Going out", type: "expense" },
    { emoji: "🛒", name: "Groceries", type: "expense" },
    { emoji: "🌡️", name: "Healthcare", type: "expense" },
    { emoji: "🏠", name: "Home", type: "expense" },
    { emoji: "🍕", name: "Ordering in", type: "expense" },
    { emoji: "🛍️", name: "Shopping", type: "expense" },
    { emoji: "💳", name: "Subscriptions", type: "expense" },
    { emoji: "🚌", name: "Transportation", type: "expense" }
];

// Truncates to the first grapheme cluster, so a single emoji (which can
// span several UTF-16 code units, e.g. flags or ZWJ sequences) survives
// intact while anything typed after it gets dropped. Falls back to a
// crude code-point cap on browsers without Intl.Segmenter.
function limitToOneGrapheme(value) {
    if (!value) {
        return value;
    }
    if (typeof Intl !== "undefined" && Intl.Segmenter) {
        var segments = new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(value);
        var first = segments[Symbol.iterator]().next();
        return first.done ? "" : first.value.segment;
    }
    return Array.from(value).slice(0, 4).join("");
}

function buildCategoryRow(category) {
    var row = document.createElement("div");
    row.className = "category-row";
    if (category && category.id) {
        row.dataset.id = category.id;
    }
    row.dataset.type = (category && category.type === "income") ? "income" : "expense";
    row.dataset.hidden = (category && category.hidden) ? "true" : "false";

    var fields = document.createElement("div");
    fields.className = "category-row-fields";

    var emojiInput = document.createElement("input");
    emojiInput.type = "text";
    emojiInput.className = "category-row-emoji modal-input";
    emojiInput.maxLength = 20;
    emojiInput.title = "Use your device's emoji picker: Cmd+Ctrl+Space (macOS), Win+. (Windows), "
        + "or the emoji key on the iOS/Android keyboard";
    emojiInput.value = category ? category.emoji : "";
    emojiInput.addEventListener("input", function () {
        emojiInput.value = limitToOneGrapheme(emojiInput.value);
    });
    emojiInput.addEventListener("focus", function () {
        emojiInput.select();
    });

    var nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.className = "category-row-name modal-input";
    nameInput.placeholder = "Name";
    nameInput.value = category ? category.name : "";

    var maxInput = document.createElement("input");
    maxInput.type = "number";
    maxInput.className = "category-row-max modal-input";
    maxInput.min = "0";
    maxInput.step = "0.01";
    maxInput.inputMode = "decimal";
    maxInput.value = (category && category.max != null) ? category.max : "";

    fields.appendChild(emojiInput);
    fields.appendChild(nameInput);

    var typeLine = document.createElement("div");
    typeLine.className = "category-row-type-line";

    var typeRow = document.createElement("div");
    typeRow.className = "category-row-type segmented-toggle";

    var expenseButton = document.createElement("button");
    expenseButton.type = "button";
    expenseButton.className = "category-row-type-option segmented-toggle-option";
    expenseButton.textContent = "Expense";

    var incomeButton = document.createElement("button");
    incomeButton.type = "button";
    incomeButton.className = "category-row-type-option segmented-toggle-option";
    incomeButton.textContent = "Income";

    var thumb = document.createElement("div");
    thumb.className = "category-row-type-thumb segmented-toggle-thumb";

    function updateTypeSelection() {
        expenseButton.classList.toggle("selected", row.dataset.type === "expense");
        incomeButton.classList.toggle("selected", row.dataset.type === "income");
        maxInput.placeholder = row.dataset.type === "income" ? "Expected" : "Budget";
    }

    expenseButton.addEventListener("click", function () {
        row.dataset.type = "expense";
        updateTypeSelection();
    });
    incomeButton.addEventListener("click", function () {
        row.dataset.type = "income";
        updateTypeSelection();
    });
    updateTypeSelection();

    typeRow.appendChild(expenseButton);
    typeRow.appendChild(incomeButton);
    typeRow.appendChild(thumb);

    // An unapplied row (no id yet, whether a blank placeholder or a filled
    // template from "Create automatically") isn't a real category yet, so
    // it gets a delete control instead of the hide toggle a saved category
    // would have.
    var trailingButton;
    if (category && category.id) {
        trailingButton = document.createElement("button");
        trailingButton.type = "button";
        trailingButton.className = "category-row-visibility";

        var updateVisibilityButton = function () {
            var hidden = row.dataset.hidden === "true";
            trailingButton.innerHTML = hidden
                ? '<i class="fa-solid fa-eye-slash"></i>'
                : '<i class="fa-solid fa-eye"></i>';
            trailingButton.title = hidden
                ? "Hidden from transaction category picker"
                : "Visible in transaction category picker";
        };

        trailingButton.addEventListener("click", function () {
            row.dataset.hidden = row.dataset.hidden === "true" ? "false" : "true";
            updateVisibilityButton();
        });
        updateVisibilityButton();
    } else {
        trailingButton = document.createElement("button");
        trailingButton.type = "button";
        trailingButton.className = "category-row-delete";
        trailingButton.title = "Remove this category";
        trailingButton.innerHTML = '<i class="fa-solid fa-trash"></i>';
        trailingButton.addEventListener("click", function () {
            row.remove();
        });
    }

    fields.appendChild(trailingButton);

    typeLine.appendChild(typeRow);
    typeLine.appendChild(maxInput);

    row.appendChild(fields);
    row.appendChild(typeLine);
    return row;
}

function renderCategoryRows() {
    categoryRowsEl.innerHTML = "";
    state.categories.forEach(function (category) {
        categoryRowsEl.appendChild(buildCategoryRow(category));
    });
}

function addCategoryRow() {
    var row = buildCategoryRow(null);
    categoryRowsEl.appendChild(row);
    row.querySelector(".category-row-emoji").focus();
}

// Appends one row per template, alphabetically, after whatever rows are
// already there. Only usable once per visit to the screen — the button is
// removed right after, and shown again the next time the screen opens.
function createCategoriesAutomatically() {
    if (categoriesAutoCreated) {
        return;
    }
    categoriesAutoCreated = true;
    categoriesAutoCreateButton.style.display = "none";

    CATEGORY_TEMPLATES.forEach(function (template) {
        categoryRowsEl.appendChild(buildCategoryRow(template));
    });

    window.scrollTo({
        top: document.documentElement.scrollHeight,
        left: 0,
        behavior: "smooth"
    });
}

// Parses the current rows the same way applyCategories does, minus
// validation, so it can be diffed against the opening snapshot to detect
// unapplied changes. maxRaw is kept as the raw string (not parsed) so a
// snapshot taken right after rendering compares equal to itself.
function getCategoryRowsSnapshot() {
    var rows = categoryRowsEl.querySelectorAll(".category-row");
    var snapshot = [];

    rows.forEach(function (row) {
        var emoji = row.querySelector(".category-row-emoji").value.trim();
        var name = row.querySelector(".category-row-name").value.trim();
        var maxRaw = row.querySelector(".category-row-max").value;

        if (!emoji && !name && maxRaw === "") {
            return;
        }

        snapshot.push({ id: row.dataset.id || null, emoji: emoji, name: name, max: maxRaw, type: row.dataset.type, hidden: row.dataset.hidden });
    });

    return snapshot;
}

function hasUnsavedCategoriesChanges() {
    return JSON.stringify(getCategoryRowsSnapshot()) !== JSON.stringify(categoriesOriginalSnapshot);
}

// Forced (onboarding) mode always shows Back + Apply/Done, dirty or not, so
// Revert and the Done-only close button stay fixed there. Reopened mode
// instead swaps Revert + Apply for a single Done button once there's
// nothing left to revert or apply.
function updateCategoriesActionButtons() {
    if (categoriesForced) {
        categoriesRevertButton.style.display = "none";
        categoriesDoneButton.style.display = "";
        categoriesCloseButton.style.display = "none";
        return;
    }
    var dirty = hasUnsavedCategoriesChanges();
    categoriesRevertButton.style.display = dirty ? "" : "none";
    categoriesDoneButton.style.display = dirty ? "" : "none";
    categoriesCloseButton.style.display = dirty ? "none" : "";
}

// Captures the current rows (full fidelity, not just for diffing) so
// backFromCategories() can restore them if the onboarding flow returns
// here after visiting the settings step again.
function captureCategoriesDraft() {
    var rows = categoryRowsEl.querySelectorAll(".category-row");
    categoriesDraft.save([].map.call(rows, function (row) {
        var maxRaw = row.querySelector(".category-row-max").value;
        return {
            id: row.dataset.id || null,
            emoji: row.querySelector(".category-row-emoji").value,
            name: row.querySelector(".category-row-name").value,
            max: maxRaw === "" ? null : parseFloat(maxRaw),
            type: row.dataset.type,
            hidden: row.dataset.hidden === "true"
        };
    }));
}

function openCategoriesScreen(forced) {
    categoriesForced = forced;
    categoriesErrorEl.textContent = "";
    categoriesBackButton.style.display = forced ? "none" : "";
    categoriesOnboardingBackButton.style.display = forced ? "" : "none";
    categoriesAutoCreateButton.style.display = forced ? "" : "none";
    categoriesDescriptionEl.style.display = forced ? "" : "none";
    categoriesTitleEl.classList.toggle("onboarding-heading", forced);
    categoriesDoneButton.textContent = forced ? "Next" : "Apply";

    var draftRows = categoriesDraft.get();
    if (forced && draftRows) {
        categoryRowsEl.innerHTML = "";
        draftRows.forEach(function (draftCategory) {
            categoryRowsEl.appendChild(buildCategoryRow(draftCategory));
        });
        if (categoriesAutoCreated) {
            categoriesAutoCreateButton.style.display = "none";
        }
    } else if (forced && state.categories.length > 0) {
        // Returning here via goals.js's onboarding back button, after
        // categories were already applied (which clears categoriesDraft) —
        // re-render what was saved without resetting auto-create, which
        // may already have been used.
        renderCategoryRows();
        if (categoriesAutoCreated) {
            categoriesAutoCreateButton.style.display = "none";
        }
    } else {
        categoriesAutoCreated = false;
        renderCategoryRows();
    }

    categoriesOriginalSnapshot = getCategoryRowsSnapshot();
    updateCategoriesActionButtons();

    showScreen(categoriesScreen);
}

function applyCategories() {
    var rows = categoryRowsEl.querySelectorAll(".category-row");
    var updated = [];

    for (var i = 0; i < rows.length; i++) {
        var row = rows[i];
        var maxRaw = row.querySelector(".category-row-max").value;
        var emoji = row.querySelector(".category-row-emoji").value.trim();
        var name = row.querySelector(".category-row-name").value.trim();

        // Only an untouched "add category" placeholder row (no id yet) can be
        // silently skipped. A row that already has an id is an existing
        // category with transaction history; categories can't be deleted, so
        // clearing its fields must fail validation below instead of quietly
        // dropping it and orphaning its transactions.
        if (!row.dataset.id && !emoji && !name && maxRaw === "") {
            continue;
        }

        if (!emoji) {
            categoriesErrorEl.textContent = "Each category needs an emoji.";
            return;
        }

        var type = row.dataset.type === "income" ? "income" : "expense";

        var max = null;
        if (maxRaw !== "") {
            max = parseFloat(maxRaw);
            if (isNaN(max) || max < 0) {
                categoriesErrorEl.textContent = "Amount must be 0 or greater, or left blank.";
                return;
            }
        }

        updated.push({
            id: row.dataset.id || generateId("cat"),
            emoji: emoji,
            name: name,
            max: max,
            type: type,
            hidden: row.dataset.hidden === "true"
        });
    }

    if (updated.length === 0) {
        categoriesErrorEl.textContent = "Add at least one category.";
        return;
    }

    state.categories = updated;
    var wasForced = categoriesForced;
    var saved = saveCategories();
    if (saved && !wasForced) {
        showToast("Categories saved");
    }
    categoriesForced = false;
    categoriesDraft.clear();

    closeModals();
    if (wasForced) {
        // Onboarding's 3rd step, not the dashboard — goals.js loads after
        // this file, but this only runs from a click, long after boot.
        openGoalsScreen(true);
    } else {
        resolvePendingCategoriesNavigation();
    }
}

function resolvePendingCategoriesNavigation() {
    var navigateFn = pendingCategoriesNavigation || goToMainView;
    pendingCategoriesNavigation = null;
    navigateFn();
}

function revertCategories() {
    closeModals();
    resolvePendingCategoriesNavigation();
}

// Same warn-before-leaving pattern as settings; forced mode is never gated.
function goFromCategories(navigateFn) {
    if (!categoriesScreen.classList.contains("active") || categoriesForced || !hasUnsavedCategoriesChanges()) {
        navigateFn();
        return;
    }
    pendingCategoriesNavigation = navigateFn;
    openModal(categoriesUnsavedModal);
}

function backFromCategories() {
    // Onboarding's own back button returns to the first onboarding step
    // instead of the dashboard (which doesn't exist yet at that point),
    // and skips the unsaved-changes warning — same as the rest of onboarding.
    if (categoriesForced) {
        captureCategoriesDraft();
        openOnboardingScreen();
        return;
    }

    goFromCategories(goToMainView);
}

// Catches every row edit (typing, type/visibility toggles, add, delete,
// auto-create) in one place via bubbling, rather than wiring the same
// recheck into each individual row control.
categoriesScreen.addEventListener("input", updateCategoriesActionButtons);
categoriesScreen.addEventListener("click", updateCategoriesActionButtons);
