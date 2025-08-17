const { app, dialog, nativeImage, ipcMain, BrowserWindow, Menu } = require('electron')
const { insertLinkCommand, insertImageCommand, toggleBold, toggleItalic, toggleCode } = require('markupeditor-base')
const fs = require('node:fs')
const path = require('path')

/** The path to the currently file being edited */
let openFilePath = null
/** Flag to prevent infinite loop during `quitIfApproved` */
let isQuitting = false

const createWindow = () => {
    const iconPath = path.join(__dirname, 'icons/markupeditor.icns'); // Or .ico/.icns
    const appIcon = nativeImage.createFromPath(iconPath);
    const win = new BrowserWindow({
        webPreferences: {
            nodeIntegration: false, // For security
            contextIsolation: true, // For security
            preload: path.join(__dirname, 'preload.js'),
        },
        icon: appIcon, // Set the window icon
    })
    win.on('close', quitIfApproved)     // Need this *and* the app.on('before-quit')

    // One-time-only, set the application menu up based on the markupEditorConfig.
    // This way, the config can be set up explicitly in index.html or will get the 
    // "standard" defaults for the MarkupEditor, but either way, the application 
    // menu contents and keymap will match.
    win.once('ready-to-show', async () => {
        let config = await getWebContents()?.executeJavaScript('MU.markupEditorConfig')
        setApplicationMenu(config)
        setOpenFilePath(null)
        win.show()
    })
    win.loadFile('index.html')
}

app.whenReady().then(() => {
    createWindow()

    // Respond to messages sent from from the MarkupDelegate in setup.js
    ipcMain.on('selectImage', handleSelectImage)

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow()
        }
    })
})

app.on('before-quit', quitIfApproved);

async function quitIfApproved(event) {
    if (isQuitting) return; // Prevent re-entering if already in the process of quitting
    isQuitting = true;
    event.preventDefault(); // Prevent immediate quitting
    if (await checkSave()) {
        app.quit()
    } else {
        isQuitting = false
    }
}

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit()
    }
})

/** Handle the `addedImage` event when it is triggered. */
async function handleSelectImage() {
    const { canceled, filePaths } = await dialog.showOpenDialog({
        properties: ['openFile'],
        filters: [
            { name: 'Image', extensions: ['png', 'jpg', 'jpeg', 'gif'] }
        ]
    });

    if (!canceled) {
        let filePath = filePaths[0]
        fs.readFile(filePath, 'base64', (err, data) => {
            if (err) {
                console.error('Error reading file:', err);
                return;
            }
            let src = srcFromData(filePath, data)
            if (!src) {
                console.error('Unsupported media type')
                return
            }
            let insertImageCommand = `MU.insertImage("${src}")`
            getWebContents()?.executeJavaScript(insertImageCommand)
                .then(()=>{console.log("Done insertImage")})
                .catch((error) => {
                    console.error('Error inserting image:', error);
                });
        });
    }
}

function srcFromData(filePath, data) {
    // Ref: https://developer.mozilla.org/en-US/docs/Web/URI/Reference/Schemes/data
    // data:[<media-type>][;base64],<data>
    let src = 'data:'
    let ext = path.extname(filePath);
    switch(ext) {
        case '.png': {
            src = src + 'image/png;base64'
            break
        }
        case '.gif': {
            src = src + 'image/gif;base64'
            break
        }
        case '.jpg':
        case '.jpeg': {
            src = src + 'image/jpeg;base64'
            break
        }
        default: {
            return null
        }
    }
    return src + ',' + data
}

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
 * Check whether to continue without saving. Return true to continue, else false.
 */
async function checkSave() {
    let changed = await getWebContents()?.executeJavaScript('MU.isChanged()')
    if (!changed) return true
    const {response} = await dialog.showMessageBox(
        BrowserWindow.getFocusedWindow(),
        {
            message: "Continue without saving? You will lose your changes.",
            buttons: ["OK", "Cancel"],
            defaultId: 1,
        }
    )
    return response == 0
}

/** 
 * Open an HTML file and  set the contents of the window.
 * Note when setting the HTML, base is set based on the directory of the file.
 */
async function openDocument() {
    if (!(await checkSave())) return
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
            // Escape newlines and single quotes
            let escapedText = text.replace(/(\r\n|\n|\r)/g, '\\n').replaceAll("'", "&#039;");
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
    if (!(await checkSave())) return
    getWebContents()?.executeJavaScript('MU.emptyDocument()')
        .then(() => {setOpenFilePath(null)})
        .catch((error) => {
            console.error('Error creating empty document:', error);
        });
}

/**
 * Save the document contents to openFilePath.
 * 
 * `openFilePath` must already be set before calling `saveDocument`.
 * 
 * During the save process, all images that contain encoded data are saved 
 * to new files <uuid>.<ext> in the `openFilePath` directory and then the 
 * document contents are updated so the image with this data points at the 
 * file as its new src. This lazy image file saving operation allows images 
 * to remain in-memory until save time (for example, from being pasted-in), 
 * so they can be added, edited, or removed before then  without needing to 
 * worry about file cleanup if they had been saved eagerly.
 */
async function saveDocument() {
    if (!openFilePath) return
    let webContents = getWebContents()
    if (!webContents) return
    try {
        // First get the images that have data-encoded contents
        let srcArray = await webContents.executeJavaScript('MU.getDataImages()')
        // Loop over all the src values, saving files and replacing the src in the document
        for (oldSrc of srcArray) {
            let newSrc = saveLocalImage(oldSrc)
            if (newSrc) {
                // If we saved the src data to a file, modify the image in the document to 
                // its src points to the new file. The image is located in `MU.savedDataImage`
                // by finding the image whose src value startsWith `oldSrc`.
                await webContents.executeJavaScript(`MU.savedDataImage("${oldSrc}", "${newSrc}")`)
            }
        }
        // Then get the document contents and overwrite the contents of openFilePath
        let html = await webContents.executeJavaScript('MU.getHTML()')
        fs.writeFile(openFilePath, html, 'utf8', (err) => {
            if (err) {
                console.log('Error writing file:', err);
                return;
            }
        })
    } catch(error) {
        console.log('Error saving document: ' + error)
    }
}

/**
 * Decode the `src` data and save as <uuid>.<ext> in the same dir as the file we are 
 * editing, `openFilePath`. Return the name of the new file that contains the image.
 * 
 * @param {string} src  The img src which is encoded as data 
 * @returns {string}    The file that was saved, <uuid>.<ext>
 */
function saveLocalImage(src) {
    let {data, ext} = decodeImageDataURL(src)
    if (!data || !ext || !openFilePath) return
    let openFileDir = path.dirname(openFilePath)
    const uuid = crypto.randomUUID()
    const baseName = uuid + '.' + ext
    let filename = path.join(openFileDir, baseName)
    fs.writeFile(filename, data, 'utf8', (err) => {
        if (err) {
            console.error('Error writing file:', err);
            return null;
        }
    })
    return baseName
}

/** Return the data and extension for a file that can be saved from the encoded data of an img src. */
function decodeImageDataURL(src) {
    let result = {data: null, ext: null}
    if (!src.startsWith('data')) return result
    let srcArray = src.split(",")
    let mime = srcArray[0].match(/:(.*?);/)[1]
    let mimeArray = mime.split('/')
    let type = mimeArray[0]
    if (!((type == 'image') || (type == 'video'))) return result
    result.ext = mimeArray[1]
    result.data = Buffer.from(srcArray[srcArray.length - 1], 'base64')
    return result
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
        // Before we re-use the `saveDocument` code, we have to do the same kind of base setting that 
        // we do in `openDocument` so that the local references for things like img src all resolve properly.
        setOpenFilePath(filePath)
        let webContents = getWebContents()
        let html = await webContents.executeJavaScript('MU.getHTML()')
        let base = path.dirname(filePath) + '/'     // Don't forget the trailing slash!
        let setHTMLCommand = `MU.setHTML('${html}', true, '${base}')`
        await webContents.executeJavaScript(setHTMLCommand)
        saveDocument()
    }
}

/** Menu-related */

function setApplicationMenu(config) {
    const template = (process.platform === 'darwin') ? macTemplate(config) : nonMacTemplate;
    const menu = Menu.buildFromTemplate(template)
    Menu.setApplicationMenu(menu)
}

/** Return a template suitable for `Menu.buildFromTemplate` on a Mac */
function macTemplate(config) {
    let keymap = config.keymap
    let template = [
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
                { 
                    role: 'undo',
                    accelerator: acceleratorFor(keymap.undo)
                },
                { 
                    role: 'redo',
                    accelerator: acceleratorFor(keymap.redo)
                },
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
        }
    ]
    template.push(formatMenu(config))
    template.push(...[
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
    ])
    return template
}

function formatMenu(config) {
    let menu = {label: 'Format'}
    let {link, image, table, bullet, number, indent, outdent, bold, italic, underline, strikethrough, code, subscript, superscript, search} = config.keymap
    let submenu = []
    if (link) {
        submenu.push({
            label: 'Insert Link',
            accelerator: acceleratorFor(link),
            click: insertLink
        })
    }
    if (image) {
        submenu.push({
            label: 'Insert Image',
            accelerator: acceleratorFor(image),
            click: insertImage
        })
    }
    if (table) {
        submenu.push({
            label: 'Insert Table',
            accelerator: acceleratorFor(table),
            click: insertTable
        })
    }
    if (bullet) {
        submenu.push({
            label: 'Bullet List',
            accelerator: acceleratorFor(bullet),
            click: () => { getWebContents().executeJavaScript('MU.toggleListType("UL")') }
        })
    }
    if (indent) {
        submenu.push({
            label: 'Indent',
            accelerator: acceleratorFor(indent),
            click: () => { getWebContents().executeJavaScript('MU.indent()') }
        })
    }
    if (outdent) {
        submenu.push({
            label: 'Outdent',
            accelerator: acceleratorFor(outdent),
            click: () => { getWebContents().executeJavaScript('MU.outdent()') }
        })
    }
    if (number) {
        submenu.push({
            label: 'Number List',
            accelerator: acceleratorFor(number),
            click: () => { getWebContents().executeJavaScript('MU.toggleListType("OL")') }
        })
    }
    if (bold) {
        submenu.push({
            label: 'Bold',
            accelerator: acceleratorFor(bold),
            click: () => { getWebContents().executeJavaScript('MU.toggleBold()') }
        })
    }
    if (italic) {
        submenu.push({
            label: 'Italic',
            accelerator: acceleratorFor(italic),
            click: () => { getWebContents().executeJavaScript('MU.toggleItalic()') }
        })
    }
    if (underline) {
        submenu.push({
            label: 'Underline',
            accelerator: acceleratorFor(underline),
            click: () => { getWebContents().executeJavaScript('MU.toggleUnderline()') }
        })
    }
    if (strikethrough) {
        submenu.push({
            label: 'Strikethrough',
            accelerator: acceleratorFor(strikethrough),
            click: () => { getWebContents().executeJavaScript('MU.toggleStrike()') }
        })
    }
    if (code) {
        submenu.push({
            label: 'Code',
            accelerator: acceleratorFor(code),
            click: () => { getWebContents().executeJavaScript('MU.toggleCode()') }
        })
    }
    if (subscript) {
        submenu.push({
            label: 'Subscript',
            accelerator: acceleratorFor(subscript),
            click: () => { getWebContents().executeJavaScript('MU.toggleSubscript()') }
        })
    }
    if (superscript) {
        submenu.push({
            label: 'Superscript',
            accelerator: acceleratorFor(superscript),
            click: () => { getWebContents().executeJavaScript('MU.toggleSuperscript()') }
        })
    }
    if (search) {
        submenu.push({
            label: 'Search',
            accelerator: acceleratorFor(search),
            click: () => { getWebContents().executeJavaScript('MU.toggleSearch()') }
        })
    }
    menu.submenu = submenu
    return menu
}

/**
 * Return a string suitable to be used as a menu Accelerator in Electron.
 * 
 * ProseMirror keymaps strings consist of keys separated by "-", while Electron uses "+".
 * ProseMirror uses "Meta" as a generic term for "Alt" or "Option".
 * ProseMirror uses "Mod" as a generic term for "Command" or "Cmd".
 * Electron Accelerators use uppercase only for letter keys
 * 
 * @param {string} keymap   A keymap string used by the MarkupEditor which is based on ProseMirror
 * @returns {string}        An accelerator string for Electron (https://www.electronjs.org/docs/latest/api/accelerator)
 */
function acceleratorFor(keymap) {
    let pm = (Array.isArray(keymap)) ? keymap[0] : keymap;
    let keys = pm.split('-')
    let accelerator = ''
    // The keys up until the last one are modifiers
    for (i = 0; i < keys.length - 1; i++) {
        let key = keys[i]
        switch (key) {
            case 'Mod':
                accelerator += 'Cmd'
                break
            case 'Meta':
                accelerator += 'Alt'
                break;
            default:
                accelerator += key
        }
        accelerator += '+'
    }
    let key = keys[keys.length - 1]
    if (key.length == 1) {
        accelerator += key.toUpperCase()
    } else {
        accelerator += key
    }
    return accelerator
}

function insertLink() {
    console.log("Insert a link")
}

function insertImage() {
    console.log("Insert an image")
}

function insertTable() {
    console.log("Insert a table")
}


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
