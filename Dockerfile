FROM node:22-alpine AS web
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM python:3.12-slim
WORKDIR /app
COPY server/requirements.txt /tmp/requirements.txt
RUN pip install --no-cache-dir -r /tmp/requirements.txt
COPY --from=web /app/dist ./dist
COPY server ./server
ENV PYTHONPATH=/app/server
CMD ["gunicorn", "--bind", "0.0.0.0:8080", "--workers", "1", "wsgi:app"]
