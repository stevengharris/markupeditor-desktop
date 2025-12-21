import { app, dialog, nativeImage, ipcMain, BrowserWindow, Menu } from 'electron'
import fs from 'node:fs'
import path from 'node:path'

const __dirname = import.meta.dirname

/** The path to the currently file being edited */
let openFilePath = null
/** Flag to prevent infinite loop during `quitIfApproved` */
let isQuitting = false
/** Whether changes have been made to the document */
let changed = false

const createWindow = () => {
    const iconPath = path.join(__dirname, 'icons/markupeditor.icns'); // Or .ico/.icns
    const appIcon = nativeImage.createFromPath(iconPath);
    const win = new BrowserWindow({
        webPreferences: {
            nodeIntegration: false, // For security
            contextIsolation: true, // For security
            preload: path.join(__dirname, 'preload.mjs'),
        },
        icon: appIcon, // Set the window icon
    })

    // Set up main to respond to the events triggered from the renderer in preload.mjs.
    ipcMain.on('markupReady', handleMarkupReady)
    ipcMain.on('selectImage', handleSelectImage)
    ipcMain.on('markupInput', handleMarkupInput)

    win.loadFile('index.html')

    win.once('ready-to-show', async () => {
        setOpenFilePath(null)
        win.show()
    })

    win.on('close', quitIfApproved)     // Need this *and* the app.on('before-quit')

}

app.whenReady().then(async () => {

    createWindow()

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

/** Handle the `markupReady` event when it is triggered after any userscript and userstyle are loaded.
 * 
 * Use it to set up the menu, which needs the `activeEditor` to be known. This has the advantage 
 * that the application menu config is based on the active config, in this case set to a 
 * desktop config in setup.mjs. This way, the config can be set up explicitly in index.html 
 * (in this case using a `userscript` setup.mjs) or will get the "standard" defaults, but either 
 * way, the application menu contents and keymap will match.
 */
async function handleMarkupReady() {
    let config = await executeJavaScript('MU.activeConfig()')
    setApplicationMenu(config)
}

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
            executeJavaScript(insertImageCommand)
                .then(()=>{console.log("Done insertImage")})
                .catch((error) => {
                    console.error('Error inserting image:', error);
                });
        });
    }
}

/** Handle the markupInput event when it is triggered, indicating that
 * a change was made to the document.
 */
async function handleMarkupInput() {
    changed = true
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
    if (saveItem) saveItem.enabled = string != null
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
            executeJavaScript(setHTMLCommand)
                .then(() => {
                    setOpenFilePath(filePath)
                    changed = false
                })
                .catch((error) => {
                    console.error('Error setting contents:', error);
                });
        });
    }
}

/** If web contents exist, invoke `script` */
function executeJavaScript(muFunction) {
    let webContents = getWebContents()
    if (webContents) {
        return webContents.executeJavaScript(scriptFor(muFunction))
    } else {
        return Promise.reject(new Error('No web contents.'))
    }
}

function scriptFor(muFunction) {
    return `(
        () => {
            let element = document.getElementsByTagName("markup-editor")[0]
            return element?.${muFunction}
        })()`
}

async function newDocument() {
    if (!(await checkSave())) return
    executeJavaScript('MU.emptyDocument()')
        .catch(error => console.log('Script failed: ' + error));
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
        let srcArray = await executeJavaScript('MU.getDataImages()')
        // Loop over all the src values, saving files and replacing the src in the document
        for (oldSrc of srcArray) {
            let newSrc = saveLocalImage(oldSrc)
            if (newSrc) {
                // If we saved the src data to a file, modify the image in the document to 
                // its src points to the new file. The image is located in `MU.savedDataImage`
                // by finding the image whose src value startsWith `oldSrc`.
                await executeJavaScript(`MU.savedDataImage("${oldSrc}", "${newSrc}")`)
            }
        }
        // Then get the document contents and overwrite the contents of openFilePath,
        // flagging that the document has no changes compared to the one on openFilePath.
        let html = await executeJavaScript('MU.getHTML()')
        fs.writeFile(openFilePath, html, 'utf8', (err) => {
            if (err) {
                console.log('Error writing file:', err);
                return;
            }
            changed = false
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
        let html = await executeJavaScript('MU.getHTML()')
        let base = path.dirname(filePath) + '/'     // Don't forget the trailing slash!
        let setHTMLCommand = `MU.setHTML('${html}', true, '${base}')`
        await executeJavaScript(setHTMLCommand)
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
                { type: 'separator' },
                { role: 'close' }
            ]
        },
        // { role: 'editMenu' }
        {
            label: 'Edit',
            submenu: [
                { 
                    label: 'Undo',
                    // Would be nice to have an icon, but can't just use the native one
                    accelerator: acceleratorFor(keymap.undo),
                    click: () => { executeJavaScript('MU.doUndo()') }
                },
                { 
                    label: 'Redo',
                    // Would be nice to have an icon, but can't just use the native one
                    accelerator: acceleratorFor(keymap.redo),
                    click: () => { executeJavaScript('MU.doRedo()') }
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

/** Return the Format menu, the menu that corresponds to most MarkupEditor functionality */
function formatMenu(config) {
    let menu = {label: 'Format'}
    let submenu = []
    addInsertBarItems(config, submenu)
    addStyleMenuItems(config, submenu)
    addStyleBarItems(config, submenu)
    addFormatBarItems(config, submenu)
    addSearchItem(config, submenu)
    menu.submenu = submenu
    return menu
}

function addInsertBarItems(config, submenu) {
    let {visibility, insertBar} = config.toolbar
    let {link, image, table} = config.keymap

    let linkItem = (visibility.insertBar && insertBar.link) || link
    let imageItem = (visibility.insertBar && insertBar.image) || image
    let tableItem = (visibility.insertBar && insertBar.tableMenu) || table

    if (linkItem || imageItem || tableItem) {
        if (linkItem) {
            submenu.push({
                label: 'Insert Link',
                accelerator: acceleratorFor(link),
                click: () => { executeJavaScript('MU.openLinkDialog()') }
            })
        }
        if (imageItem) {
            submenu.push({
                label: 'Insert Image',
                accelerator: acceleratorFor(image),
                click: () => { executeJavaScript('MU.openImageDialog()') }
            })
        }
        if (tableItem) {
            addTableSubmenu(config, submenu)
        }
        submenu.push({ type: 'separator' })
    }
}

function addTableSubmenu(config, submenu) {
    let {header, border} = config.toolbar.tableMenu

    let dropdown = { label: 'Table' }
    let dropdownmenu = []

    let createmenu = { 
        label: 'Create',
        submenu: [
            {
                label: '1 Row',
                submenu: [
                    { label: '1 Col', click: () => { executeJavaScript('MU.insertTable(1, 1)') } },
                    { label: '2 Cols', click: () => { executeJavaScript('MU.insertTable(1, 2)') } },
                    { label: '3 Cols', click: () => { executeJavaScript('MU.insertTable(1, 3)') } },
                    { label: '4 Cols', click: () => { executeJavaScript('MU.insertTable(1, 4)') } },
                ]
            },
            {
                label: '2 Rows',
                submenu: [
                    { label: '1 Col', click: () => { executeJavaScript('MU.insertTable(2, 1)') } },
                    { label: '2 Cols', click: () => { executeJavaScript('MU.insertTable(2, 2)') } },
                    { label: '3 Cols', click: () => { executeJavaScript('MU.insertTable(2, 3)') } },
                    { label: '4 Cols', click: () => { executeJavaScript('MU.insertTable(2, "4")') } },
                ]
            },
            {
                label: '3 Rows',
                submenu: [
                    { label: '1 Col', click: () => { executeJavaScript('MU.insertTable(3, 1)') } },
                    { label: '2 Cols', click: () => { executeJavaScript('MU.insertTable(3, 2)') } },
                    { label: '3 Cols', click: () => { executeJavaScript('MU.insertTable(3, 3)') } },
                    { label: '4 Cols', click: () => { executeJavaScript('MU.insertTable(3, 4)') } },
                ]
            },
            {
                label: '4 Rows',
                submenu: [
                    { label: '1 Col', click: () => { executeJavaScript('MU.insertTable(4, 1)') } },
                    { label: '2 Cols', click: () => { executeJavaScript('MU.insertTable(4, 2)') } },
                    { label: '3 Cols', click: () => { executeJavaScript('MU.insertTable(4, 3)') } },
                    { label: '4 Cols', click: () => { executeJavaScript('MU.insertTable(4, 4)') } },
                ]
            },
        ]
    }
    dropdownmenu.push(createmenu)

    let addmenu = { label: 'Add' }
    let addsubmenu = [
        {
            label: "Row above",
            click: () => { executeJavaScript('MU.addRow("BEFORE")') }
        },
        {
            label: "Row below",
            click: () => { executeJavaScript('MU.addRow("AFTER")') }
        },
        {
            label: "Column before",
            click: () => { executeJavaScript('MU.addCol("BEFORE")') }
        },
        {
            label: "Column after",
            click: () => { executeJavaScript('MU.addCol("AFTER")') }
        }
    ]
    if (header) {
        addsubmenu.push({
            label: "Header",
            click: () => { executeJavaScript('MU.addHeader()') }
        })
    }
    addmenu.submenu = addsubmenu
    dropdownmenu.push(addmenu)

    let deletemenu = {
        label: 'Delete',
        submenu: [
            {
                label: "Row",
                click: () => { executeJavaScript('MU.deleteTableArea("ROW")') }
            },
            {
                label: "Column",
                click: () => { executeJavaScript('MU.deleteTableArea("COL")') }
            },
            {
                label: "Table",
                click: () => { executeJavaScript('MU.deleteTableArea("TABLE")') }
            }
        ]
    }
    dropdownmenu.push(deletemenu)

    if (border) {
        let bordermenu = {
            label: 'Border',
            submenu: [
                {
                    label: 'All',
                    click: () => { executeJavaScript('MU.borderTable("cell")') }
                },
                {
                    label: 'Outer',
                    click: () => { executeJavaScript('MU.borderTable("outer")') }
                },
                {
                    label: 'Header',
                    click: () => { executeJavaScript('MU.borderTable("header")') }
                },
                {
                    label: 'None',
                    click: () => { executeJavaScript('MU.borderTable("none")') }
                }
            ]
        }
        dropdownmenu.push(bordermenu)
    }

    dropdown.submenu = dropdownmenu
    submenu.push(dropdown)
}

function addStyleMenuItems(config, submenu) {
    let {visibility, styleMenu} = config.toolbar
    let {p, h1, h2, h3, h4, h5, h6, pre} = config.keymap

    let pItem = (visibility.styleMenu && styleMenu.p) || p
    let h1Item = (visibility.styleMenu && styleMenu.h1) || h1
    let h2Item = (visibility.styleMenu && styleMenu.h2) || h2
    let h3Item = (visibility.styleMenu && styleMenu.h3) || h3
    let h4Item = (visibility.styleMenu && styleMenu.h4) || h4
    let h5Item = (visibility.styleMenu && styleMenu.h5) || h5
    let h6Item = (visibility.styleMenu && styleMenu.h6) || h6
    let preItem = (visibility.styleMenu && styleMenu.pre) || pre

    if (pItem || h1Item || h2Item || h3Item || h4Item || h5Item || h6Item || preItem) {
        let dropdown = {label: 'Style'}
        let dropdownmenu = []
        if (pItem) {
            dropdownmenu.push({
                label: pItem,   // pItem is the label to use in this case, not a bool
                accelerator: acceleratorFor(p),
                click: () => { executeJavaScript('MU.setStyle("P")') }
            })
        }
        if (h1Item) {
            dropdownmenu.push({
                label: h1Item,   // h1Item is the label to use in this case, not a bool
                accelerator: acceleratorFor(h1),
                click: () => { executeJavaScript('MU.setStyle("H1")') }
            })
        }
        if (h2Item) {
            dropdownmenu.push({
                label: h2Item,   // h2Item is the label to use in this case, not a bool
                accelerator: acceleratorFor(h2),
                click: () => { executeJavaScript('MU.setStyle("H2")') }
            })
        }
        if (h3Item) {
            dropdownmenu.push({
                label: h3Item,   // h3Item is the label to use in this case, not a bool
                accelerator: acceleratorFor(h3),
                click: () => { executeJavaScript('MU.setStyle("H3")') }
            })
        }
        if (h4Item) {
            dropdownmenu.push({
                label: h4Item,   // h4Item is the label to use in this case, not a bool
                accelerator: acceleratorFor(h4),
                click: () => { executeJavaScript('MU.setStyle("H4")') }
            })
        }
        if (h5Item) {
            dropdownmenu.push({
                label: h5Item,   // h5Item is the label to use in this case, not a bool
                accelerator: acceleratorFor(h5),
                click: () => { executeJavaScript('MU.setStyle("H5")') }
            })
        }
        if (h6Item) {
            dropdownmenu.push({
                label: h6Item,   // h6Item is the label to use in this case, not a bool
                accelerator: acceleratorFor(h6),
                click: () => { executeJavaScript('MU.setStyle("H6")') }
            })
        }
        if (preItem) {
            dropdownmenu.push({
                label: preItem,   // preItem is the label to use in this case, not a bool
                accelerator: acceleratorFor(pre),
                click: () => { executeJavaScript('MU.setStyle("PRE")') }
            })
        }
        dropdown.submenu = dropdownmenu
        submenu.push(dropdown)
        submenu.push({ type: 'separator' })
    }
}

function addStyleBarItems(config, submenu) {
    let {visibility, styleBar} = config.toolbar
    let {bullet, number, indent, outdent} = config.keymap

    let bulletItem = (visibility.styleBar && styleBar.list) || bullet
    let numberItem = (visibility.styleBar && styleBar.list) || number
    let indentItem = (visibility.styleBar && styleBar.dent) || indent
    let outdentItem = (visibility.styleBar && styleBar.dent) || outdent

    if (bulletItem || numberItem || indentItem || outdentItem) {
        if (bulletItem) {
            submenu.push({
                label: 'Bullet List',
                accelerator: acceleratorFor(bullet),
                click: () => { executeJavaScript('MU.toggleListType("UL")') }
            })
        }
        if (numberItem) {
            submenu.push({
                label: 'Number List',
                accelerator: acceleratorFor(number),
                click: () => { executeJavaScript('MU.toggleListType("OL")') }
            })
        }
        if (indentItem) {
            submenu.push({
                label: 'Indent',
                accelerator: acceleratorFor(indent),
                click: () => { executeJavaScript('MU.indent()') }
            })
        }
        if (outdentItem) {
            submenu.push({
                label: 'Outdent',
                accelerator: acceleratorFor(outdent),
                click: () => { executeJavaScript('MU.outdent()') }
            })
        }
        submenu.push({ type: 'separator' })
    }
}

function addFormatBarItems(config, submenu) {
    let {visibility, formatBar} = config.toolbar
    let {bold, italic, underline, code, strikethrough, subscript, superscript} = config.keymap

    let boldItem = (visibility.formatBar && formatBar.bold) || bold
    let italicItem = (visibility.formatBar && formatBar.italic) || italic
    let underlineItem = (visibility.formatBar && formatBar.underline) || underline
    let codeItem = (visibility.formatBar && formatBar.code) || code
    let strikeItem = (visibility.formatBar && formatBar.strikethrough) || strikethrough
    let subItem = (visibility.formatBar && formatBar.subscript) || subscript
    let supItem = (visibility.formatBar && formatBar.superscript) || superscript

    if (boldItem || italicItem || underlineItem || codeItem || strikeItem || subItem || supItem) {
        if (boldItem) {
            submenu.push({
                label: 'Bold',
                accelerator: acceleratorFor(bold),
                click: () => { executeJavaScript('MU.toggleBold()') }
            })
        }
        if (italicItem) {
            submenu.push({
                label: 'Italic',
                accelerator: acceleratorFor(italic),
                click: () => { executeJavaScript('MU.toggleItalic()') }
            })
        }
        if (underlineItem) {
            submenu.push({
                label: 'Underline',
                accelerator: acceleratorFor(underline),
                click: () => { executeJavaScript('MU.toggleUnderline()') }
            })
        }
        if (codeItem) {
            submenu.push({
                label: 'Code',
                accelerator: acceleratorFor(code),
                click: () => { executeJavaScript('MU.toggleCode()') }
            })
        }
        if (strikeItem) {
            submenu.push({
                label: 'Strikethrough',
                accelerator: acceleratorFor(strikethrough),
                click: () => { executeJavaScript('MU.toggleStrike()') }
            })
        }
        if (subItem) {
            submenu.push({
                label: 'Subscript',
                accelerator: acceleratorFor(subscript),
                click: () => { executeJavaScript('MU.toggleSubscript()') }
            })
        }
        if (supItem) {
            submenu.push({
                label: 'Superscript',
                accelerator: acceleratorFor(superscript),
                click: () => { executeJavaScript('MU.toggleSuperscript()') }
            })
        }
        submenu.push({ type: 'separator' })
    }
}

function addSearchItem(config, submenu) {
        if (config.toolbar.visibility.search || config.keymap.search) {
        submenu.push({
            label: 'Search',
            accelerator: acceleratorFor(config.keymap.search),
            click: () => { executeJavaScript('MU.toggleSearch()') }
        })
    }
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
    if (!pm) return null;
    let keys = pm.split('-')
    let accelerator = ''
    // The keys up until the last one are modifiers
    for (let i = 0; i < keys.length - 1; i++) {
        let key = keys[i]
        switch (key) {
            case 'Mod':
                accelerator += 'Cmd'
                break
            case 'Meta':
                accelerator += 'Alt'
                break;
            case '':
                break;  // Ignore unless the last one, which means it is '-'
            default:
                accelerator += key
        }
        accelerator += '+'
    }
    if (keys.length > 1) {
        let key = keys[keys.length - 1]
        if (key.length == 1) {
            if (key == '+') {
                accelerator += 'Plus'
            } else {
                accelerator += key.toUpperCase()
            }
        } else if (key.length == 0) {
            accelerator += 'Minus'
        } else {
            accelerator += key
        }
    }
    return accelerator
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
