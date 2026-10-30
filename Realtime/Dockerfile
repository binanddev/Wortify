FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts
COPY --chown=node:node src ./src
USER node
ENV NODE_ENV=production
EXPOSE 8787
CMD ["node", "src/main.js"]
