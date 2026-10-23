const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronApi', {
  generatePdf: async (html, fileName) => {
    return ipcRenderer.invoke('pdf:generate', { html, fileName });
  },
});
