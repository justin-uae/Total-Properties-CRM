// Modules that show the "Import" (AI file import) button. Dependency-free so the client
// list page and the server import routes can share it. Each one needs an importer in
// lib/importers.ts.
export const IMPORTABLE_MODULES = ['clients', 'invoices', 'quotations', 'contracts', 'cheques', 'deposits', 'services-offices'];
