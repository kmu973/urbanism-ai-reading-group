# How to Update Your App

When you make changes to the code on your laptop, use this guide to push them live.

## 1. On Your Laptop (VS Code)
Save your changes and run these commands in your VS Code terminal:

```bash
# 1. Stage all changes
git add .

# 2. Commit them (change message as needed)
git commit -m "Update: Describe your changes here"

# 3. Push to GitHub
git push
```

## 2. On The Server (EC2)
SSH into your server (using the command from `AWS_DEPLOY_GUIDE.md`), then run:

```bash
# 1. Go to the app folder
cd /var/www/urban-ai-reading

# 2. Pull the new code from GitHub
git pull

# 3. Re-install dependencies (only needed if you added new packages)
npm install

# 4. Restart the app to apply changes
pm2 restart urban-ai-server

# 5. Check if it's running smoothly
pm2 status
```

Your changes are now live at: https://urbanism-ai-reading.duckdns.org
