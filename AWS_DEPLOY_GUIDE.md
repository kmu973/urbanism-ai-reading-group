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


---

## Managing Live Data & Updates

Since your app modifies data files (`votingResults.json`, `readingList.json`) directly on the server when people vote, you need to be careful when updating the code to avoid overwriting or losing this data.

### Workflow: "Pull Data First, Then Push Code"

**Step 1: Download Live Data to Local (Backup)**
Before you push new code, download the latest voting results **and member data** from the server to your laptop.
This command grabs EVERYTHING in the `data/` folder, including:
*   `votingResults.json` (Past votes)
*   `readingList.json` (Current proposals & **Attendance Status**)
*   `members.json` (User profiles)

Run this in your **LOCAL TERMINAL (Git Bash or similar)**, NOT on the server:

```bash
# 1. Download the data folder content
scp -i "C:\Users\minth\MIT Dropbox\CDDL\RSC_2026_UrbanismAI_Reading_Group\urban-ai-key.pem" -r ec2-user@54.173.11.40:/var/www/urban-ai-reading/data/* ./data/

# 2. Check what changed
git status
# (You should see modified JSON files in data/)
```

**Step 2: Commit the Live Data**
Now that you have the latest votes on your laptop, save them to your local git history.

```bash
git add data/
git commit -m "Sync: Downloaded live voting data from production"
```

**Step 3: Make Your Code Changes**
Now you can edit your code (e.g., `server.js`, `voting.js`, etc.) safely effectively "on top" of the latest data.
Once done:

```bash
git add .
git commit -m "Feature: Updated voting deadline logic"
git push
```

**Step 4: Update the Server**
Now SSH into the server and pull the updates. Since you already downloaded and committed the data differences in Step 2, git on the server should be happy to fast-forward.

```bash
# 1. SSH in
ssh -i "C:\Users\minth\MIT Dropbox\CDDL\RSC_2026_UrbanismAI_Reading_Group\urban-ai-key.pem" ec2-user@54.173.11.40

# 2. Go to app folder
cd /var/www/urban-ai-reading

# 3. Pull (This might ask you to stash local changes if votes happened WHILE you were working)
git pull

# 4. Restart App
pm2 restart urban-ai-server
```

> **Troubleshooting: "Local changes would be overwritten by merge"**
> If people voted *while* you were working between Step 1 and Step 4, `git pull` on the server might complain.
> In that case, on the server run:
> `git stash` (hides the very latest votes temporarily)
> `git pull` (gets your code)
> `git stash pop` (re-applies the latest votes on top)
> *Note: This is rare if traffic is low.*
