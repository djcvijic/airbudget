// Reusable page behavior. No app-specific dependency.

var modalOverlay = document.getElementById("modal-overlay");

function openModal(modal) {
    modalOverlay.classList.remove("hidden");
    modal.classList.remove("hidden");
}

function closeModals() {
    modalOverlay.classList.add("hidden");
    document.querySelectorAll(".modal").forEach(function (modal) {
        modal.classList.add("hidden");
    });
}

var toastEl = document.getElementById("toast");
var toastTimer = null;

function showToast(message) {
    toastEl.textContent = message;
    toastEl.classList.add("visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
        toastEl.classList.remove("visible");
    }, 2000);
}

// Shared by every screen that edits state in place and must not lose it to
// an accidental Back/nav click: hasChangesFn decides dirtiness, modalEl is
// that screen's own "Unapplied changes" confirm modal. Calls openModal()
// only inside goFrom(), which only ever runs from a click handler, long
// after state.js has loaded — so this file itself can load before state.js
// even though it references a global state.js defines.
function createUnsavedGuard(hasChangesFn, modalEl) {
    var pendingNavigation = null;

    return {
        goFrom: function (screenEl, navigateFn) {
            if (!screenEl.classList.contains("active") || !hasChangesFn()) {
                navigateFn();
                return;
            }
            pendingNavigation = navigateFn;
            openModal(modalEl);
        },
        resolvePending: function (fallbackNavigateFn) {
            var navigateFn = pendingNavigation || fallbackNavigateFn;
            pendingNavigation = null;
            navigateFn();
        },
        clearPending: function () {
            pendingNavigation = null;
        }
    };
}

// Press-and-hold confirm for actions too destructive for a plain click.
// ?testMode=1 skips the hold and confirms immediately, so tests don't have
// to wait it out.
function createHoldToConfirm(buttonEl, modalEl, onConfirm, holdMs) {
    var TEST_MODE = new URLSearchParams(location.search).has("testMode");
    holdMs = holdMs || 2000;
    var holdTimer = null;

    function start() {
        if (TEST_MODE) {
            onConfirm();
            return;
        }

        buttonEl.classList.add("holding");
        holdTimer = setTimeout(function () {
            buttonEl.classList.remove("holding");
            // Guard against a stray fire after the modal was already dismissed
            // (close button, overlay click, Escape) while the hold was pending.
            if (modalEl.classList.contains("hidden")) {
                return;
            }
            onConfirm();
        }, holdMs);
    }

    function cancel() {
        clearTimeout(holdTimer);
        buttonEl.classList.remove("holding");
    }

    buttonEl.addEventListener("mousedown", start);
    buttonEl.addEventListener("touchstart", start);
    buttonEl.addEventListener("mouseup", cancel);
    buttonEl.addEventListener("mouseleave", cancel);
    buttonEl.addEventListener("touchend", cancel);
    buttonEl.addEventListener("contextmenu", function (e) {
        e.preventDefault();
    });
}

function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
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

function pad2(n) {
    return n < 10 ? "0" + n : "" + n;
}

function formatDateOnly(date) {
    return date.getFullYear() + "-" + pad2(date.getMonth() + 1) + "-" + pad2(date.getDate());
}

// A native date input's own value is "YYYY-MM-DD"; parsing that directly
// via `new Date(string)` reads it as UTC, which can roll it back a day in
// negative-UTC timezones. Parse the components explicitly instead.
function parseDateOnly(value) {
    var parts = value.split("-");
    return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
}

function formatDayHeader(date) {
    return date.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
}

function exportJSON(data, filenamePrefix) {
    var blob = new Blob([JSON.stringify(data)], { type: "application/json" });
    var url = URL.createObjectURL(blob);

    var link = document.createElement("a");
    link.href = url;
    link.download = filenamePrefix + "-" + formatDateOnly(new Date()) + ".json";
    link.click();

    URL.revokeObjectURL(url);
}

// Clears fileInput either way, so picking the same file again still fires change.
function importJSONFile(fileInput, validate, invalidMessage, onSuccess) {
    var file = fileInput.files[0];
    fileInput.value = "";
    if (!file) {
        return;
    }

    var reader = new FileReader();
    reader.onload = function () {
        var parsed;
        try {
            parsed = JSON.parse(reader.result);
        } catch (e) {
            showToast("That file isn't valid JSON");
            return;
        }

        if (!validate(parsed)) {
            showToast(invalidMessage);
            return;
        }

        onSuccess(parsed);
    };
    reader.onerror = function () {
        showToast("Couldn't read that file");
    };
    reader.readAsText(file);
}

// Wires the debug-data hotkey (option+cmd+R) and Escape-to-dismiss for the
// shared modal overlay. onDebugHotkey/dismissModals are each app's own,
// since dismissModals also clears that app's pending unsaved-guard/delete
// state before closing the modal.
function wireGlobalShortcuts(onDebugHotkey, dismissModals) {
    document.addEventListener("keydown", function (e) {
        if (e.altKey && e.metaKey && (e.code === "KeyR" || e.key.toLowerCase() === "r")) {
            e.preventDefault();
            onDebugHotkey();
            return;
        }

        if (e.key === "Escape" && !modalOverlay.classList.contains("hidden")) {
            dismissModals();
        }
    });
}

// Exempts the app from iOS Safari's 7-day storage-eviction timer, not just
// a convenience. Chrome/Android get a real install button via
// beforeinstallprompt; iOS has no such API, so it gets instructions instead.
// Prepended outside the .screen system, so it stays visible across every
// screen, including onboarding, until dismissed or installed.
function initInstallPrompt(appName) {
    var DISMISSED_KEY = "install-banner-dismissed";
    var isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent)
        || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    var deferredPrompt = null;

    var bannerEl = document.createElement("div");
    bannerEl.className = "banner";

    var textEl = document.createElement("span");
    textEl.className = "banner-text";

    var actionButton = document.createElement("button");
    actionButton.type = "button";
    actionButton.className = "btn btn-text banner-action";
    actionButton.textContent = "Install";

    var dismissButton = document.createElement("button");
    dismissButton.type = "button";
    dismissButton.className = "btn btn-text banner-dismiss";
    dismissButton.setAttribute("aria-label", "Dismiss install banner");

    var dismissIcon = document.createElement("i");
    dismissIcon.className = "fa-solid fa-xmark";
    dismissButton.appendChild(dismissIcon);

    bannerEl.appendChild(textEl);
    bannerEl.appendChild(actionButton);
    bannerEl.appendChild(dismissButton);
    document.querySelector(".app").prepend(bannerEl);

    function isAppInstalled() {
        return window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
    }

    function updateBanner() {
        if (isAppInstalled() || localStorage.getItem(DISMISSED_KEY)) {
            bannerEl.style.display = "none";
            return;
        }

        if (isIOSDevice) {
            textEl.textContent = "Install " + appName + ": tap the Share icon, then \"Add to Home Screen\".";
            actionButton.style.display = "none";
            bannerEl.style.display = "flex";
        } else if (deferredPrompt) {
            textEl.textContent = "Install " + appName + " for quick access and offline use.";
            actionButton.style.display = "";
            bannerEl.style.display = "flex";
        } else {
            bannerEl.style.display = "none";
        }
    }

    actionButton.addEventListener("click", function () {
        if (!deferredPrompt) {
            return;
        }
        deferredPrompt.prompt();
        deferredPrompt.userChoice.then(function () {
            deferredPrompt = null;
        });
    });

    dismissButton.addEventListener("click", function () {
        localStorage.setItem(DISMISSED_KEY, "1");
        bannerEl.style.display = "none";
    });

    window.addEventListener("beforeinstallprompt", function (e) {
        e.preventDefault();
        deferredPrompt = e;
        updateBanner();
    });

    window.addEventListener("appinstalled", function () {
        deferredPrompt = null;
        bannerEl.style.display = "none";
    });

    updateBanner();
}

// Toggling "collapsed" here drives theme.css's chevron-rotate/body-collapse
// animation. Callers append their own item rows into the returned body.
function buildCollapsibleGroup(title, trailingEl, collapsed, elementId) {
    var groupEl = document.createElement("div");
    groupEl.className = "collapsible-group" + (collapsed ? " collapsed" : "");
    if (elementId) {
        groupEl.id = elementId;
    }

    var header = document.createElement("button");
    header.type = "button";
    header.className = "collapsible-group-header";
    header.addEventListener("click", function () {
        groupEl.classList.toggle("collapsed");
    });

    var titleEl = document.createElement("span");
    titleEl.className = "collapsible-group-title";

    var chevronEl = document.createElement("i");
    chevronEl.className = "fa-solid fa-angle-right collapsible-group-chevron";

    var titleTextEl = document.createElement("span");
    titleTextEl.textContent = title;

    titleEl.appendChild(chevronEl);
    titleEl.appendChild(titleTextEl);

    header.appendChild(titleEl);
    header.appendChild(trailingEl);

    var bodyWrapper = document.createElement("div");
    bodyWrapper.className = "collapsible-group-body";

    var body = document.createElement("div");
    body.className = "collapsible-group-body-inner";
    bodyWrapper.appendChild(body);

    groupEl.appendChild(header);
    groupEl.appendChild(bodyWrapper);

    return { el: groupEl, body: body };
}

// Shared by every native date field's overlay input and decorative display
// button: a plain click inside a date input only focuses a segment, not
// the picker, so showPicker() is needed instead.
function openNativeDatePicker(inputEl) {
    var opened = false;
    if (inputEl.showPicker) {
        try {
            inputEl.showPicker();
            opened = true;
        } catch (e) {
            // Some mobile browsers throw here even though showPicker exists
            // (e.g. treating this hidden proxy input as gesture-ineligible);
            // fall through to focus() below instead of doing nothing.
        }
    }
    if (!opened) {
        inputEl.focus();
    }
}

function setActiveNavButton(buttonId) {
    document.querySelectorAll(".bottom-nav-row .btn-text").forEach(function (b) {
        b.classList.remove("active");
    });
    if (buttonId) {
        document.getElementById(buttonId).classList.add("active");
    }
}

var bottomNavEl = document.getElementById("bottom-nav");

// Each app keeps its own showScreen(screen) wrapper around this for its own
// nav-button map, visibility check, and any extra screen-specific toggling.
function setActiveScreen(screen, navButtonIdByScreenId, isBottomNavVisibleFn) {
    document.querySelectorAll(".screen").forEach(function (s) {
        s.classList.remove("active");
    });
    screen.classList.add("active");

    var showBottomNav = isBottomNavVisibleFn();
    bottomNavEl.style.display = showBottomNav ? "" : "none";
    document.body.classList.toggle("no-bottom-nav", !showBottomNav);

    setActiveNavButton(navButtonIdByScreenId[screen.id]);

    window.scrollTo(0, 0);
}

function backToTop() {
    var toTop = document.getElementById("to-top");

    var onScroll = function () {
        if (window.scrollY > 0) {
            toTop.style.setProperty("opacity", 1);
            toTop.style.setProperty("pointer-events", "auto");
        } else {
            toTop.style.setProperty("opacity", 0);
            toTop.style.setProperty("pointer-events", "none");
        }
    };

    window.addEventListener("scroll", onScroll);

    var scrollToTop = function () {
        window.scrollTo({
            top: 0,
            left: 0,
            behavior: "smooth"
        });
    };

    toTop.addEventListener("click", scrollToTop);
}

backToTop();

// Skipped on localhost: the service worker is cache-first, so during local
// dev it would keep serving pre-edit files after every change instead of
// the fresh ones, unless CACHE_NAME is bumped on every single edit.
if (location.hostname !== "localhost" && "serviceWorker" in navigator) {
    window.addEventListener("load", function () {
        navigator.serviceWorker.register("sw.js");
    });
}

if (navigator.storage && navigator.storage.persist) {
    navigator.storage.persist();
}
