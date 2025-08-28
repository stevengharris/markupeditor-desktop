class MarkupDelegate {

    constructor() {}

    markupSelectImage(editor) {
        // Ref the definition in preload.js
        window.markupAPI.selectImage()
    }
}

new MU.MarkupEditor(
    document.querySelector('#editor'), 
    {
        placeholder: 'Edit the document...',
        keymap: MU.KeymapConfig.desktop(),
        behavior: MU.BehaviorConfig.desktop(),
        delegate: new MarkupDelegate()
    }
)