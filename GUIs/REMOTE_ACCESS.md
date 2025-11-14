# Remote Access Guide

This guide explains how to run the TTM web application with the backend on one machine and access it from other devices.

## 📋 Scenarios

### Scenario 1: Backend and Frontend on Same Machine (Local Development)
**Use Case**: You're developing on your laptop
- Backend: `http://localhost:8000`
- Frontend: `http://localhost:3000`
- No special configuration needed

### Scenario 2: Backend on Remote Server, Frontend on Local Machine
**Use Case**: GPU server for processing, access from your laptop
- Backend: Remote server (e.g., `http://192.168.1.100:8000`)
- Frontend: Your laptop (`http://localhost:3000`)
- Configure frontend to point to remote backend

### Scenario 3: Both Backend and Frontend on Remote Server
**Use Case**: Cloud server, access from anywhere
- Backend: Remote server (e.g., `http://your-server.com:8000`)
- Frontend: Remote server (e.g., `http://your-server.com:3000`)
- Access via browser on any device

## 🚀 Setup Instructions

### For Scenario 2: Remote Backend, Local Frontend

#### Step 1: Start Backend on Remote Server

```bash
# SSH into your remote server
ssh user@your-server.com

# Navigate to project
cd TTM/GUIs/backend

# Install dependencies (first time only)
pip install -r requirements-backend.txt

# Start backend (accessible from network)
python app.py
```

The backend will start on `0.0.0.0:8000`, making it accessible from other machines.

#### Step 2: Configure Firewall on Remote Server

```bash
# Ubuntu/Debian
sudo ufw allow 8000/tcp
sudo ufw reload

# CentOS/RHEL
sudo firewall-cmd --permanent --add-port=8000/tcp
sudo firewall-cmd --reload

# Or with iptables
sudo iptables -A INPUT -p tcp --dport 8000 -j ACCEPT
```

#### Step 3: Find Server IP Address

```bash
# On Linux
ip addr show | grep inet
# or
hostname -I

# On macOS
ifconfig | grep inet

# Look for an address like:
# - Local network: 192.168.x.x or 10.x.x.x
# - Public IP: check with: curl ifconfig.me
```

#### Step 4: Start Frontend on Your Local Machine

```bash
# On your local laptop/desktop
cd TTM/GUIs/frontend

# Install dependencies (first time only)
npm install

# Start frontend
npm run dev
```

Open `http://localhost:3000` in your browser.

#### Step 5: Connect Frontend to Remote Backend

**Method A: Using the UI (Recommended)**

1. Click the **"🔗 Backend"** button in the toolbar (top-left)
2. Enter: `http://192.168.1.100:8000` (replace with your server's IP)
3. Click **"Test Connection"**
4. If successful, click **"Save & Apply"**

**Method B: Using Environment Variable**

```bash
cd GUIs/frontend
echo "VITE_API_URL=http://192.168.1.100:8000" > .env.local
npm run dev
```

### For Scenario 3: Both on Remote Server

#### Step 1: Start Backend

```bash
# On remote server
cd TTM/GUIs/backend
python app.py
```

#### Step 2: Start Frontend

```bash
# On remote server (new terminal or use screen/tmux)
cd TTM/GUIs/frontend
npm run dev -- --host 0.0.0.0
```

This makes the frontend accessible from other machines.

#### Step 3: Configure Firewall

```bash
sudo ufw allow 3000/tcp
sudo ufw allow 8000/tcp
```

#### Step 4: Access from Any Device

Open your browser to:
- Frontend: `http://your-server-ip:3000`
- The frontend will automatically connect to the backend at `http://your-server-ip:8000`

## 🔒 Security Considerations

### Development (Local Network)

For testing on your local network, the default configuration is fine.

### Production (Internet-Facing)

⚠️ **Do not expose the backend directly to the internet without these precautions:**

#### 1. Use HTTPS (Reverse Proxy)

Install and configure nginx or caddy:

**Nginx Configuration Example:**
```nginx
# /etc/nginx/sites-available/ttm

# Backend
server {
    listen 443 ssl;
    server_name api.yourdomain.com;
    
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    location / {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}

# Frontend
server {
    listen 443 ssl;
    server_name ttm.yourdomain.com;
    
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

#### 2. Update CORS Settings

Edit `GUIs/backend/app.py`:

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://ttm.yourdomain.com",  # Your frontend domain
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

#### 3. Add Authentication

Consider adding API key authentication or OAuth.

#### 4. Rate Limiting

Implement rate limiting to prevent abuse.

## 🛠️ Troubleshooting

### Backend Not Accessible from Other Machines

**Problem**: Can access backend locally but not from other devices

**Solutions**:
1. Check if backend is bound to `0.0.0.0` (not just `127.0.0.1`)
2. Verify firewall rules: `sudo ufw status`
3. Check if your router/network allows the connection
4. Try pinging the server: `ping server-ip`

### Frontend Can't Connect to Backend

**Problem**: "Failed to connect" or CORS errors

**Solutions**:
1. Check backend URL is correct (including `http://` prefix)
2. Test backend directly: open `http://server-ip:8000` in browser
3. Check CORS settings in backend `app.py`
4. Look at browser console (F12) for detailed error messages

### Connection Times Out

**Problem**: Request hangs or times out

**Solutions**:
1. Check server firewall: `sudo ufw status`
2. Check cloud provider security groups (AWS, GCP, Azure)
3. Verify backend is running: `curl http://localhost:8000` on server
4. Check network connectivity: `traceroute server-ip`

### "Mixed Content" Warning (HTTP/HTTPS)

**Problem**: Frontend is HTTPS but backend is HTTP

**Solution**: Set up HTTPS for backend using nginx/caddy reverse proxy

## 📊 Performance Tips

### For Remote Connections

1. **Use compression**: The backend already sends compressed responses
2. **Reduce image size**: Start with lower resolution images for faster uploads
3. **Local preprocessing**: Consider resizing images locally before upload
4. **Network**: Use wired connection for better stability

### For Multiple Users

1. **Session management**: Each browser gets its own session
2. **Resource limits**: Monitor CPU/GPU usage on backend server
3. **Scaling**: Consider using a load balancer for multiple backend instances

## 🔗 Example Network Setups

### Home Network
```
[Your Laptop]  ----WiFi---->  [Router]  ----Ethernet---->  [GPU Desktop]
Frontend:3000                              Backend:8000
```

### Cloud Setup
```
[Your Device]  ----Internet---->  [Cloud Server]
                                   ├─ Backend:8000
                                   └─ Frontend:3000
```

### Professional Setup
```
[Client Devices]  ----Internet---->  [Load Balancer/Reverse Proxy]
                                      ├─ Frontend (nginx/caddy)
                                      └─ Backend API
                                          ├─ Backend Instance 1
                                          ├─ Backend Instance 2
                                          └─ Backend Instance N
```

## 📞 Getting Help

If you encounter issues:

1. Check backend logs: Look for errors in terminal
2. Check frontend console: Press F12 in browser, check Console tab
3. Test API manually: Use `curl` or Postman to test endpoints
4. Review network: Use browser Network tab (F12) to see failed requests

For more details, see the [full documentation](README_WEB.md).
