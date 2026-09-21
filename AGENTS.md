# Agent Guide

## Verify changes

Use **Node 22** (pinned in `.nvmrc` and both `package.json` `engines` fields; CI uses it too). `better-sqlite3@9.6.0` cannot compile against Node 24, so on a newer Node the Mero server tests fail to load with `ERR_DLOPEN_FAILED`.

- Mero server tests: `npm test --prefix Mero/server`
- Mero geometry tests: `npm run test:geometry --prefix Mero`
- MyOb backend tests: from `MyOb/backend`, run `uv run python -m unittest test_attachment_migration.py test_codex_provider.py test_chat_scope.py test_data_safety.py test_database_runtime.py test_entry_filters.py test_export.py test_journal_migration.py test_local_embeddings.py test_migrations.py test_name_hints.py test_note_versions.py test_openai_provider.py test_personas.py test_route_order.py test_search_modes.py test_security.py test_semantic_endpoints.py test_space_isolation.py test_tenant_isolation.py`
- Diagnostic frontend tests: `npm test --prefix MyOb/My_Obsidian_FrontEnd-main`
- Builds: `npm run build --prefix Mero` and `npm run build --prefix MyOb/My_Obsidian_FrontEnd-main`
- Lint: `npm run lint --prefix MyOb/My_Obsidian_FrontEnd-main` (no lint script is configured for Mero or the Python backend).

CI lives in `.github/workflows/ci.yml` and must stay green. Never commit with `--no-verify`.
