FROM node:22-alpine
WORKDIR /app
COPY frontend-react/scripts/backend-monitor.mjs ./backend-monitor.mjs
RUN mkdir /state && chown node:node /state
USER node
ENV NODE_ENV=production MONITOR_STATE_FILE=/state/checks.json
CMD ["node", "backend-monitor.mjs"]
