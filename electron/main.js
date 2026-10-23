const { app, BrowserWindow, protocol, net, ipcMain, shell } = require('electron');
const fs = require('fs');
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
      preload: path.join(__dirname, 'preload.js'),
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

  ipcMain.handle('pdf:generate', async (_event, { html, fileName }) => {
    const outputFileName = fileName || `reporte-averia-${Date.now()}.pdf`;
    const outputPath = path.join(app.getPath('temp'), outputFileName);
    const printWindow = new BrowserWindow({
      show: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
      },
    });

    try {
      await printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);

      const data = await printWindow.webContents.printToPDF({
        printBackground: true,
        pageSize: 'A4',
        marginsType: 1,
      });

      fs.writeFileSync(outputPath, data);
      const openError = await shell.openPath(outputPath);
      if (openError) {
        throw new Error(`No se pudo abrir el PDF: ${openError}`);
      }

      return outputPath;
    } finally {
      if (!printWindow.isDestroyed()) {
        printWindow.destroy();
      }
    }
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
