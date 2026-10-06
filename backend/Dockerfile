# ==========================================
# Stage 1: Build Dependencies
# ==========================================
FROM python:3.11-slim AS builder

WORKDIR /app

# Install compilation tools needed for wheel building
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Upgrade pip and install wheels to a temporary location
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir --prefix=/install -r requirements.txt

# ==========================================
# Stage 2: Final Secure Production Image
# ==========================================
FROM python:3.11-slim AS runner

WORKDIR /app

# Install ONLY essential runtime system dependencies (no gcc compiler in final image)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libmagic1 \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

# Copy pre-compiled Python packages from builder stage
COPY --from=builder /install /usr/local

# Create a non-root system user and group for security
RUN groupadd -r appgroup && useradd -r -g appgroup -s /bin/false appuser

# Copy application source code and grant safe ownership
COPY --chown=appuser:appgroup . .

# Ensure uploads and data directories exist and are writable
RUN mkdir -p /app/uploads /app/data && chown -R appuser:appgroup /app/uploads /app/data

# Switch away from root user
USER appuser

# Expose Render/Container service port
EXPOSE 8080

# Run Uvicorn with proxy headers enabled for Render / Vercel edge reverse proxies
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080", "--proxy-headers", "--forwarded-allow-ips", "*"]
