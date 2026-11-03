// Minimal in-browser test framework. No dependencies, no build step,
// runs by opening this page over the same HTTP server as the app.

var tests = [];
var currentSuite = "";

function suite(name, fn) {
    currentSuite = name;
    fn();
    currentSuite = "";
}

function test(name, fn) {
    tests.push({ suite: currentSuite, name: name, fn: fn });
}

function assertEqual(actual, expected, message) {
    if (actual !== expected) {
        throw new Error((message ? message + ": " : "") + "expected " + JSON.stringify(expected) + ", got " + JSON.stringify(actual));
    }
}

function assertTrue(value, message) {
    if (!value) {
        throw new Error(message || ("expected truthy value, got " + JSON.stringify(value)));
    }
}

function assertNotEqual(actual, unexpected, message) {
    if (actual === unexpected) {
        throw new Error((message ? message + ": " : "") + "expected value to differ from " + JSON.stringify(unexpected));
    }
}

function assertFalse(value, message) {
    if (value) {
        throw new Error(message || ("expected falsy value, got " + JSON.stringify(value)));
    }
}

function assertClose(actual, expected, epsilon, message) {
    epsilon = epsilon || 0.001;
    if (Math.abs(actual - expected) > epsilon) {
        throw new Error((message ? message + ": " : "") + "expected " + expected + " (+/- " + epsilon + "), got " + actual);
    }
}

function assertArrayEqual(actual, expected, message) {
    assertEqual(JSON.stringify(actual), JSON.stringify(expected), message);
}

function wait(ms) {
    return new Promise(function (resolve) { setTimeout(resolve, ms); });
}

function testsMatchingGrepParams(allTests) {
    var grepTerms = new URLSearchParams(location.search).getAll("grep").map(function (s) { return s.toLowerCase(); });
    if (!grepTerms.length) {
        return allTests;
    }
    return allTests.filter(function (t) {
        var haystack = (t.suite + " " + t.name).toLowerCase();
        return grepTerms.some(function (term) { return haystack.indexOf(term) !== -1; });
    });
}

async function runTests() {
    var resultsEl = document.getElementById("results");
    var summaryEl = document.getElementById("summary");
    resultsEl.innerHTML = "";

    var toRun = testsMatchingGrepParams(tests);
    var passed = 0;
    var failed = 0;
    var lastSuite = null;

    for (var i = 0; i < toRun.length; i++) {
        var t = toRun[i];

        if (t.suite !== lastSuite) {
            lastSuite = t.suite;
            var h = document.createElement("h2");
            h.textContent = t.suite;
            resultsEl.appendChild(h);
        }

        var row = document.createElement("div");
        row.className = "test-row";

        try {
            await t.fn();
            passed++;
            row.className += " pass";
            row.textContent = "PASS  " + t.name;
        } catch (e) {
            failed++;
            row.className += " fail";
            row.textContent = "FAIL  " + t.name + " — " + e.message;
            console.error("FAIL: " + t.suite + " > " + t.name, e);
        }

        resultsEl.appendChild(row);
    }

    summaryEl.textContent = passed + " passed, " + failed + " failed, " + toRun.length + " total";
    summaryEl.className = failed > 0 ? "fail" : "pass";
    window.testRunSummary = { passed: passed, failed: failed, total: toRun.length };
}
