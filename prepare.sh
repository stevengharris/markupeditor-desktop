#!/bin/bash

echo "Symlinking to MarkupEditor base script and web component..."
ln -sf ./node_modules/markupeditor/markupeditor.esm.js markupeditor.esm.js
ln -sf ./node_modules/markupeditor/markup-editor.js markup-editor.js