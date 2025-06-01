const { menubar } = require('menubar');
const { app, BrowserWindow, ipcMain, screen, nativeImage, nativeTheme, systemPreferences, shell } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const fs = require('fs').promises;
const os = require('os');

let mb;
let dataFilePath;
let settingsFilePath;

// Auto update checking
let updateCheckInterval = null;
let lastUpdateCheck = null;

// Configure electron-updater for GitHub releases
autoUpdater.checkForUpdatesAndNotify = false; // We'll handle this manually
autoUpdater.autoDownload = false; // We'll ask user permission first
autoUpdater.logger = console;

// Configure for GitHub releases
autoUpdater.setFeedURL({
    provider: 'github',
    owner: 'yashgupta-11',
    repo: 'mark'
});

// Auto-updater event handlers
autoUpdater.on('checking-for-update', () => {
    console.log('Checking for update...');
    if (mb && mb.window) {
        mb.window.webContents.send('update-status', { type: 'checking' });
    }
});

autoUpdater.on('update-available', (info) => {
    console.log('Update available:', info.version);
    if (mb && mb.window) {
        mb.window.webContents.send('update-status', { 
            type: 'available', 
            version: info.version,
            releaseNotes: info.releaseNotes,
            releaseDate: info.releaseDate
        });
    }
});

autoUpdater.on('update-not-available', (info) => {
    console.log('Update not available');
    if (mb && mb.window) {
        mb.window.webContents.send('update-status', { 
            type: 'not-available', 
            currentVersion: app.getVersion() 
        });
    }
});

autoUpdater.on('error', (err) => {
    console.log('Error in auto-updater:', err);
    if (mb && mb.window) {
        mb.window.webContents.send('update-status', { 
            type: 'error', 
            error: err.message 
        });
    }
});

autoUpdater.on('download-progress', (progressObj) => {
    console.log(`Download progress: ${progressObj.percent}%`);
    if (mb && mb.window) {
        mb.window.webContents.send('update-status', { 
            type: 'download-progress', 
            percent: progressObj.percent,
            transferred: progressObj.transferred,
            total: progressObj.total
        });
    }
});

autoUpdater.on('update-downloaded', (info) => {
    console.log('Update downloaded:', info.version);
    if (mb && mb.window) {
        mb.window.webContents.send('update-status', { 
            type: 'downloaded', 
            version: info.version 
        });
    }
});

// Set up the data and settings file paths in user's home directory
async function initializeStorageFiles() {
    const userDataPath = path.join(os.homedir(), '.menubar-todo');
    dataFilePath = path.join(userDataPath, 'data.json');
    settingsFilePath = path.join(userDataPath, 'settings.json');
    
    // Create directory if it doesn't exist
    try {
        await fs.mkdir(userDataPath, { recursive: true });
    } catch (error) {
        // Check if the error is because the directory already exists, which is not a failure condition
        if (error.code !== 'EEXIST') {
            console.error('Error creating directory:', error.message);
            // Depending on the desired behavior, you might want to throw the error or handle it
        } else {
            console.log('Directory already exists or was created successfully.');
        }
    }
}

// Check if any window is in fullscreen mode
function isAnyWindowFullscreen() {
    const displays = screen.getAllDisplays();
    return displays.some(display => {
        const bounds = display.bounds;
        const windows = BrowserWindow.getAllWindows();
        return windows.some(win => {
            if (win === mb.window) return false; // Ignore our own window
            const winBounds = win.getBounds();
            return win.isFullScreen() || 
                   (winBounds.width >= bounds.width && winBounds.height >= bounds.height);
        });
    });
}

// Load data (todos and workspaces) from file
async function loadData() {
    try {
        const data = await fs.readFile(dataFilePath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        // File doesn't exist or is invalid, return empty structure
        console.log('No existing data file found, starting fresh');
        return { todos: [], workspaces: [] };
    }
}

// Save data (todos and workspaces) to file
async function saveData(data) {
    try {
        await fs.writeFile(dataFilePath, JSON.stringify(data, null, 2), 'utf8');
        console.log('Data saved successfully to:', dataFilePath);
        return true;
    } catch (error) {
        console.error('Error saving data:', error);
        return false;
    }
}

// Load settings from file
async function loadSettings() {
    try {
        const data = await fs.readFile(settingsFilePath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        // File doesn't exist or is invalid, return empty object
        console.log('No existing settings file found, using defaults');
        return {};
    }
}

// Save settings to file
async function saveSettings(settings) {
    try {
        await fs.writeFile(settingsFilePath, JSON.stringify(settings, null, 2), 'utf8');
        console.log('Settings saved successfully to:', settingsFilePath);
        return true;
    } catch (error) {
        console.error('Error saving settings:', error);
        return false;
    }
}

app.whenReady().then(async () => {
    // Initialize storage
    await initializeStorageFiles();
    
    mb = menubar({
        index: `file://${path.join(__dirname, 'index.html')}`,
        icon: path.join(__dirname, 'assets', 'menuiconTemplate.png'),
        tooltip: 'Mark',
        browserWindow: {
            width: 350,
            height: 500,
            resizable: false,
            transparent: true,
            frame: false,
            skipTaskbar: true,
            show: false,
            webPreferences: {
                nodeIntegration: true,
                contextIsolation: false,
                enableRemoteModule: false
            }
        },
        preloadWindow: true,
        showDockIcon: false,
        showOnRightClick: false,
        showOnAllWorkspaces: true
    });

    mb.on('ready', () => {
        console.log('Menubar app is ready.');
        console.log('Data will be saved to:', dataFilePath);
        console.log('Settings will be saved to:', settingsFilePath);
        
        if (mb.window) {
            mb.window.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
            mb.window.setAlwaysOnTop(false);

            mb.window.on('blur', () => {
                if (mb.window && mb.window.isVisible() && !mb.window.isFocused()) { // Ensure it's truly blurred
                    mb.hideWindow();
                }
            });

            // Attempt to fix workspace switching issue by re-asserting window properties on focus
            mb.window.on('focus', () => {
                if (mb.window && mb.window.isVisible()) {
                    mb.window.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
                    
                    const isFullscreen = isAnyWindowFullscreen();
                    
                    // Set appropriate window level based on fullscreen state
                    if (isFullscreen) {
                        mb.window.setAlwaysOnTop(true, 'screen-saver', 1);
                    } else {
                        mb.window.setAlwaysOnTop(true, 'floating', 1);
                    }
                    
                    mb.window.focus(); 
                }
            });

            mb.window.webContents.on('before-input-event', (event, input) => {
                if (input.key === 'Escape' && mb.window.isVisible()) {
                    mb.hideWindow();
                    event.preventDefault(); 
                }
            });
        }
    });

    mb.on('show', () => {
        if (mb.window) {
            mb.window.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
            
            const isFullscreen = isAnyWindowFullscreen();
            
            // Set higher window level for fullscreen scenarios
            if (isFullscreen) {
                mb.window.setAlwaysOnTop(true, 'screen-saver', 1);
            } else {
                mb.window.setAlwaysOnTop(true, 'floating', 1);
            }
            
            mb.window.focus(); 

            mb.window.webContents.send('trigger-window-open-animation', { isFullscreen });
        }
    });

    mb.on('hide', () => {
        if (mb.window) {
            mb.window.webContents.send('window-hiding');
            // Reset always on top when hiding
            mb.window.setAlwaysOnTop(false);
        }
    });

    mb.on('after-show', () => {
        if (mb.window) {
            // mb.window.focus(); // Focus is already handled in 'show' and 'focus' events
            // It's important that the window is shown before we send the animation trigger.
            // The 'after-show' event ensures this. We can also use a small timeout in 'show' if needed.
        }
    });
    
    // Start automatic update checking
    startAutoUpdateChecking();
});

// Automatic update checking every 10 minutes
function startAutoUpdateChecking() {
    // Check immediately on startup (after 30 seconds)
    setTimeout(() => {
        autoUpdater.checkForUpdates().catch(err => {
            console.log('Auto update check failed:', err.message);
        });
    }, 30000);
    
    // Then check every 10 minutes
    updateCheckInterval = setInterval(() => {
        autoUpdater.checkForUpdates().catch(err => {
            console.log('Auto update check failed:', err.message);
        });
    }, 10 * 60 * 1000);
}

// Handle app quit
app.on('window-all-closed', () => {
    // Clean up update checking interval
    if (updateCheckInterval) {
        clearInterval(updateCheckInterval);
        updateCheckInterval = null;
    }
    
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// IPC handlers for data operations
ipcMain.handle('get-data', async () => {
    const data = await loadData();
    console.log(`Loaded data from storage:`, data);
    return data;
});

ipcMain.handle('save-data', async (event, data) => {
    const success = await saveData(data);
    if (success) {
        console.log(`Saved data to storage:`, data);
    }
    return success;
});

// IPC handlers for settings operations
ipcMain.handle('get-settings', async () => {
    const settings = await loadSettings();
    console.log('Loaded settings from storage:', settings);
    return settings;
});

ipcMain.handle('save-settings', async (event, settings) => {
    const success = await saveSettings(settings);
    if (success) {
        console.log('Saved settings to storage:', settings);
    }
    return success;
});

ipcMain.on('quit-app', () => {
    app.quit();
});

// IPC command to hide the window, can be called from renderer if needed
ipcMain.on('hide-window', () => {
    if (mb) {
        mb.hideWindow();
    }
});

// IPC handler for updating icon badge
ipcMain.handle('update-icon-badge', async (event, badgeText) => {
    try {
        if (mb && mb.tray) {
            if (badgeText && badgeText !== '0') {
                // For macOS, we can use setTitle to show a badge-like text
                // Template images automatically adapt to menubar appearance
                if (process.platform === 'darwin') {
                    mb.tray.setTitle(badgeText);
                } else {
                    // For other platforms, just set the title in tooltip
                    mb.tray.setToolTip(`Mark - ${badgeText} pending tasks`);
                }
            } else {
                // Clear the badge
                if (process.platform === 'darwin') {
                    mb.tray.setTitle('');
                } else {
                    mb.tray.setToolTip('Mark');
                }
            }
        }
        return true;
    } catch (error) {
        console.error('Error updating icon badge:', error);
        return false;
    }
});

ipcMain.on('update-window-size', (event, { height, width }) => {
    if (mb.window) {
        const currentBounds = mb.window.getBounds();
        const newBounds = {
            x: currentBounds.x,
            y: currentBounds.y,
            width: width !== undefined ? width : currentBounds.width,
            height: height !== undefined ? height : currentBounds.height
        };
        mb.window.setBounds(newBounds);
    }
});

// IPC handlers for update functionality
ipcMain.handle('check-for-updates', async () => {
    try {
        return await autoUpdater.checkForUpdates();
    } catch (error) {
        console.error('Error checking for updates:', error);
        throw error;
    }
});

ipcMain.handle('download-update', async () => {
    try {
        return await autoUpdater.downloadUpdate();
    } catch (error) {
        console.error('Error downloading update:', error);
        throw error;
    }
});

ipcMain.handle('install-update', async () => {
    try {
        // This will quit and install the update
        autoUpdater.quitAndInstall(false, true);
        return true;
    } catch (error) {
        console.error('Error installing update:', error);
        throw error;
    }
});

ipcMain.handle('get-app-version', async () => {
    return app.getVersion();
});

ipcMain.handle('open-download-page', async (event, url) => {
    try {
        // Open the provided download URL or a default page
        const downloadUrl = url || 'https://your-website.com/download';
        shell.openExternal(downloadUrl);
        return true;
    } catch (error) {
        console.error('Error opening download page:', error);
        return false;
    }
}); 