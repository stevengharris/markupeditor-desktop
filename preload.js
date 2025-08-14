const { contextBridge, ipcRenderer } = require('electron');

/** Define the markupAPI endpoints exposed via windowEvents in main */
contextBridge.exposeInMainWorld('markupAPI', {
    selectImage: () => { ipcRenderer.send('selectImage') },
});