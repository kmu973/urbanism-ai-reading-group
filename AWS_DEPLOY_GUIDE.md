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
5.  Fill in the new row:
    *   Type: **Custom TCP**
    *   Port range: `3000`
    *   Source: `0.0.0.0/0` (Anywhere)
    *   *Why? This opens the door for your Node.js app.*

> **Missed this step?**
> If your instance is already running (you are looking at the "Instance Summary" page):
> 1. Click the **"Security"** tab (bottom half of the screen).
> 2. Click the **Security Group ID** (blue link, looks like `sg-0123...`).
> 3. On the new page, click **"Edit inbound rules"**.
> 4. Click **"Add rule"** -> Type: Custom TCP, Port: 3000, Source: 0.0.0.0/0 -> **Save rules**.

## Step 4: Automate Setup
1.  Scroll down to **Advanced details**.
2.  Find the box **"User data"** (at the very bottom).
3.  Paste the contents of `aws_setup.sh` (attached) into this box.
    *   *This script forces the server to auto-install Node.js and Git when it turns on.*

## Step 5: Login & Deploy
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
    git clone https://github.com/YOUR_USERNAME/UrbanAIReading.git .
    npm install
    
    # Create your .env file
    nano .env
    # (Paste your GOOGLE_CLIENT_ID and SECRET here, then Ctrl+O, Enter, Ctrl+X)

    # Start the server forever
    pm2 start server.js --name urban-ai-server
    ```

## Step 6: Access
Go to `http://<YOUR_PUBLIC_IP>:3000` in your browser. Your app is live!
