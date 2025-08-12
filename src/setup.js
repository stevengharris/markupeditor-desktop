class MarkupDelegate {

    constructor() {
        this.changed = false
    }

    markupInput() {
        this.changed = true
    }

    markupSelectImage(editor) {
        // Ref the definition in preload.js
        window.markupAPI.selectImage()
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