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
RUN mkdir -p photos \
    && mkdir -p db \
    && mkdir -p files \
    && mkdir -p /tmp/berichte_temp/bautagesberichte \
    && mkdir -p /tmp/berichte_temp/regieberichte \
    && chmod -R 777 files \
    && chmod -R 777 /tmp/berichte_temp \
    && chown -R node:node /app

# Wechsle zum node User für Sicherheit
USER node

# Exponiere den korrekten Port für HTTPS
EXPOSE 4055

CMD ["node", "dist/server.js"]
