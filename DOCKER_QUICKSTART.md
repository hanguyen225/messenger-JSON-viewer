# Quick Start - Docker Deployment

## For Windows (Local Testing)

```bash
# 1. Put your Messenger export in /home/admh3/ffs/messages

# 2. Start with Docker Compose
docker-compose up -d

# 3. Open browser
http://localhost:3000
```

## For Ubuntu Server

```bash
# 1. SSH to server
ssh user@ubuntu-server

# 2. Copy this repo
git clone <repo-url> messenger-viewer
cd messenger-viewer

# 3. Copy your archive (from Windows PowerShell):
# scp -r "C:\messenger\archive" user@ubuntu-server:/home/admh3/ffs/messages

# 4. Start
docker-compose up -d

# 5. Access from any device on network
http://ubuntu-server-ip:3000
```

See [DOCKER_DEPLOYMENT.md](DOCKER_DEPLOYMENT.md) for full guide.
