/* Form Filler – remembers the element under the last right-click so "Fill this form/field" knows the target. */
document.addEventListener(
  'contextmenu',
  (e) => {
    globalThis.__ffContextTarget = (e.composedPath && e.composedPath()[0]) || e.target;
  },
  true
);
