#!/usr/bin/env bash
# Copy one workspace app into a standalone folder for awesome-phone-call-agents.
# Usage: vendor-submission-app.sh <headcount|vouch> <dest-dir>
set -euo pipefail

APP="${1:?app name}"
DEST="${2:?destination directory}"
export DEST
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/apps/$APP"

if [[ ! -d "$SRC" ]]; then
  echo "missing $SRC" >&2
  exit 1
fi

rm -rf "$DEST"
mkdir -p "$DEST/src" "$DEST/vendor" "$DEST/data"

rsync -a --exclude node_modules --exclude .next --exclude '*.db' --exclude '*.db-*' \
  --exclude .env --exclude .env.local --exclude tsconfig.tsbuildinfo \
  "$SRC/src/" "$DEST/src/"

cp "$SRC/README.md" "$SRC/SAFETY.md" "$SRC/.env.example" "$DEST/"
cp "$SRC/postcss.config.mjs" "$SRC/tailwind.config.ts" "$SRC/next-env.d.ts" "$DEST/"
cp "$SRC/data/.gitkeep" "$DEST/data/"

rsync -a --exclude node_modules --exclude dist --exclude tsconfig.tsbuildinfo \
  --exclude package.json --exclude tsconfig.json \
  "$ROOT/packages/core/" "$DEST/vendor/core/"

rsync -a --exclude node_modules --exclude dist --exclude tsconfig.tsbuildinfo \
  --exclude package.json --exclude tsconfig.json --exclude out --exclude remotion.config.ts \
  "$ROOT/packages/reel/" "$DEST/vendor/reel/"

if [[ "$APP" == "headcount" ]]; then
  rsync -a --exclude node_modules --exclude dist --exclude tsconfig.tsbuildinfo \
    --exclude package.json --exclude tsconfig.json \
    "$ROOT/packages/sim/" "$DEST/vendor/sim/"
fi

if [[ "$APP" == "vouch" ]]; then
  PORT=3001
  EXTRA_SCRIPTS=""
  SIM_PATHS=""
else
  PORT=3000
  EXTRA_SCRIPTS='    "db:seed:after": "SEED_MODE=after node --import tsx src/db/seed.ts",
    "sim": "node --import tsx vendor/sim/src/index.ts",'
  SIM_PATHS='      "@caller-ai/sim/fixtures": ["./vendor/sim/src/fixtures.ts"],
      "@caller-ai/sim/types": ["./vendor/sim/src/types.ts"]'
fi

cat > "$DEST/package.json" <<EOF
{
  "name": "$APP",
  "version": "0.0.1",
  "private": true,
  "engines": {
    "node": ">=20"
  },
  "scripts": {
    "dev": "next dev --port $PORT",
    "build": "next build",
    "start": "next start --port $PORT",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "db:seed": "node --import tsx src/db/seed.ts",
$EXTRA_SCRIPTS
    "smoke": "node --import tsx vendor/core/src/smoke.ts"
  },
  "dependencies": {
    "@call-e/calle": "0.7.0",
    "@hono/node-server": "^1.19.0",
    "@remotion/google-fonts": "^4.0.355",
    "@remotion/player": "^4.0.355",
    "better-sqlite3": "^12.4.1",
    "clsx": "^2.1.1",
    "drizzle-orm": "^0.44.5",
    "hono": "^4.9.6",
    "next": "^15.5.4",
    "react": "^19.1.1",
    "react-dom": "^19.1.1",
    "remotion": "^4.0.355",
    "tailwind-merge": "^3.3.1"
  },
  "devDependencies": {
    "@types/better-sqlite3": "^7.6.13",
    "@types/node": "^22.18.0",
    "@types/react": "^19.1.12",
    "@types/react-dom": "^19.1.9",
    "autoprefixer": "^10.4.21",
    "postcss": "^8.5.6",
    "tailwindcss": "^3.4.17",
    "tsx": "^4.20.5",
    "typescript": "^5.9.2",
    "vitest": "^3.2.4"
  }
}
EOF

python3 - <<'PY'
import json, os, re
from pathlib import Path
p = Path(os.environ["DEST"]) / "package.json"
payload = json.loads(p.read_text())
# drop empty script keys if any
payload["scripts"] = {k: v for k, v in payload["scripts"].items() if v}
p.write_text(json.dumps(payload, indent=2) + "\n")
PY

if [[ -n "$SIM_PATHS" ]]; then
  PATHS_BLOCK='      "@/*": ["./src/*"],
      "@caller-ai/core": ["./vendor/core/src/index.ts"],
      "@caller-ai/core/*": ["./vendor/core/src/*"],
      "@caller-ai/reel": ["./vendor/reel/src/index.ts"],
'"$SIM_PATHS"
else
  PATHS_BLOCK='      "@/*": ["./src/*"],
      "@caller-ai/core": ["./vendor/core/src/index.ts"],
      "@caller-ai/core/*": ["./vendor/core/src/*"],
      "@caller-ai/reel": ["./vendor/reel/src/index.ts"]'
fi

cat > "$DEST/tsconfig.json" <<EOF
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "ES2022"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": true,
    "noUncheckedIndexedAccess": true,
    "noEmit": true,
    "jsx": "preserve",
    "baseUrl": ".",
    "plugins": [{ "name": "next" }],
    "paths": {
$PATHS_BLOCK
    },
    "allowJs": true,
    "incremental": true
  },
  "include": ["next-env.d.ts", "src/**/*.ts", "src/**/*.tsx", "vendor/**/*.ts", "vendor/**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
EOF

if [[ "$APP" == "headcount" ]]; then
  cat > "$DEST/next.config.ts" <<'EOF'
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const root = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  transpilePackages: ["remotion", "@remotion/player", "@remotion/google-fonts"],
  serverExternalPackages: ["better-sqlite3"],
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      "@caller-ai/core": path.join(root, "vendor/core/src"),
      "@caller-ai/reel": path.join(root, "vendor/reel/src/index.ts"),
      "@caller-ai/sim/fixtures": path.join(root, "vendor/sim/src/fixtures.ts"),
      "@caller-ai/sim/types": path.join(root, "vendor/sim/src/types.ts"),
    };
    return config;
  },
};

export default nextConfig;
EOF
else
  cat > "$DEST/next.config.ts" <<'EOF'
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const root = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  transpilePackages: ["remotion", "@remotion/player", "@remotion/google-fonts"],
  serverExternalPackages: ["better-sqlite3"],
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      "@caller-ai/core": path.join(root, "vendor/core/src"),
      "@caller-ai/reel": path.join(root, "vendor/reel/src/index.ts"),
    };
    return config;
  },
};

export default nextConfig;
EOF
fi

cat > "$DEST/vitest.config.ts" <<'EOF'
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["vendor/core/tests/**/*.test.ts"],
  },
});
EOF

cat > "$DEST/.gitignore" <<'EOF'
node_modules
.next
out
.env
.env.local
*.db
*.db-journal
*.db-wal
*.db-shm
data/*.db
tsconfig.tsbuildinfo
EOF

find "$DEST" -type f \( -name '*.md' -o -name '*.ts' -o -name '*.tsx' -o -name '*.json' -o -name '*.mjs' \) \
  -exec sed -i '' -e 's/[[:space:]]*$//' {} +

echo "vendored $APP -> $DEST"
