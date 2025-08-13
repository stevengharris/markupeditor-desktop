const { contextBridge, ipcRenderer } = require('electron');

/** Define the markupAPI endpoints exposed via windowEvents in main */
contextBridge.exposeInMainWorld('markupAPI', {
    changed: () => { ipcRenderer.send('changed') },
    selectImage: () => { ipcRenderer.send('selectImage') },
});