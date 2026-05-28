const { app, BrowserWindow, ipcMain, globalShortcut, dialog } = require('electron');
const path = require('path');
const DiscordRPC = require('discord-rpc');

let win;
const clientId = '1508392537914871838'; 

function createWindow() {
  win = new BrowserWindow({
    width: 980,
    height: 620,
    title: "Quellqa",
    frame: false,
    resizable: true,
    backgroundColor: '#000000',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webSecurity: false // Necessary to stream direct disk paths safely across app restarts
    }
  });

  win.loadFile(path.join(__dirname, 'dist-web/index.html'));
  
  win.once('ready-to-show', () => {
    setThumbarButtons(false);
  });
}

function setThumbarButtons(isPlaying) {
  if (!win || process.platform !== 'win32') return;

  try {
    win.setThumbarButtons([
      {
        tooltip: 'Previous Track',
        icon: 'media-skip-backward',
        flags: [],
        click() { win.webContents.send('media-command', 'prev'); }
      },
      {
        tooltip: isPlaying ? 'Pause' : 'Play',
        icon: isPlaying ? 'media-pause' : 'media-play',
        flags: [],
        click() { win.webContents.send('media-command', 'play-pause'); }
      },
      {
        tooltip: 'Next Track',
        icon: 'media-skip-forward',
        flags: [],
        click() { win.webContents.send('media-command', 'next'); }
      }
    ]);
  } catch (e) {
    console.error("Taskbar buttons configuration failed:", e);
  }
}

ipcMain.on('window-control', (event, action) => {
  if (!win) return;
  if (action === 'close') win.close();
  if (action === 'minimize') win.minimize();
});

ipcMain.on('sync-native-media', (event, data) => {
  if (!win || !data) return;
  setThumbarButtons(data.isPlaying);
});

// ================= DISCORD TELEMETRY MATRIX BACKBONE =================
const rpc = new DiscordRPC.Client({ transport: 'ipc' });

function setInitialPresence() {
  if (!rpc) return;
  rpc.setActivity({
    details: 'Browsing Music Library',
    state: 'VERSION X // Uncapped Engine',
    largeImageKey: 'quellqa_logo',
    instance: false,
  }).catch(() => {});
}

ipcMain.on('update-rpc', (event, track) => {
  if (!rpc) return;
  
  if (track && track.isPlaying) {
    rpc.setActivity({
      type: 2,                                     
      details: `${track.title} // ${track.artist}`, 
      state: `${track.album}`,             
      largeImageKey: 'quellqa_logo',
      largeImageText: 'Quellqa VERSION X',
      instance: false,
    }).catch((err) => {
      console.error("Discord presence update failed:", err);
    });
  } else {
    setInitialPresence();
  }
});

rpc.on('ready', () => { setInitialPresence(); });
rpc.login({ clientId }).catch(() => console.log("Discord link standby..."));

// ================= LOCAL RESTARTS SOURCE FILE HANDLER =================
ipcMain.handle('select-music-dir', async () => {
  const result = await dialog.showOpenDialog(win, {
    properties: ['openFile', 'multiSelections'],
    filters: [{ name: 'Audio Files', extensions: ['mp3', 'wav', 'flac', 'm4a'] }]
  });
  
  if (result.canceled) return [];
  
  return result.filePaths.map(filePath => {
    return {
      name: path.basename(filePath),
      path: filePath,
      nativeUrl: `atom://` + filePath
    };
  });
});

app.whenReady().then(() => {
  const { protocol } = require('electron');
  protocol.registerFileProtocol('atom', (request, callback) => {
    const url = request.url.substr(7);
    callback({ path: path.normalize(decodeURIComponent(url)) });
  });

  app.commandLine.appendSwitch('disable-renderer-backgrounding');
  app.commandLine.appendSwitch('disable-background-timer-throttling');
  createWindow();

  globalShortcut.register('MediaPlayPause', () => { win?.webContents.send('media-command', 'play-pause'); });
  globalShortcut.register('MediaNextTrack', () => { win?.webContents.send('media-command', 'next'); });
  globalShortcut.register('MediaPreviousTrack', () => { win?.webContents.send('media-command', 'prev'); });
});

app.on('will-quit', () => { globalShortcut.unregisterAll(); });
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
