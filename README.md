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
* Customizable ordering of toolbar contents.
* Customizable icons for toolbar.
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

The MarkupEditor desktop application is built using the [markupeditor](https://github.com/stevengharris/markupeditor-base) package. 
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

Open the MarkupEditor. Use the options under the File menu to open, save, etc.

```
npm start
```

## Packaging the MarkupEditor MacOS desktop app

The project makes use of [Electron Forge](https://www.electronforge.io) to build the native desktop app.
The forge configuration is in forge.config.mjs because everything else in this project uses ES modules,
and the config as provided from a "normal" forge.config.js file fails to find a a "darwin" make target
unless everything is set up to use ES modules. Sigh.

```
npm run make
```

Running this script will produce an `out/MarkupEditor-${platform}-${arch}` directory containing MarkupEditor.app 
that can be double-clicked on in Finder or placed in the Applications directory for easier access.

### App Icon

The MarkupEditor icon is defined using SVG. To provide a proper icon for the application, it needs to be 
repackaged into a MacOS-native .icns form, which can be created using iconutil from a set of PNG files 
of various resolutions. To do this transformation, use the svg_to_icns.sh shell script, which in turn 
depends on availability of svg2png, which you can install using `brew install svg2png`. See the comments 
in icons/svg_to_icns.sh script for details.

### Packaging When Using A Local Dependency On The markupeditor Project

If you use a local clone of the [markupeditor](https://github.com/stevengharris/markupeditor-base) project,
then node_modules/markupeditor will be a symlink to that clone (your package.json uses something like 
`"markupeditor": "file:../markupeditor-base"` in `dependencies`). The Electron Forge `make` script will fail 
during the "Finalizing package" step with an error like: `file "../markupeditor-base" links out of the package`.
The markupeditor project files need to be present in node_modules, not a symlink. As a workaround, you can 
copy them into place in node_modules. This kind of defeats the purpose of symlinking to the local clone 
but is better than not being able to package from your local work. For example:

```
$ cd node_modules
$ rm ./markupeditor                                             <- Remove the symlink
$ mkdir markupeditor                                            <- A real directory
$ cp -r ../../markupeditor-base/dist/ ./markupeditor/dist/      <- As specified in markupeditor package.json files
$ cp -r ../../markupeditor-base/bin/ ./markupeditor/bin/        <- As specified in markupeditor package.json files
$ cp -r ../../markupeditor-base/styles/ ./markupeditor/styles/  <- As specified in markupeditor package.json files
```