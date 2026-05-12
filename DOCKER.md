# Docker Deployment Guide

## Local Testing

Build and run locally to test:

```bash
docker-compose build
docker-compose up -d
```

Then visit: `http://localhost:3000`

To stop:

```bash
docker-compose down
```

---

## Deploy to Ubuntu Server

### 1. Install Docker and Docker Compose on Ubuntu:

```bash
# Install Docker
sudo apt-get update
sudo apt-get install -y docker.io docker-compose
sudo usermod -aG docker $USER
newgrp docker

# Verify
docker --version
docker-compose --version
```

### 2. Upload your project to the server:

```bash
scp -r ./messenger-JSON-viewer username@your-server:/home/username/
ssh username@your-server
cd /home/username/messenger-JSON-viewer
```

### 3. Build and run the Docker container:

```bash
docker-compose build
docker-compose up -d
```

Check logs:

```bash
docker-compose logs -f
```

### 4. Access from your phone:

Open in mobile browser: `http://<your-server-ip>:3000`

(Find your server IP with: `hostname -I`)

---

## Container Details

- **Multi-stage build**: Optimizes image size (only production dependencies included)
- **Health check**: Automatically restarts if the app crashes
- **Port**: 3000 (configurable in docker-compose.yml)
- **Auto-restart**: Restarts unless manually stopped

---

## Useful Commands

```bash
# View running containers
docker-compose ps

# Stop the app
docker-compose stop

# Start the app
docker-compose start

# Restart
docker-compose restart

# Remove container and volume
docker-compose down

# View logs
docker-compose logs -f messenger-viewer

# Shell into running container
docker exec -it messenger-viewer sh
```

---

## Optional: Configure for External Access

If behind a router, forward port 3000 in router settings or use Nginx reverse proxy inside the container (update docker-compose.yml to add an nginx service).

## Troubleshooting

- **Port already in use?** Change port in docker-compose.yml:

  ```yaml
  ports:
    - '8080:3000' # Access on port 8080 instead
  ```

- **Out of memory?** Add limits to docker-compose.yml:

  ```yaml
  deploy:
    resources:
      limits:
        memory: 1G
  ```

- **Need to edit code on server?** Mount source volume:
  ```yaml
  volumes:
    - .:/app
  ```
  Then rebuild: `docker-compose up --build`
