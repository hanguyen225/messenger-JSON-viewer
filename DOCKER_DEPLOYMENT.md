# Docker Deployment Guide

## Prerequisites

- Docker installed
- Docker Compose installed (optional, but recommended)
- Facebook Messenger archive exported as JSON

## Local Development with Docker

### Build the image:

```bash
docker build -t messenger-viewer .
```

### Run with local archive (Windows):

```bash
docker run -p 3000:3000 \
  -v /home/admh3/ffs/messages:/app/archive \
  -e ARCHIVE_PATH=/app/archive \
  messenger-viewer
```

### Or with Docker Compose (easier):

```bash
# Put your exported files in /home/admh3/ffs/messages

# Start the container
docker-compose up -d

# View logs
docker-compose logs -f messenger-viewer

# Stop the container
docker-compose down
```

## Ubuntu Server Deployment

### 1. Transfer your messenger archive to the server:

```bash
# From Windows (PowerShell):
scp -r "C:\path\to\messenger\archive" user@ubuntu-server:/home/user/messenger-archive

# Or use WinSCP/FileZilla for GUI
```

### 2. SSH into Ubuntu server:

```bash
ssh user@ubuntu-server
```

### 3. Install Docker and Docker Compose (if not already installed):

```bash
# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/download/v2.20.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

### 4. Clone the repository:

```bash
cd /home/user
git clone <repository-url> messenger-viewer
cd messenger-viewer
```

### 5. Update docker-compose.yml for server:

The default compose file mounts `/home/admh3/ffs/messages` automatically.
If you need a different server folder, edit the bind mount in `docker-compose.yml`.

### 6. Start the container:

```bash
docker-compose up -d

# View logs
docker-compose logs -f messenger-viewer
```

### 7. Access the app:

- Local network: `http://ubuntu-server-ip:3000`
- With SSH tunnel: `ssh -L 3000:localhost:3000 user@ubuntu-server`
  - Then access: `http://localhost:3000`

## Environment Variables

- `ARCHIVE_PATH`: Path to messenger archive inside container (default: `/app/archive`)
- `NODE_ENV`: Set to `production` for optimized builds
- `NEXT_TELEMETRY_DISABLED`: Set to `1` to disable Next.js telemetry

## Volume Mounting

The container expects your messenger archive at `/app/archive` inside the container.
By default, compose maps `/home/admh3/ffs/messages` on the host to that path.

### Ubuntu example:

```bash
# If your archive is at a different path, change the compose bind mount first
docker-compose up -d
```

Or manually specify in docker-compose.yml:

```yaml
volumes:
  - /home/admh3/ffs/messages:/app/archive
```

## Updating the app

### Windows/Local:

```bash
# Pull latest code
git pull

# Rebuild container
docker-compose build --no-cache

# Restart
docker-compose up -d
```

### Ubuntu Server:

```bash
# SSH into server
ssh user@ubuntu-server

# Navigate to app directory
cd /home/user/messenger-viewer

# Pull latest code
git pull

# Rebuild and restart
docker-compose build --no-cache
docker-compose up -d
```

## Troubleshooting

### Container won't start:

```bash
docker-compose logs messenger-viewer
```

### Archive not found:

- Ensure volume is mounted correctly
- Verify path exists on host: `ls -la /home/user/messenger-archive`
- Check archive contains JSON files

### Port 3000 already in use:

Edit docker-compose.yml and change port mapping:

```yaml
ports:
  - '8080:3000' # Access on http://localhost:8080
```

### Permission issues:

```bash
# Ensure files are readable
chmod -R 755 /home/user/messenger-archive
```

## Optional: Nginx Reverse Proxy (Ubuntu)

For production access without port numbers:

```yaml
version: '3.8'
services:
  messenger-viewer:
    # ... existing config ...

  nginx:
    image: nginx:alpine
    ports:
      - '80:80'
      - '443:443'
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
    depends_on:
      - messenger-viewer
```

## Auto-start on Ubuntu boot:

```bash
# Enable the service to start on boot
sudo systemctl enable docker

# Create a systemd service for docker-compose
sudo tee /etc/systemd/system/messenger-viewer.service > /dev/null <<EOF
[Unit]
Description=Messenger Viewer
After=docker.service
Requires=docker.service

[Service]
WorkingDirectory=/home/user/messenger-viewer
ExecStart=/usr/local/bin/docker-compose up
ExecStop=/usr/local/bin/docker-compose down
Restart=always

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable messenger-viewer
sudo systemctl start messenger-viewer
```

## File Structure

```
messenger-viewer/
├── Dockerfile
├── docker-compose.yml
├── archive/              # Mount point for messenger data
├── src/
├── public/
├── package.json
└── ...
```
