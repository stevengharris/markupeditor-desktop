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

/** A ToolbarConfig suitable for desktop usage, featuring a full toolbar. */
class DesktopToolbar {

    constructor() {
        Object.assign(this, MU.ToolbarConfig.desktop())
    }
}

/** A BehaviorConfig suitable for desktop usage, featuring selection of local images. */
class DesktopBehavior {
    
    constructor() {
        Object.assign(this, MU.BehaviorConfig.desktop())
    }

}

/** A KeymapConfig suitable for desktop usage, featuring hotkeys for underline, sub and superscript. */
class DesktopKeymap {

    constructor() {
        Object.assign(this, MU.KeymapConfig.desktop())
    }
}

/**
 * We must register the MarkupDelegate and configs, so that they can be looked up 
 * later by name in the MarkupEditor web component.
 */

MU.registerDelegate(new DesktopDelegate())
MU.registerConfig(new DesktopToolbar())
MU.registerConfig(new DesktopBehavior())
MU.registerConfig(new DesktopKeymap())