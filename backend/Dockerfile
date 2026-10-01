FROM python:3.11-slim

WORKDIR /app

# Install system dependencies if any are needed
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy and install python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy source code (main.py, config.py, parser.py, etc.)
COPY . ./backend

# Expose backend port
EXPOSE 8765

# Run backend service
CMD ["python", "-m", "backend.main"]
