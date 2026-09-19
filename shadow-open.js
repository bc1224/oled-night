// Runs in the page's own JavaScript world (only when the user enables the
// experimental "locked web components" option). Closed shadow roots can't be
// reached by extensions, so they are created open instead. The page still gets
// its root back from attachShadow as normal.
(function () {
  "use strict";
  const original = Element.prototype.attachShadow;
  if (original.__oledNight) return;
  const patched = function attachShadow(init) {
    return original.call(this, init && init.mode === "closed" ? { ...init, mode: "open" } : init);
  };
  patched.__oledNight = true;
  Element.prototype.attachShadow = patched;
})();
