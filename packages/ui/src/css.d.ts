// Ambient declarations so `tsc --noEmit` accepts CSS side-effect imports
// (e.g. `import "./component.css"`). Actual CSS handling is done by the
// consuming bundler (Vite). Keep this in sync with apps/web, which gets the
// same declaration from `vite/client`.
declare module "*.css";
