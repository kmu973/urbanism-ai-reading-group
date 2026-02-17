#!/bin/bash

# 1. Update System
yum update -y
yum install -y git

# 2. Install Node.js (v20)
# Using NodeSource for Amazon Linux 2 / 2023
curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -
yum install -y nodejs

# 3. Install PM2 (Process Manager to keep app running)
npm install -g pm2

# 4. Prepare Directory
mkdir -p /var/www/urban-ai-reading
chown -R ec2-user:ec2-user /var/www/urban-ai-reading

# 5. Output Success Message
echo "--------------------------------------------------"
echo " SUCCESS! Node.js & Environment Configured."
echo "--------------------------------------------------"
echo "Next Steps for you (SSH in):"
echo "1. cd /var/www/urban-ai-reading"
echo "2. git clone <YOUR_REPO_URL> ."
echo "3. npm install"
echo "4. nano .env (Paste your secrets)"
echo "5. pm2 start server.js --name urban-ai-server"
echo "6. pm2 save"
echo "7. pm2 startup"
