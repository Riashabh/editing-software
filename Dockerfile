FROM python:3.11-slim

# FFmpeg + Node.js (for Remotion renderer)
RUN apt-get update && apt-get install -y \
    ffmpeg \
    curl \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Python deps
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Remotion renderer
COPY remotion-renderer ./remotion-renderer
RUN cd remotion-renderer && npm install

# App code
COPY api.py main.py ./
COPY Backend ./Backend
COPY demo ./demo

RUN mkdir -p temp/clips_out

EXPOSE 8000
CMD ["uvicorn", "api:app", "--host", "0.0.0.0", "--port", "8000"]
