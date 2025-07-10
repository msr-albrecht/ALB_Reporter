FROM node:current-bullseye

WORKDIR /app

# Kopiere package.json Dateien
COPY package*.json ./

# Installiere alle Dependencies (inkl. dev) für Build
RUN npm install && npm cache clean --force

# Kopiere Source Code
COPY . .

# Erstelle TypeScript Build
RUN npm run build

# Entferne node_modules und installiere nur Production Dependencies
RUN rm -rf node_modules && npm install --omit=dev && npm cache clean --force

# Erstelle notwendige Verzeichnisse mit korrekten Berechtigungen
RUN mkdir -p onedrive_shared \
    && mkdir -p photos \
    && mkdir -p db \
    && mkdir -p /tmp/berichte_temp/bautagesberichte \
    && mkdir -p /tmp/berichte_temp/regieberichte \
    && chown -R node:node /app \
    && chown -R node:node /tmp/berichte_temp

# Wechsle zum node User für Sicherheit
USER node

# Exponiere den korrekten Port für HTTPS
EXPOSE 4055

CMD ["node", "dist/server.js"]
