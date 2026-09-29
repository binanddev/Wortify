FROM node:22-alpine AS build
WORKDIR /app
COPY frontend-react/package.json frontend-react/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY frontend-react ./
RUN npm run build
FROM nginx:stable-alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY deploy/nginx/frontend.conf.template /etc/nginx/templates/default.conf.template
EXPOSE 80
