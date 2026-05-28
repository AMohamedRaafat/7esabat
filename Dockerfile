FROM ghcr.io/puppeteer/puppeteer:latest

USER root

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# Ensure data directory exists and has correct permissions
RUN mkdir -p حسابات && chown -R pptruser:pptruser /app

USER pptruser

EXPOSE 3000
CMD ["npm", "run", "dev"]
