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
