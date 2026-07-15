FROM node:24

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm@10 --quiet

# Copy workspace config and lock file for dependency resolution
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./

# Copy all package.json files so pnpm can resolve the workspace graph
COPY lib/api-zod/package.json      ./lib/api-zod/
COPY lib/db/package.json           ./lib/db/
COPY lib/triage-engine/package.json ./lib/triage-engine/
COPY lib/pane-engine/package.json  ./lib/pane-engine/
COPY artifacts/api-server/package.json ./artifacts/api-server/

# Install only what the api-server and its workspace deps need
RUN pnpm install --no-frozen-lockfile --filter @workspace/api-server...

# Copy source
COPY lib/api-zod/      ./lib/api-zod/
COPY lib/db/           ./lib/db/
COPY lib/triage-engine/ ./lib/triage-engine/
COPY lib/pane-engine/  ./lib/pane-engine/
COPY artifacts/api-server/ ./artifacts/api-server/

# Build
RUN cd artifacts/api-server && node build.mjs

EXPOSE 10000

CMD ["node", "--enable-source-maps", "artifacts/api-server/dist/index.mjs"]
