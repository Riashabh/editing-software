FROM python:3.11-slim

# FFmpeg + Node.js (for Remotion renderer)
RUN apt-get update && apt-get install -y \
    ffmpeg \
    curl \
    ca-certificates \
    gnupg \
    libnspr4 \
    libnss3 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libasound2 \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Python deps
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Remotion renderer
COPY remotion-renderer ./remotion-renderer
RUN cd remotion-renderer && npm install --legacy-peer-deps && npx remotion browser ensure

# App code
COPY api.py main.py ./
COPY Backend ./Backend

RUN mkdir -p temp/clips_out

EXPOSE 8000
CMD ["uvicorn", "api:app", "--host", "0.0.0.0", "--port", "8000"]
