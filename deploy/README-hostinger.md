# Hostinger CI/CD

Flow:

`git push` -> GitHub Actions -> `npm run build` -> Docker image push -> SSH to Hostinger -> `docker compose pull` -> `docker compose up -d`.

One-time VPS setup:

```bash
sudo apt update
sudo apt install -y docker.io docker-compose-plugin nginx
sudo systemctl enable --now docker

sudo mkdir -p /opt/travelcrm-frontend
sudo cp deploy/hostinger.compose.env.example /opt/travelcrm-frontend/.env
sudo nano /opt/travelcrm-frontend/.env
sudo chmod 600 /opt/travelcrm-frontend/.env
```

GitHub secrets:

- `DOCKERHUB_USERNAME`
- `DOCKERHUB_TOKEN`
- `HOSTINGER_HOST`
- `HOSTINGER_USER`
- `HOSTINGER_SSH_KEY`
- `HOSTINGER_PORT` optional, defaults to `22`
- `HOSTINGER_KNOWN_HOSTS` optional

GitHub variables:

- `VITE_API_URL`, for example `https://api.mytripsafar.com/api`
- `HOSTINGER_FE_APP_DIR` optional, defaults to `/opt/travelcrm-frontend`

nginx should proxy the frontend domain to `http://127.0.0.1:5173`.
Use `deploy/nginx-frontend-docker.conf` for the SPA vhost, and keep the backend/API
vhost on `api.mytripsafar.com` pointed at `http://127.0.0.1:8080`.
