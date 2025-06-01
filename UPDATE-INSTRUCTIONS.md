# 🚀 How to Release Updates for Mark

Your app now has **FULL AUTOMATIC UPDATES**! Users can download and install updates with just ONE CLICK! 🎯

## How It Works

1. **App checks GitHub** every 10 minutes for new releases
2. **Users get notified** when a new version is available  
3. **Click "Download Update"** downloads automatically
4. **Click "Install & Restart"** installs and restarts the app
5. **Done!** - User now has the latest version

## How to Release a New Version

### Step 1: Upload Your Code to GitHub
```bash
# First time setup (do this once):
git init
git remote add origin https://github.com/yashgupta-11/mark.git

# Every time you make changes:
git add .
git commit -m "Update app with new features"
git push origin main
```

### Step 2: Build Your App
```bash
npm run build-dmg
```
This creates `.dmg` files in the `dist` folder.

### Step 3: Create a GitHub Release

1. **Go to**: https://github.com/yashgupta-11/mark/releases
2. **Click**: "Create a new release"
3. **Tag version**: Enter new version (e.g., `v0.9.1`, `v1.0.0`)
4. **Release title**: Same as tag (e.g., `v0.9.1`)
5. **Description**: Write what's new:
   ```
   ## What's New
   - Fixed bug with task saving
   - Added new date format options
   - Improved performance
   
   ## Download
   Choose the right file for your Mac:
   - **Mark-arm64.dmg** - Apple Silicon (M1/M2/M3)
   - **Mark-x64.dmg** - Intel Macs
   ```

6. **Upload files**: Drag both `.dmg` files from your `dist` folder
7. **Click**: "Publish release"

### Step 4: That's It! 

- Within 10 minutes, all users will see "Update available" 
- They click "Download Update" - **downloads automatically**
- They click "Install & Restart" - **installs and restarts automatically**  
- **Zero manual work for users!** 🎉

## Important Notes

- **Version numbers**: Make sure the tag matches your `package.json` version
- **Build first**: Always build before creating release
- **Test downloads**: Download and test the files yourself first
- **File naming**: Use `Mark-arm64.dmg` and `Mark-x64.dmg` (matches your build config)

## Users Will See

### Automatic Process:
- Current version in Settings
- Automatic notification every 10 minutes if update available
- **"Download Update"** button (downloads in background with progress bar)
- **"Install & Restart"** button (installs and restarts app automatically)

### Manual Check:
- "Check for Updates" button for instant checking
- Same download/install process

**Complete automation - users just click 2 buttons and they're updated!** 🚀

No server required, no costs, completely automated distribution via GitHub! 🎉 