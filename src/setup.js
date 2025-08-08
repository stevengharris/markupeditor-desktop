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
}

new MU.MarkupEditor(
    document.querySelector('#editor'), 
    {
        placeholder: 'Edit the document...',
        delegate: new MarkupDelegate()
    }
)