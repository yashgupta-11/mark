# 🚀 Mark Installation Guide

## Download

Choose the appropriate version for your Mac:
- **Mark-arm64.dmg** - For Apple Silicon Macs (M1/M2/M3)
- **Mark-x64.dmg** - For Intel Macs

## Installation Steps

### 1. Download and Open DMG
1. Download the appropriate DMG file for your Mac
2. Double-click the DMG file to open it
3. Drag Mark to your Applications folder

### 2. Handle Security Warning

**If you see "Mark is damaged and can't be opened" or similar:**

#### Method 1: Right-click to Open (Easiest)
1. Right-click on Mark in Applications
2. Select "Open" from the menu
3. Click "Open" in the security dialog
4. Mark will now open normally in the future

#### Method 2: Terminal Command (If Method 1 doesn't work)
1. Open Terminal (Applications > Utilities > Terminal)
2. Run this command:
   ```bash
   sudo xattr -rd com.apple.quarantine /Applications/Mark.app
   ```
3. Enter your password when prompted
4. Try opening Mark normally

#### Method 3: System Preferences
1. Go to System Preferences > Security & Privacy
2. In the "General" tab, you'll see a message about Mark being blocked
3. Click "Open Anyway"

### 3. Grant Permissions
When you first run Mark, macOS may ask for permissions:
- **Accessibility**: Allow this for proper menubar functionality
- **Screen Recording**: May be requested for transparency effects

## Why This Happens

Mark is **not signed with an Apple certificate**, which causes macOS to show security warnings. This is **completely normal** for many quality apps and doesn't mean Mark is harmful.

**Benefits of our unsigned approach:**
- ✅ **No data collection** - your tasks stay private
- ✅ **Lower cost** - savings passed to you
- ✅ **Faster updates** - no waiting for Apple approval

Many successful productivity apps (including popular ones on Gumroad) distribute this way!

## Troubleshooting

- **App won't start**: Try Method 2 (Terminal command) above
- **Menubar icon not showing**: Check System Preferences > Security & Privacy for blocked permissions
- **App crashes**: Make sure you downloaded the right version for your Mac architecture

## Support

📧 **Email:** me@yashgupta.in  
🌐 **Support:** https://yashgupta3.gumroad.com/l/mark

---

**Mark - Minimal tasks. Maximum focus.**

*Thank you for supporting independent software!* 🙏 