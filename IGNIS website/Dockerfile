FROM node:22-alpine

ENV NODE_ENV=production \
    PORT=8765 \
    HOST=0.0.0.0

WORKDIR /srv/web

COPY . .

USER node

EXPOSE 8765

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8765/ >/dev/null || exit 1

CMD ["node", "server/llm-proxy.js"]
