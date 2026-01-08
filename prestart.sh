#!/bin/bash

echo "Setting a symlink for markup-editor.mjs..."
set -v
ln -fs ./node_modules/markupeditor/dist/markup-editor.js ./markup-editor.mjs