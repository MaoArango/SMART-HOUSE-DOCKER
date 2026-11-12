FROM node:22-bookworm-slim

WORKDIR /app

COPY package.json ./
COPY . .

ENV PORT=3000

EXPOSE 3000

CMD ["npm", "start"]
