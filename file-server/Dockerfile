FROM node:18-alpine

WORKDIR /app

# Installiere notwendige Pakete
RUN apk add --no-cache dumb-init

# Erstelle non-root User
RUN addgroup -g 1001 -S nodejs && adduser -S nodeuser -u 1001

# Kopiere package.json und installiere Dependencies
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Kopiere Source Code
COPY server.js ./
COPY .env* ./

# Erstelle Storage-Verzeichnisse
RUN mkdir -p storage/temp \
    && mkdir -p storage/berichte \
    && chown -R nodeuser:nodejs /app \
    && chmod -R 755 /app/storage

# Wechsle zum non-root User
USER nodeuser

# Exponiere File-Server Port
EXPOSE 3002

# Health Check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "const http = require('http'); const options = { hostname: 'localhost', port: 3002, path: '/health', method: 'GET' }; const req = http.request(options, (res) => { process.exit(res.statusCode === 200 ? 0 : 1); }); req.on('error', () => process.exit(1)); req.end();"

# Starte Server
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "server.js"]
