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
RUN mkdir -p generated_reports/bautagesberichte \
    && mkdir -p generated_reports/regieberichte \
    && mkdir -p onedrive_shared \
    && mkdir -p photos \
    && mkdir -p db \
    && chown -R node:node /app

# Wechsle zu non-root user
USER node

EXPOSE 4055


CMD ["npm", "start"]