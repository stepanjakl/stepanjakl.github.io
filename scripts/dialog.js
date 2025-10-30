/**
 * ARIA Dialog - Universal Modal Dialog Manager
 *
 * A standalone, reusable dialog/modal management system with proper ARIA accessibility.
 * This file is intentionally generic and can be used in any project.
 *
 * Features:
 * - Accessible modal dialogs with focus trapping
 * - Keyboard navigation (Escape key support)
 * - Dialog stacking support
 * - Lifecycle hooks for custom initialization/cleanup
 * - Backdrop management
 * - Self-contained styling (no external CSS dependencies)
 *
 * Usage:
 * 1. Include this file in your project
 * 2. Call openDialog(dialogId, focusAfterClosed, focusFirst, hash) to open a modal
 * 3. Call closeDialog(hash) to close the current modal
 * 4. Register lifecycle hooks with aria.registerLifecycleHooks(dialogId, { initialize, cleanup })
 *
 * Inspired by: https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/examples/dialog/
 */

// Inject backdrop styles (self-contained, no external dependencies)
(function injectDialogStyles() {
    const styleId = 'aria-dialog-styles'
    if (document.getElementById(styleId)) return

    const style = document.createElement('style')
    style.id = styleId
    style.textContent = `
        .dialog-backdrop {
            display: contents;
        }
    `
    document.head.appendChild(style)
})()

var aria = aria || {}

/**
 * Valid ARIA roles for dialogs
 */
aria.VALID_DIALOG_ROLES = Object.freeze(['dialog', 'alertdialog'])

/**
 * Lifecycle hooks registry
 * External code can register initialization and cleanup callbacks for specific dialog IDs
 * @example
 * aria.registerLifecycleHooks('modal-profile', {
 *   initialize: () => console.log('Profile modal opened'),
 *   cleanup: () => console.log('Profile modal closed')
 * })
 */
aria.lifecycleHooks = aria.lifecycleHooks || {}

/**
 * Register lifecycle hooks for a specific dialog
 * @param {string} dialogId - The ID of the dialog
 * @param {Object} hooks - Object containing initialize and/or cleanup functions
 * @param {Function} hooks.initialize - Called when dialog opens
 * @param {Function} hooks.cleanup - Called when dialog closes
 */
aria.registerLifecycleHooks = (dialogId, hooks) => {
    aria.lifecycleHooks[dialogId] = hooks
}

/**
 * Utility functions for dialog accessibility and DOM manipulation
 */
aria.Utils = aria.Utils || {
    IgnoreUtilFocusChanges: false,
    dialogOpenClass: 'has-dialog',
    backdropClass: 'dialog-backdrop',
    focusDataAttr: 'data-focus-after-click',

    matches: (element, selector) => {
        const proto = Element.prototype
        const func = proto.matches || proto.matchesSelector || proto.webkitMatchesSelector ||
            proto.mozMatchesSelector || proto.msMatchesSelector || proto.oMatchesSelector ||
            function (s) {
                return Array.from(this.parentNode.querySelectorAll(s)).includes(this)
            }
        return func.call(element, selector)
    },

    remove: (item) => {
        item.remove ? item.remove() : item.parentNode && item.parentNode.removeChild(item)
    },

    isFocusable: (element) => {
        if (element.tabIndex < 0 || element.disabled) return false

        switch (element.nodeName) {
            case 'A':
                return !!element.href && element.rel != 'ignore'
            case 'INPUT':
                return element.type != 'hidden'
            case 'BUTTON':
            case 'SELECT':
            case 'TEXTAREA':
            case 'LABEL':
                return true
            default:
                return false
        }
    },

    focusFirstDescendant: (element) => {
        for (const child of element.childNodes) {
            if (aria.Utils.attemptFocus(child) || aria.Utils.focusFirstDescendant(child)) return true
        }
        return false
    },

    focusLastDescendant: (element) => {
        for (let i = element.childNodes.length - 1; i >= 0; i--) {
            const child = element.childNodes[i]
            if (aria.Utils.attemptFocus(child) || aria.Utils.focusLastDescendant(child)) return true
        }
        return false
    },

    attemptFocus: (element) => {
        if (!aria.Utils.isFocusable(element)) return false
        aria.Utils.IgnoreUtilFocusChanges = true
        element.focus()
        aria.Utils.IgnoreUtilFocusChanges = false
        return document.activeElement === element
    },
}

/**
 * Call registered lifecycle hooks for a dialog
 * @private
 * @param {string} dialogId - The ID of the dialog
 * @param {string} hookType - Either 'initialize' or 'cleanup'
 */
aria.callLifecycleHook = (dialogId, hookType) => {
    const hooks = aria.lifecycleHooks[dialogId]
    if (hooks && typeof hooks[hookType] === 'function') {
        hooks[hookType]()
    }
}

/**
 * Stack of currently open dialogs
 */
aria.OpenDialogList = aria.OpenDialogList || []

/**
 * Get the topmost dialog from the stack
 * @returns {aria.Dialog|undefined} The current dialog or undefined
 */
aria.getCurrentDialog = () => aria.OpenDialogList[aria.OpenDialogList.length - 1]

/**
 * Close the current dialog if one exists
 * @returns {boolean} True if a dialog was closed, false otherwise
 */
aria.closeCurrentDialog = () => {
    const currentDialog = aria.getCurrentDialog()
    if (currentDialog) {
        currentDialog.close()
        return true
    }
    return false
}

/**
 * Handle escape key press to close dialogs
 * @param {KeyboardEvent} event - The keyboard event
 */
aria.handleEscape = (event) => {
    const key = event.which || event.keyCode
    if (key === 27 && aria.closeCurrentDialog()) {
        event.stopPropagation()
    }
}

document.addEventListener('keyup', aria.handleEscape)

/**
 * Add or retrieve backdrop element for a dialog
 * @param {string} dialogId - The ID of the dialog element
 * @returns {HTMLElement} The backdrop element
 */
aria.addBackdrop = (dialogId) => {
    const dialogNode = document.getElementById(dialogId)
    if (!dialogNode) return null

    const backdropClass = aria.Utils.backdropClass
    const parentNode = dialogNode.parentNode

    // Return existing backdrop if present
    if (parentNode.classList.contains(backdropClass)) {
        return parentNode
    }

    // Create new backdrop
    const backdropNode = document.createElement('div')
    backdropNode.className = backdropClass
    parentNode.insertBefore(backdropNode, dialogNode)
    backdropNode.appendChild(dialogNode)

    return backdropNode
}

/**
 * ARIA Dialog Constructor
 * Creates an accessible modal dialog with proper focus management
 *
 * @param {string} dialogId - The ID of the dialog element
 * @param {string|HTMLElement} focusAfterClosed - Element to focus when dialog closes
 * @param {string|HTMLElement|null} focusFirst - Element to focus when dialog opens (optional)
 * @param {string} hash - URL hash to set when dialog opens (optional)
 */
aria.Dialog = function (dialogId, focusAfterClosed, focusFirst, hash) {
    // Constants
    this.FOCUS_TRAP_CLASS = 'contents'
    this.ACTIVE_CLASS = 'active'

    // Core elements
    this.dialogId = dialogId
    this.dialogNode = document.getElementById(dialogId)
    if (!this.dialogNode) {
        throw new Error(`No element found with id="${dialogId}".`)
    }

    // Validate ARIA role
    this.validateDialogRole()

    // Setup backdrop
    this.backdropNode = aria.addBackdrop(dialogId)
    if (!this.backdropNode) {
        throw new Error(`Failed to create backdrop for dialog "${dialogId}".`)
    }

    // Activate dialog
    this.backdropNode.classList.add(this.ACTIVE_CLASS)
    document.body.classList.add(aria.Utils.dialogOpenClass)

    // Setup focus management
    this.setupFocusElements(focusAfterClosed, focusFirst)

    // Create focus trap sentinel nodes
    this.createFocusTrapNodes()

    // Bind event handlers
    this.boundTrapFocus = this.trapFocus.bind(this)

    // Manage dialog stack
    if (aria.OpenDialogList.length > 0) {
        aria.getCurrentDialog().removeListeners()
    }

    this.addListeners()
    aria.OpenDialogList.push(this)

    // Handle initial focus with double rAF for proper rendering
    this.handleInitialFocus(hash)
}

/**
 * Validate that the dialog has a proper ARIA role
 * @private
 */
aria.Dialog.prototype.validateDialogRole = function () {
    const role = (this.dialogNode.getAttribute('role') || '').trim()
    const roles = role.split(/\s+/g)
    const hasValidRole = roles.some(token => aria.VALID_DIALOG_ROLES.includes(token))

    if (!hasValidRole) {
        throw new Error('Dialog() requires a DOM element with ARIA role of dialog or alertdialog.')
    }
}

/**
 * Setup focus management elements
 * @private
 * @param {string|HTMLElement} focusAfterClosed - Element to focus when closing
 * @param {string|HTMLElement|null} focusFirst - Element to focus when opening
 */
aria.Dialog.prototype.setupFocusElements = function (focusAfterClosed, focusFirst) {
    // Convert string IDs to elements
    this.focusAfterClosed = typeof focusAfterClosed === 'string'
        ? document.getElementById(focusAfterClosed)
        : focusAfterClosed

    if (!this.focusAfterClosed) {
        throw new Error('The focusAfterClosed parameter is required for the aria.Dialog constructor.')
    }

    this.focusFirst = typeof focusFirst === 'string'
        ? document.getElementById(focusFirst)
        : focusFirst || null

    // Validate focusFirst has a focus method if it's not null
    if (this.focusFirst && typeof this.focusFirst.focus !== 'function') {
        console.warn('aria.Dialog: focusFirst element does not have a focus() method, will use default focus behavior', this.focusFirst)
        this.focusFirst = null
    }
}

/**
 * Create sentinel nodes for focus trapping
 * @private
 */
aria.Dialog.prototype.createFocusTrapNodes = function () {
    // Pre-dialog focus trap
    this.preNode = document.createElement('div')
    this.preNode.tabIndex = 0
    this.preNode.className = this.FOCUS_TRAP_CLASS
    this.dialogNode.parentNode.insertBefore(this.preNode, this.dialogNode)

    // Post-dialog focus trap
    this.postNode = document.createElement('div')
    this.postNode.tabIndex = 0
    this.postNode.className = this.FOCUS_TRAP_CLASS
    this.dialogNode.parentNode.insertBefore(this.postNode, this.dialogNode.nextSibling)
}

/**
 * Handle initial focus when dialog opens
 * @private
 * @param {string} hash - URL hash to set
 */
aria.Dialog.prototype.handleInitialFocus = function (hash) {
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            if (hash) window.location.hash = hash

            if (this.focusFirst && typeof this.focusFirst.focus === 'function') {
                this.focusFirst.focus()
            } else {
                aria.Utils.focusFirstDescendant(this.dialogNode)
            }
            this.lastFocus = document.activeElement
        })
    })
}

/**
 * Close the dialog and restore focus
 * @param {string} hash - URL hash to set after closing (optional)
 */
aria.Dialog.prototype.close = function (hash) {
    // Remove from stack
    aria.OpenDialogList.pop()

    // Remove event listeners
    this.removeListeners()

    // Clean up focus trap nodes
    aria.Utils.remove(this.preNode)
    aria.Utils.remove(this.postNode)

    // Deactivate backdrop
    this.backdropNode.classList.remove(this.ACTIVE_CLASS)

    // Restore focus and handle cleanup
    requestAnimationFrame(() => {
        if (hash) window.location.hash = hash

        // Mark element for focus styling
        this.focusAfterClosed.setAttribute(aria.Utils.focusDataAttr, 'true')
        this.focusAfterClosed.focus()

        // Clean up focus attribute after blur
        const handleBlur = (event) => {
            if (event.target !== document.activeElement) {
                event.target.removeAttribute(aria.Utils.focusDataAttr)
                event.target.removeEventListener('blur', handleBlur)
            }
        }

        this.focusAfterClosed.addEventListener('blur', handleBlur)

        // Restore previous dialog listeners or remove body class
        if (aria.OpenDialogList.length > 0) {
            aria.getCurrentDialog().addListeners()
        } else {
            document.body.classList.remove(aria.Utils.dialogOpenClass)
        }
    })
}

/**
 * Replace current dialog with a new one (for dialog switching)
 * @param {string} newDialogId - The ID of the new dialog
 * @param {string|HTMLElement} newFocusAfterClosed - Element to focus when new dialog closes
 * @param {string|HTMLElement|null} newFocusFirst - Element to focus when new dialog opens
 * @param {string} hash - URL hash to set
 */
aria.Dialog.prototype.replace = function (newDialogId, newFocusAfterClosed, newFocusFirst, hash) {
    // Clean up current modal-specific features
    aria.callLifecycleHook(this.dialogId, 'cleanup')

    // Remove from stack
    aria.OpenDialogList.pop()

    // Remove event listeners
    this.removeListeners()

    // Clean up focus trap nodes
    aria.Utils.remove(this.preNode)
    aria.Utils.remove(this.postNode)

    // Deactivate backdrop
    this.backdropNode.classList.remove(this.ACTIVE_CLASS)

    // Preserve focus target if not specified
    const focusAfterClosed = newFocusAfterClosed || this.focusAfterClosed

    // Create new dialog
    new aria.Dialog(newDialogId, focusAfterClosed, newFocusFirst, hash)

    // Initialize new modal-specific features
    aria.callLifecycleHook(newDialogId, 'initialize')
}

/**
 * Add focus trap event listeners
 */
aria.Dialog.prototype.addListeners = function () {
    document.addEventListener('focus', this.boundTrapFocus, true)
}

/**
 * Remove focus trap event listeners
 */
aria.Dialog.prototype.removeListeners = function () {
    document.removeEventListener('focus', this.boundTrapFocus, true)
}

/**
 * Trap focus within the dialog
 * @param {FocusEvent} event - The focus event
 */
aria.Dialog.prototype.trapFocus = function (event) {
    if (aria.Utils.IgnoreUtilFocusChanges) return

    const currentDialog = aria.getCurrentDialog()
    if (!currentDialog) return

    if (currentDialog.dialogNode.contains(event.target)) {
        currentDialog.lastFocus = event.target
    } else {
        aria.Utils.focusFirstDescendant(currentDialog.dialogNode)
        if (currentDialog.lastFocus === document.activeElement) {
            aria.Utils.focusLastDescendant(currentDialog.dialogNode)
        }
        currentDialog.lastFocus = document.activeElement
    }
}

/**
 * Open a dialog or replace the current one
 * Global function for opening dialogs with proper lifecycle management
 *
 * @param {string} dialogId - The ID of the dialog to open
 * @param {string|HTMLElement} focusAfterClosed - Element to focus when dialog closes
 * @param {string|HTMLElement|null} focusFirst - Element to focus when dialog opens (optional)
 * @param {string} hash - URL hash to set (optional)
 */
window.openDialog = (dialogId, focusAfterClosed, focusFirst, hash) => {
    if (aria.OpenDialogList.length > 0) {
        const topDialog = aria.getCurrentDialog()
        topDialog.replace(dialogId, focusAfterClosed, focusFirst, hash)
    } else {
        new aria.Dialog(dialogId, focusAfterClosed, focusFirst, hash)
    }

    // Initialize modal-specific features
    aria.callLifecycleHook(dialogId, 'initialize')
}

/**
 * Close the current dialog
 * Global function for closing dialogs with proper cleanup
 *
 * @param {string} hash - URL hash to set after closing (optional)
 */
window.closeDialog = (hash) => {
    const topDialog = aria.getCurrentDialog()
    if (!topDialog) return

    // Clean up modal-specific features
    if (topDialog.dialogNode) {
        aria.callLifecycleHook(topDialog.dialogId, 'cleanup')
    }

    topDialog.close(hash)
}
