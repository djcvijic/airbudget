// Reusable page behavior. No app-specific dependency.

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

function setActiveNavButton(buttonId) {
    document.querySelectorAll(".bottom-nav-row .btn-text").forEach(function (b) {
        b.classList.remove("active");
    });
    if (buttonId) {
        document.getElementById(buttonId).classList.add("active");
    }
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
