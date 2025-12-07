import { MU } from "../markupeditor.esm.js"

/** 
 * A MarkupDelegate that invokes the `window.markupAPI` as needed for callbacks.
 * The `window.markupAPI` is defined in preload.js.
 */
class DesktopDelegate {

    constructor() {}

    markupInput(editor) {
        // Ref the definition in preload.js
        window.markupAPI.markupInput()
    }

    markupSelectImage(editor) {
        // Ref the definition in preload.js
        window.markupAPI.selectImage()
    }
}

/**
 * We must register the DesktopDelegate and configs, so that they can be looked up 
 * later by name in the MarkupEditor web component.
 */
MU.registerDelegate(new DesktopDelegate())
MU.registerConfig(MU.ToolbarConfig.desktop(), 'DesktopToolbar')     // A ToolbarConfig suitable for desktop usage, featuring a full toolbar.
MU.registerConfig(MU.BehaviorConfig.desktop(), 'DesktopBehavior')   // A BehaviorConfig suitable for desktop usage, featuring selection of local images.
MU.registerConfig(MU.KeymapConfig.desktop(), 'DesktopKeymap')       // A KeymapConfig suitable for desktop usage, featuring hotkeys for underline, sub and superscript.