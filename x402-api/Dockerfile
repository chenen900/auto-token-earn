FROM node:24-alpine
WORKDIR /app
COPY *.js *.json ./
RUN npm install --omit=dev 2>/dev/null || true
EXPOSE 3000
CMD ["node", "server.js"]
