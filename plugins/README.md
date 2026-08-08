# MarkupEditor Plugins

This document describes what a MarkupEditor plugin is and how to create one. The document is intended for developers and references the foundational libraries the MarkupEditor is built on. 

A plugin is a JavaScript module that the MarkupEditor loads when it opens. Every plugin has a string `name` and `type`. The `type` can either be “exporter” or “codeview”:

* An **Exporter** can be invoked from the File->Export menu and let you transform the document into a form other than Markdown.

  * The editor supports HTML and PDF export at installation.

* A **CodeView** displays the contents of a code block based on the language in that code block.

  * The editor supports Mermaid diagrams at installation.

## Plugin API

Besides its name and type properties, a plugin exposes its run method that can be invoked from Swift using MU.runPlugin(name).

## Reference Plugins

The DocX Exporter and the Mermaid diagram CodeView are provided as fully supported examples you can use to model your own plugins on.

DocX Exporter

Mermaid Diagrams