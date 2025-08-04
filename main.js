const { app, dialog, nativeImage, BrowserWindow, Menu } = require('electron')
const fs = require('node:fs')
const path = require('path')

const createWindow = () => {
    const iconPath = path.join(__dirname, 'icons/markupeditor.icns'); // Or .ico/.icns
    const appIcon = nativeImage.createFromPath(iconPath);
    const win = new BrowserWindow({
        icon: appIcon, // Set the window icon
})
    win.loadFile('index.html')
}

app.whenReady().then(() => {
    createWindow()
    const template = (process.platform === 'darwin') ? macTemplate : nonMacTemplate;
    if (process.env.NODE_ENV !== 'production') template.push(debugMenu);
    const menu = Menu.buildFromTemplate(template)
    Menu.setApplicationMenu(menu)
    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow()
        }
    })
})

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit()
    }
})

/** For now, use the markupeditor-base web site for learning more about the desktop MarkupEditor */
async function learnMore() {
    const { shell } = require('electron')
    await shell.openExternal('https://stevengharris.github.io/markupeditor-base/')
}

/** Open an HTML file and  set the contents of the window */
async function openDocument() {
    const { cancelled, filePaths } = await dialog.showOpenDialog({
        properties: ['openFile'],
        filters: [
            { name: 'HTML', extensions: ['html', 'htm'] }
        ]
    });

    if (!cancelled) {
        let filePath = filePaths[0]
        fs.readFile(filePath, 'utf8', (err, text) => {
            if (err) {
                console.error('Error reading file:', err);
                return;
            }
            let webContents = BrowserWindow.getFocusedWindow()?.webContents;
            if (webContents) {
                let base = path.dirname(filePath)
                let setBaseCommand = `MU.setBase('${base}/')`
                let escapedText = text.replace(/(\r\n|\n|\r)/g, "").replaceAll("'", "&#039;");
                let setHTMLCommand = `MU.setHTML('${escapedText}')`
                webContents.executeJavaScript(setBaseCommand)
                    .then(webContents.executeJavaScript(setHTMLCommand))
                    .catch((error) => {
                        console.error('Error setting contents:', error);
                    });
            }
        });
    }
}

async function newDocument() {
    let webContents = BrowserWindow.getFocusedWindow()?.webContents;
    webContents?.executeJavaScript('MU.emptyDocument()')
        .catch((error) => {
            console.error('Error creating empty document:', error);
        });
}

/** Save HTML contents to a file */
async function saveDocument() {
    const { cancelled, filePath } = await dialog.showSaveDialog({
        properties: ['createDirectory', 'showOverwriteConfirmation'],
        filters: [
            { name: 'HTML', extensions: ['html', 'htm'] }
        ]
    });

    if (!cancelled) {
        let webContents = BrowserWindow.getFocusedWindow()?.webContents;
        webContents?.executeJavaScript('MU.getHTML()')
            .then((html) => {
                fs.writeFile(filePath, html, 'utf8', (err) => {
                    if (err) {
                        console.error('Error writing file:', err);
                        return;
                    }
                })
            })
            .catch((error) => {
                console.error('Error getting contents:', error);
            });
    }
}

/** For non-production use, return a Debug menu that can be appended to the standard template */
const debugMenu = {
    label: 'Debug',
    submenu: [
        {
            label: 'Open dev tools',
            click: () => { BrowserWindow.getFocusedWindow().webContents.openDevTools() } 
        }
    ]
}

/** Return a template suitable for `Menu.buildFromTemplate` on a Mac */
const macTemplate = [
    { label: '' },  // Somewhat mindboggling, but see https://stackoverflow.com/a/55262353/8968411
    // { role: 'appMenu' }
    {
        label: app.name,
        submenu: [
            { role: 'about' },
            { type: 'separator' },
            { role: 'services' },
            { type: 'separator' },
            { role: 'hide' },
            { role: 'hideOthers' },
            { role: 'unhide' },
            { type: 'separator' },
            { role: 'quit' }
        ]
    },
    // { role: 'fileMenu' }
    {
        label: 'File',
        submenu: [
            {
                label: 'Open',
                accelerator: 'Cmd+N',
                click: openDocument
            },
            {
                label: 'New',
                accelerator: 'Cmd+O',
                click: newDocument
            },
            {
                label: 'Save',
                accelerator: 'Cmd+S',
                click: saveDocument
            },
            { role: 'close' }
        ]
    },
    // { role: 'editMenu' }
    {
        label: 'Edit',
        submenu: [
            { role: 'undo' },
            { role: 'redo' },
            { type: 'separator' },
            { role: 'cut' },
            { role: 'copy' },
            { role: 'paste' },
            { role: 'pasteAndMatchStyle' },
            { role: 'delete' },
            { role: 'selectAll' },
            { type: 'separator' },
            {
                label: 'Speech',
                submenu: [
                    { role: 'startSpeaking' },
                    { role: 'stopSpeaking' }
                ]
            }
        ]
    },
    // { role: 'viewMenu' }
    {
        label: 'View',
        submenu: [
            { role: 'reload' },
            { role: 'forceReload' },
            { role: 'toggleDevTools' },
            { type: 'separator' },
            { role: 'resetZoom' },
            { role: 'zoomIn' },
            { role: 'zoomOut' },
            { type: 'separator' },
            { role: 'togglefullscreen' }
        ]
    },
    // { role: 'windowMenu' }
    {
        label: 'Window',
        submenu: [
            { role: 'minimize' },
            { role: 'zoom' },
            { type: 'separator' },
            { role: 'front' },
            { type: 'separator' },
            { role: 'window' }
        ]
    },
    {
        role: 'help',
        submenu: [
            {
                label: 'Learn More',
                click: learnMore
            }
        ]
    }
]

/** Return a template suitable for `Menu.buildFromTemplate` on a non-Mac device (haha, tested only on a Mac, though) */
const nonMacTemplate = [
    // { role: 'appMenu' }
    // { role: 'fileMenu' }
    {
        label: 'File',
        submenu: [
            { role: 'quit' }
        ]
    },
    // { role: 'editMenu' }
    {
        label: 'Edit',
        submenu: [
            { role: 'undo' },
            { role: 'redo' },
            { type: 'separator' },
            { role: 'cut' },
            { role: 'copy' },
            { role: 'paste' },
            { role: 'delete' },
            { type: 'separator' },
            { role: 'selectAll' }
        ]
    },
    // { role: 'viewMenu' }
    {
        label: 'View',
        submenu: [
            { role: 'reload' },
            { role: 'forceReload' },
            { role: 'toggleDevTools' },
            { type: 'separator' },
            { role: 'resetZoom' },
            { role: 'zoomIn' },
            { role: 'zoomOut' },
            { type: 'separator' },
            { role: 'togglefullscreen' }
        ]
    },
    // { role: 'windowMenu' }
    {
        label: 'Window',
        submenu: [
            { role: 'minimize' },
            { role: 'zoom' },
            { role: 'close' },
        ]
    },
    {
        role: 'help',
        submenu: [     
            {
                label: 'Learn More',
                click: learnMore
            }
        ]
    }
]
