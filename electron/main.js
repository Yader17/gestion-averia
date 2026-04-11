const { app, BrowserWindow, protocol, net } = require('electron');
const path = require('path');
const url = require('url');

let mainWindow;
const distPath = path.join(__dirname, '..', 'dist');

function createWindow() {
  const isDev = process.argv.includes('--dev');

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: 'Gestión de Averías',
    icon: path.join(__dirname, '..', 'assets', 'icon.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:8081');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadURL('app://dist/index.html');
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Register custom protocol before app is ready
protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true } }
]);

app.whenReady().then(() => {
  // Handle the custom 'app' protocol to serve files from the dist folder
  protocol.handle('app', (request) => {
    const requestUrl = new URL(request.url);
    const filePath = path.join(distPath, decodeURIComponent(requestUrl.pathname));
    return net.fetch(url.pathToFileURL(filePath).toString());
  });

  createWindow();
});

app.on('window-all-closed', () => {
  app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
