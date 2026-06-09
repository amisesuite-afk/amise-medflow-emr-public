FROM node:20-alpine
RUN npm install -g pnpm@10
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @workspace/dashboard run build
RUN pnpm --filter @workspace/api-server run build
ENV NODE_ENV=production
EXPOSE 8080
CMD ["node", "--enable-source-maps", "./artifacts/api-server/dist/index.mjs"]
