FROM node:24-bookworm-slim
WORKDIR /workspace
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/domain/package.json packages/domain/package.json
RUN npm ci --no-audit --no-fund
COPY tsconfig.base.json ./
COPY apps/web apps/web
COPY packages/domain packages/domain
CMD ["npm", "run", "dev", "--workspace", "@topologia-new/web"]
