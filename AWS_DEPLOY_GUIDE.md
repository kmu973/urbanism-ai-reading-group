# AWS EC2 Deployment Guide (Free Tier)

This guide will help you launch a free server on AWS to host your application.

## Prerequisites
1.  An AWS Account (aws.amazon.com).
2.  Your Code pushed to GitHub.

## Step 1: Push Code to GitHub
Before you can deploy, your code needs to be on GitHub.
1.  Create a new repository at **[github.com/new](https://github.com/new)** named `UrbanAIReading`.
2.  Open your **local terminal** (VS Code) and run:
    ```bash
    git init
    git add .
    git commit -m "Ready for deploy"
    git branch -M main
    # Replace YOUR_USERNAME below
    git remote add origin https://github.com/YOUR_USERNAME/UrbanAIReading.git
    git push -u origin main
    ```

## Step 2: Launch "Virtual Machine" (EC2)
1.  Log in to the **AWS Console**.
2.  Search for **EC2** and click "Launch Instance".
3.  **Name**: `UrbanAIReading-Server`
4.  **OS Image**: Choose **Amazon Linux 2023** (Free Tier Eligible).
5.  **Instance Type**: Choose **t2.micro** or **t3.micro** (Free Tier Eligible).
6.  **Key Pair**:
    *   Click "Create new key pair".
    *   Name it `urban-ai-key`.
    *   Download the `.pem` file. **Keep this safe!**

## Step 3: Network Settings (Important!)
1.  Find the **"Network settings"** section (usually the 4th big box down).
2.  **CRITICAL**: Click the **"Edit"** button in the **top-right corner** of the "Network settings" box.
    *   *The box will expand to show more options.*
3.  Scroll down inside this box to **"Inbound security group rules"**.
4.  Click the **"Add security group rule"** button.
5.  Add **THREE SEPARATE RULES**:
    *   **Rule 1**: Type: `Custom TCP` -> Port: `3000` -> Source: `0.0.0.0/0`
    *   **Rule 2**: Type: `HTTP` (80) -> Source: `0.0.0.0/0`
    *   **Rule 3**: Type: `HTTPS` (443) -> Source: `0.0.0.0/0`
    *   *Why? 3000 is for your app, 80/443 are for the SSL certificate.*

> **Missed this step?**
> If your instance is already running (you are looking at the "Instance Summary" page):
> 1. Click the **"Security"** tab (bottom half of the screen).
> 2. Click the **Security Group ID** (blue link, looks like `sg-0123...`).
> 3. On the new page, click **"Edit inbound rules"**.
> 4. Click **"Add rule"** -> Type: Custom TCP, Port: 3000, Source: 0.0.0.0/0 -> **Save rules**.

## Step 4: Configure Server (Run these commands after SSH login)
Once you are logged in (Step 5 below), paste these blocks one by one:

```bash
# 1. Update system & install git
sudo yum update -y
sudo yum install -y git

# 2. Install Node.js v20
curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
sudo yum install -y nodejs

# 3. Install PM2 (Process Manager)
sudo npm install -g pm2

# 4. Create the directory & set permissions
sudo mkdir -p /var/www/urban-ai-reading
sudo chown -R ec2-user:ec2-user /var/www/urban-ai-reading

# 5. Navigate to the directory
cd /var/www/urban-ai-reading
```

### Phase 3: Configure HTTPS (Run these commands)

**1. Create Nginx Config**
Copy and paste this entire block into your terminal to point your domain to your app:

```bash
sudo tee /etc/nginx/conf.d/urban-ai.conf <<EOF
server {
    listen 80;
    server_name urbanism-ai-reading.duckdns.org;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF
```

**2. Restart Nginx**
```bash
sudo systemctl restart nginx
```

**3. Get Certificate**
```bash
sudo certbot --nginx -d urbanism-ai-reading.duckdns.org
```
*   Follow the prompts (Enter email, Agree to Terms).
*   It should say "Congratulations!" at the end.

**4. Check it out!**
Go to `https://urbanism-ai-reading.duckdns.org`

1.  Click **Launch Instance**.
2.  Wait 2-3 minutes for it to say "Running".
3.  Click the instance and look for its **Public IPv4 address**.
4.  Open your terminal on your computer (where the key file is).
5.  Run:
    ```bash
    ssh -i "C:\Users\minth\MIT Dropbox\CDDL\RSC_2026_UrbanismAI_Reading_Group\urban-ai-key.pem" ec2-user@54.173.11.40
    ```
6.  Once logged in:
    ```bash
    cd /var/www/urban-ai-reading
    git clone https://github.com/kmu973/urbanism-ai-reading-group.git .
    npm install
    
    # Create your .env file
    nano .env
    # (Paste your GOOGLE_CLIENT_ID and SECRET here, then Ctrl+O, Enter, Ctrl+X)

    # Start the server forever
    pm2 start server.js --name urban-ai-server
    ```

## Step 6: Access
Go to `https://urbanism-ai-reading.duckdns.org` in your browser. Your app is live!

---

## How to Update Your App (When you change code)
When you make changes on your laptop in the future, follow this simple loop:

**1. On Laptop (VS Code):**
```bash
git add .
git commit -m "New features"
git push
```

**2. On Server (EC2 Terminal):**
```bash
# Go to folder
cd /var/www/urban-ai-reading

# Pull new code
git pull

# Restart app to see changes
pm2 restart urban-ai-server
```
Done! Changes are live instantly.
