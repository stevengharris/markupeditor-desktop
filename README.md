<p align="center">
    <img alt="The MarkupEditor logo" src="https://github.com/user-attachments/assets/c67b6aa0-2576-4a0b-81d0-229ee501b59d" width="96px" height="96px" >
</p>

# MarkupEditor Desktop

The MarkupEditor desktop application is for creating and editing HTML content. It embeds the functionality of the 
[MarkupEditor base](https://github.com/stevengharris/markupeditor-base) project in an Electron app with access to 
the local file system. Images added from the local file system during editing are automatically saved to the same 
directory as the document, so they are referenced within the HTML as local resources and not dependent on where 
they originated.

## Features

The MarkupEditor's standard editing features are generally limited to what 
[Github Flavored Markdown](https://github.github.com/gfm/) supports. It does, however, have support 
for some functionality beyond that baseline. As a WYSIWYG editor, it supports the kind of functionality that 
even non-developers expect when they edit a document, like image resizing and search.

* Customizable and extensible toolbar providing access to all editing features, auto-sized to width.
* Customizable key mappings for hot-key access to editing features.
* Paragraph styles corresponding to P, H1-H6, and `CODE`.
* Bold, italic, underline, strikethrough, subscript, superscript, and code text formatting.
* Insert and edit links, images (local and https src), and tables.
* Bulleted and numbered lists.
* Indent/outdent.
* Comprehensive undo/redo.
* Search.
* Image resizing using gestures.
* Table editing: visually select table size, add/remove row/column/header, border options.

## Learn More

The MarkupEditor desktop application is built using the [MarkupEditor base](https://github.com/stevengharris/markupeditor-base) package. 
You can learn more about the underlying technology and other ways it is being used by visiting the 
[project web site](https://stevengharris.github.io/markupeditor-base/). 

## Install

If you just want to install and use
the desktop tool, for now you need to follow the instructions below.

Clone the repository.

```
git clone https://github.com/stevengharris/markupeditor-desktop.git
```

You need node/npm installed. Install the dependencies.

```
cd markupeditor-desktop
npm install
```

Build the project.

```
npm run build
```

Open the MarkupEditor during development. Use the options under the File menu to open, save, etc.

```
npm start
```

## Packaging the MarkupEditor MacOS desktop app

```
npx @electron/packager . --icon build/markupicon.icns --overwrite
```

This will produce a MarkupEditor-${platform}-${arch} directory containing MarkupEditor.app that 
can be double-clicked on in Finder or placed in the Applications directory for easier access.