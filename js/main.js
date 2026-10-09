// Runs entirely in the browser. Makes no network requests of its own.
// The only persisted value is the visitor's theme choice, stored in
// their own localStorage. No cookies, no beacons, no fetch calls.
(function () {
  "use strict";

  var KEY = "theme";
  var root = document.documentElement;
  var button = document.getElementById("theme-toggle");

  function read() {
    try { return localStorage.getItem(KEY); } catch (e) { return null; }
  }
  function write(value) {
    try { localStorage.setItem(KEY, value); } catch (e) { /* storage blocked: fine */ }
  }
  function systemPrefersDark() {
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  }
  function current() {
    return root.getAttribute("data-theme") || (systemPrefersDark() ? "dark" : "light");
  }
  function apply(theme) {
    root.setAttribute("data-theme", theme);
    if (button) {
      var dark = theme === "dark";
      button.setAttribute("aria-pressed", String(dark));
      button.textContent = dark ? "light" : "dark";
    }
  }

  var saved = read();
  if (saved === "dark" || saved === "light") apply(saved);
  else if (button) apply(current());

  if (button) {
    button.addEventListener("click", function () {
      var next = current() === "dark" ? "light" : "dark";
      apply(next);
      write(next);
    });
  }
})();
