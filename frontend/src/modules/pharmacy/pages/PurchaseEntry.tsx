// Purchase entry now lives on the Add Stock page (manual entry, Excel upload and
// history). /pharmacy/purchase-entry redirects to /pharmacy/add-stock?tab=history;
// this module is kept so any remaining import of it still resolves.
export { default } from "./AddStock";
