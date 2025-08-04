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

let openFilePath = null;

app.whenReady().then(() => {
    createWindow()
    const template = (process.platform === 'darwin') ? macTemplate : nonMacTemplate;
    if (process.env.NODE_ENV !== 'production') template.push(debugMenu);
    const menu = Menu.buildFromTemplate(template)
    Menu.setApplicationMenu(menu)
    setOpenFilePath(null)
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

function getWebContents() {
    return BrowserWindow.getFocusedWindow()?.webContents
}

/** Track the openFilePath, which may be null */
function setOpenFilePath(string) {
    openFilePath = string
    const saveItem = Menu.getApplicationMenu().getMenuItemById('save');
    saveItem.enabled = string != null
}

/** For now, use the markupeditor-base web site for learning more about the desktop MarkupEditor */
async function learnMore() {
    const { shell } = require('electron')
    await shell.openExternal('https://stevengharris.github.io/markupeditor-base/')
}

/** 
 * Open an HTML file and  set the contents of the window.
 * Note when setting the HTML, base is set based on the directory of the file.
 */
async function openDocument() {
    const { canceled, filePaths } = await dialog.showOpenDialog({
        properties: ['openFile'],
        filters: [
            { name: 'HTML', extensions: ['html', 'htm'] }
        ]
    });

    if (!canceled) {
        let filePath = filePaths[0]
        fs.readFile(filePath, 'utf8', (err, text) => {
            if (err) {
                console.error('Error reading file:', err);
                return;
            }
            // Get rid of newlines and escape single quotes
            let escapedText = text.replace(/(\r\n|\n|\r)/g, "").replaceAll("'", "&#039;");
            let base = path.dirname(filePath) + '/'     // Don't forget the trailing slash!
            let setHTMLCommand = `MU.setHTML('${escapedText}', true, '${base}')`
            getWebContents()?.executeJavaScript(setHTMLCommand)
                .then(() => {setOpenFilePath(filePath)})
                .catch((error) => {
                    console.error('Error setting contents:', error);
                });
        });
    }
}

async function newDocument() {
    getWebContents()?.executeJavaScript('MU.emptyDocument()')
        .then(() => {setOpenFilePath(null)})
        .catch((error) => {
            console.error('Error creating empty document:', error);
        });
}

async function saveDocument() {
    if (!openFilePath) return
    getWebContents()?.executeJavaScript('MU.getHTML()')
        .then((html) => {
            fs.writeFile(openFilePath, html, 'utf8', (err) => {
                if (err) {
                    console.error('Error writing file:', err);
                    return;
                }
            })
        })
        .catch((error) => {
            console.error('Error getting contents:', error);
        }
    );
}

/** Save HTML contents to a file */
async function saveDocumentAs() {
    const options = {
        properties: ['createDirectory', 'showOverwriteConfirmation'],
        filters: [
            { name: 'HTML', extensions: ['html', 'htm'] }
        ]
    }
    if (openFilePath) options.defaultPath = openFilePath
    const { canceled, filePath } = await dialog.showSaveDialog(options);

    if (!canceled) {
        getWebContents()?.executeJavaScript('MU.getHTML()')
            .then((html) => {
                fs.writeFile(filePath, html, 'utf8', (err) => {
                    if (err) {
                        console.error('Error writing file:', err);
                        return;
                    }
                })
            })
            .then(()=>{setOpenFilePath(filePath)})
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
                click: saveDocument,
                id: 'save'
            },
            {
                label: 'Save As...',
                click: saveDocumentAs
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
