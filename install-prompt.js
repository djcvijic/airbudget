// Encourages installing to the home screen. Beyond convenience, this is
// what exempts the app from iOS Safari's 7-day storage-eviction timer, so
// it's a data-safety nudge, not just a shortcut. Chrome/Android get a real
// install button via beforeinstallprompt; iOS has no such API at all, so
// it gets instructions instead. The banner lives outside the .screen
// system (see index.html), so it stays visible across every screen,
// including onboarding, until dismissed or installed.

var INSTALL_DISMISSED_KEY = "airbudget-install-dismissed-v1";

var installBannerEl = document.getElementById("install-banner");
var installBannerTextEl = document.getElementById("install-banner-text");
var installBannerActionButton = document.getElementById("install-banner-action-button");

var deferredInstallPrompt = null;
var isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent)
    || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

function isAppInstalled() {
    return window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
}

function updateInstallBanner() {
    if (isAppInstalled() || localStorage.getItem(INSTALL_DISMISSED_KEY)) {
        installBannerEl.style.display = "none";
        return;
    }

    if (isIOSDevice) {
        installBannerTextEl.textContent = "Install airbudget: tap the Share icon, then \"Add to Home Screen\".";
        installBannerActionButton.style.display = "none";
        installBannerEl.style.display = "flex";
    } else if (deferredInstallPrompt) {
        installBannerTextEl.textContent = "Install airbudget for quick access and offline use.";
        installBannerActionButton.style.display = "";
        installBannerEl.style.display = "flex";
    } else {
        installBannerEl.style.display = "none";
    }
}

function dismissInstallBanner() {
    localStorage.setItem(INSTALL_DISMISSED_KEY, "1");
    installBannerEl.style.display = "none";
}

function installApp() {
    if (!deferredInstallPrompt) {
        return;
    }
    deferredInstallPrompt.prompt();
    deferredInstallPrompt.userChoice.then(function () {
        deferredInstallPrompt = null;
    });
}

window.addEventListener("beforeinstallprompt", function (e) {
    e.preventDefault();
    deferredInstallPrompt = e;
    updateInstallBanner();
});

window.addEventListener("appinstalled", function () {
    deferredInstallPrompt = null;
    installBannerEl.style.display = "none";
});

updateInstallBanner();
