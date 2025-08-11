class MarkupDelegate {

    constructor() {
        this.changed = false
    }

    markupInput() {
        this.changed = true
    }

    markupImageAdded(editor, src, divId) {
        // Ref the definition in preload.js
        window.markupAPI.addedImage(src)
    }

    markupInsertImage(editor) {
        // Ref the definition in preload.js
        window.markupAPI.insertImage()
    }
}

new MU.MarkupEditor(
    document.querySelector('#editor'), 
    {
        placeholder: 'Edit the document...',
        behavior: MU.BehaviorConfig.desktop(),
        delegate: new MarkupDelegate()
    }
)