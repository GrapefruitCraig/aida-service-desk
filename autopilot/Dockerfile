FROM node:20-slim

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY src ./src

ENV NODE_ENV=production
# Mount a persistent volume here — holds scheduler state and run history
ENV DATA_DIR=/data
VOLUME /data

EXPOSE 3002
CMD ["node", "src/index.js"]
