FROM python:3.13-slim
WORKDIR /app

# Install deps first so this layer caches independently of source changes.
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

ENV PORT=8001
EXPOSE 8001

# Shell form so ${PORT} is expanded at runtime by the shell.
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8001}"]
