https://smyrnatools.com

## Supabase CLI in WebStorm

Install the CLI (macOS)

```bash
brew install supabase/tap/supabase
```

or

```bash
npm i -g supabase
```

Docker is required for local dev. Install and start Docker Desktop before running start.

Usage in this project

```bash
npm run supabase:version
npm run supabase:login
npm run supabase:init
npm run supabase:start
npm run supabase:status
npm run supabase:stop
npm run supabase:db:reset
```

WebStorm

- Run the above via the npm tool window or create Run Configurations from these npm scripts.
- If WebStorm can’t find the binary, the wrapper tries common paths and falls back to npx. You can set SUPABASE_BIN to
  an absolute path if needed.

Wrapper details

- scripts/supabase.js locates the binary at /opt/homebrew/bin, /usr/local/bin, PATH, or npm global bin; otherwise it
  runs via npx supabase.
- All npm scripts call this wrapper so they work reliably inside WebStorm.
