/**
 * Stands in for the `server-only` package under Vitest.
 *
 * That package deliberately throws when bundled for the client. Vitest resolves
 * its browser entry even though tests run in node, so importing any module that
 * guards itself with `import "server-only"` would fail before a single test
 * ran. Aliased in vitest.config.ts; never used by the app itself.
 */
export {};
