<p align="center">
    <img alt="The MarkupEditor logo" src="https://github.com/user-attachments/assets/c67b6aa0-2576-4a0b-81d0-229ee501b59d" width="96px" height="96px" >
</p>

# MarkupEditor Desktop

The MarkupEditor desktop application is for creating and editing HTML content. It embeds the functionality of the [MarkupEditor base]() project 
in an Electron app.

### Motivation

Like Markdown, the MarkupEditor keeps the focus on what you're writing, with a minimum of distractions. Like Markdown, it supports just enough 
functionality to help you organize and format your writing to get your points across effectively. Unlike Markdown, the MarkupEditor's WYSIWYG 
approach means you always see what you're writing presented properly as you write it, instead of dealing with the distractions of composing 
text with embedded notations and the uncertainty of how that text is later translated to HTML and presented.

## Try

You can try the MarkupEditor out right from the [project web site](https://stevengharris.github.io/markupeditor-base/). 
The web site has all the information you need to use the MarkupEditor in your application. If you just want to install and use
the desktop tool, for now you need to follow the instructions below.

## Install

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

Open the MarkupEditor. Use the options under the File menu to open, save, etc.

```
npm start
```

### More TBD