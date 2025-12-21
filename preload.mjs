const { contextBridge, ipcRenderer } = require('electron');

/** Define the `markupAPI` endpoints exposed via windowEvents in main */
contextBridge.exposeInMainWorld('markupAPI', {
    markupReady: () => { ipcRenderer.send('markupReady') },
    markupInput: () => { ipcRenderer.send('markupInput') },
    selectImage: () => { ipcRenderer.send('selectImage') },
});