FROM node:22-slim

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --production

COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

CMD ["node", "dist/index.js"]
