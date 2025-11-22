/**
 * ARIA Dialog - Universal Modal Dialog Manager
 *
 * A standalone, reusable dialog/modal management system with proper ARIA accessibility
 * This file is intentionally generic and can be used in any project
 *
 * Features:
 * - Accessible modal dialogs with focus trapping
 * - Keyboard navigation (Escape key support)
 * - Dialog stacking support
 * - Lifecycle hooks for custom initialisation/cleanup
 * - Backdrop management
 * - Self-contained styling (no external CSS dependencies)
 * - Flexible inert management via data-inert-target attribute
 *
 * Usage:
 * 1. Include this file in your project
 * 2. Call openDialog(dialogId, focusAfterClosed, focusFirst, hash) to open a modal
 * 3. Call closeDialog(hash) to close the current modal
 * 4. Register lifecycle hooks with aria.registerLifecycleHooks(dialogId, { initialize, cleanup })
 * 5. Optional: Add data-inert-target="childElementId" to apply inert to a child element
 *    instead of the dialog itself (useful for focus trapping a parent container)
 *
 * Inspired by: https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/examples/dialog/
 */

// ============================================================================
// ARIA Namespace & Utilities
// ============================================================================

var aria = aria || {}

/**
 * External focus trap flag
 * Set this to true from external code to temporarily disable dialog focus trapping
 * Useful for higher-priority overlays (popups, tooltips, etc.) that appear above dialogs
 * @type {boolean}
 */
aria.externalFocusTrapActive = false

/**
 * Double requestAnimationFrame helper - ensures callback runs after browser paint
 * Useful for DOM changes that need to sync with layout/paint cycle
 * @param {Function} callback - Function to execute after paint
 */
function afterPaint(callback) {
    requestAnimationFrame(() => {
        requestAnimationFrame(callback)
    })
}

// Lightweight local DOM getter with caching
// Keeps dialog.js standalone while avoiding repeated document.getElementById calls
aria._elCache = aria._elCache || {}

/**
 * Get element by ID with caching. Accepts either an id string or an element
 * @param {string|HTMLElement} idOrEl - Element ID or element itself
 * @returns {HTMLElement|null} Element or null if not found
 */
aria.getEl = (idOrEl) => {
    if (!idOrEl) return null
    if (typeof idOrEl !== 'string') return idOrEl
    return aria._elCache[idOrEl] ??= document.getElementById(idOrEl)
}

// Inject backdrop styles (self-contained, no external dependencies)
(function injectDialogStyles() {
    const styleId = 'aria-dialog-styles'
    if (aria.getEl(styleId)) return

    const style = document.createElement('style')
    style.id = styleId
    style.textContent = `
        .dialog-backdrop,
        .dialog-backdrop .focus-trap-node {
            display: contents;
        }

        /* Polyfill for inert attribute (browsers pre-2023) */
        [data-inert-polyfill] {
            pointer-events: none;
            user-select: none;
            -webkit-user-select: none;
        }
    `
    document.head.appendChild(style)
})()

// ============================================================================
// Inert Polyfill
// ============================================================================

/**
 * Inert Polyfill - Fallback for browsers without native inert support
 * Provides aria-hidden and prevents focus for older browsers
 */
aria.supportsInert = 'inert' in HTMLElement.prototype

/**
 * Set element as inert (with polyfill for older browsers)
 * @param {HTMLElement} element - Element to make inert
 */
aria.setInert = (element) => {
    if (!element) return

    if (aria.supportsInert) {
        element.setAttribute('inert', '')
    } else {
        // Polyfill: prevent interaction and focus
        element.setAttribute('aria-hidden', 'true')
        element.setAttribute('data-inert-polyfill', '')

        // Store original tabindex values and set all focusable elements to -1
        const focusableElements = element.querySelectorAll(
            'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )

        if (!element._inertTabindexMap) {
            element._inertTabindexMap = new WeakMap()
        }

        focusableElements.forEach(el => {
            const currentTabindex = el.getAttribute('tabindex')
            element._inertTabindexMap.set(el, currentTabindex)
            el.setAttribute('tabindex', '-1')
        })
    }
}

/**
 * Remove inert from element (with polyfill cleanup)
 * @param {HTMLElement} element - Element to make interactive
 */
aria.removeInert = (element) => {
    if (!element) return

    if (aria.supportsInert) {
        element.removeAttribute('inert')
    } else {
        // Polyfill cleanup: restore interaction and focus
        element.removeAttribute('aria-hidden')
        element.removeAttribute('data-inert-polyfill')

        // Restore original tabindex values
        if (element._inertTabindexMap) {
            const focusableElements = element.querySelectorAll('[tabindex="-1"]')

            focusableElements.forEach(el => {
                const originalTabindex = element._inertTabindexMap.get(el)
                if (originalTabindex === null) {
                    el.removeAttribute('tabindex')
                } else if (originalTabindex !== undefined) {
                    el.setAttribute('tabindex', originalTabindex)
                } else {
                    // Element had tabindex="-1" originally, keep it
                }
            })

            element._inertTabindexMap = null
        }
    }
}

// ============================================================================
// Dialog Configuration
// ============================================================================

/**
 * Valid ARIA roles for dialogs
 */
aria.VALID_DIALOG_ROLES = Object.freeze(['dialog', 'alertdialog'])

// ============================================================================
// Lifecycle Hooks
// ============================================================================

/**
 * Lifecycle hooks registry
 * External code can register initialisation and cleanup callbacks for specific dialog IDs
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

// ============================================================================
// Utility Functions
// ============================================================================

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

// ============================================================================
// Dialog Stack Management
// ============================================================================

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
 * @param {string} hash - Optional hash to set after closing
 * @returns {boolean} True if a dialog was closed, false otherwise
 */
aria.closeCurrentDialog = (hash) => {
    const currentDialog = aria.getCurrentDialog()
    if (currentDialog) {
        currentDialog.close(hash)
        return true
    }
    return false
}

/**
 * Add or retrieve backdrop element for a dialog
 * @param {string} dialogId - The ID of the dialog element
 * @returns {HTMLElement} The backdrop element
 */
aria.addBackdrop = (dialogId) => {
    const dialogNode = aria.getEl(dialogId)
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

// ============================================================================
// Dialog Constructor
// ============================================================================

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
    this.FOCUS_TRAP_NODE_CLASS = 'focus-trap-node'
    this.ACTIVE_CLASS = 'active'

    // Core elements
    this.dialogId = dialogId
    this.dialogNode = aria.getEl(dialogId)
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

    // Determine which element should receive inert management
    // This allows focus trapping on a parent container while only applying inert to a child
    // Example: <div role="dialog" id="parent" data-inert-target="child">
    //            <button>Close</button> <!-- focusable, outside inert -->
    //            <div id="child" inert>...</div> <!-- receives inert management -->
    //          </div>
    const inertTargetId = this.dialogNode.getAttribute('data-inert-target')
    this.inertNode = inertTargetId
        ? aria.getEl(inertTargetId)
        : this.dialogNode

    if (!this.inertNode) {
        console.warn(`Inert target "${inertTargetId}" not found, falling back to dialog node`)
        this.inertNode = this.dialogNode
    }

    // Remove inert from the target element (with polyfill support)
    try {
        aria.removeInert(this.inertNode)
    } catch (error) {
        console.error(`Failed to remove inert from dialog "${dialogId}":`, error)
    }

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

// ============================================================================
// Dialog Prototype Methods
// ============================================================================

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
        ? aria.getEl(focusAfterClosed)
        : focusAfterClosed

    if (!this.focusAfterClosed) {
        throw new Error('The focusAfterClosed parameter is required for the aria.Dialog constructor.')
    }

    this.focusFirst = typeof focusFirst === 'string'
        ? aria.getEl(focusFirst)
        : focusFirst || null

    // Validate focusFirst has a focus method if it's not null
    if (this.focusFirst && typeof this.focusFirst.focus !== 'function') {
        console.warn('aria.Dialog: focusFirst element does not have a focus() method, will use default focus behaviour', this.focusFirst)
        this.focusFirst = null
    }
}

/**
 * Create sentinel nodes for focus trapping
 * Extracts common logic to reduce duplication
 * @private
 */
aria.Dialog.prototype.createFocusTrapNodes = function () {
    /**
     * Helper to create a focus trap sentinel node
     * Reduces duplication between pre/post nodes
     * @param {string} position - 'before' or 'after' for debugging context
     * @returns {HTMLElement} Configured sentinel node
     */
    const createSentinel = (position) => {
        const node = document.createElement('div')
        node.tabIndex = 0
        node.className = this.FOCUS_TRAP_NODE_CLASS
        // Optional: add data attribute for debugging
        // node.setAttribute('data-trap-position', position)
        return node
    }

    // Pre-dialog focus trap (before dialog in DOM)
    this.preNode = createSentinel('before')
    this.dialogNode.parentNode.insertBefore(this.preNode, this.dialogNode)

    // Post-dialog focus trap (after dialog in DOM)
    this.postNode = createSentinel('after')
    this.dialogNode.parentNode.insertBefore(this.postNode, this.dialogNode.nextSibling)
}

/**
 * Handle initial focus when dialog opens
 * @private
 * @param {string} hash - URL hash to set
 */
aria.Dialog.prototype.handleInitialFocus = function (hash) {
    afterPaint(() => {
        if (hash) window.location.hash = hash

        if (this.focusFirst && typeof this.focusFirst.focus === 'function') {
            this.focusFirst.focus()
        } else {
            aria.Utils.focusFirstDescendant(this.dialogNode)
        }
        this.lastFocus = document.activeElement
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

    // Make the inert target element inert when closed (with polyfill support)
    aria.setInert(this.inertNode)

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

    // Make old dialog's inert target inert (with polyfill support)
    aria.setInert(this.inertNode)

    // Preserve focus target if not specified
    const focusAfterClosed = newFocusAfterClosed || this.focusAfterClosed

    // Create new dialog
    new aria.Dialog(newDialogId, focusAfterClosed, newFocusFirst, hash)

    // Initialise new modal-specific features
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

    // Don't trap focus if external focus trap is active (e.g., popup, tooltip)
    if (aria.externalFocusTrapActive) return

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

// ============================================================================
// Global Functions
// ============================================================================

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

    // Initialise modal-specific features
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

    // ============================================================================
    // Initialisation
    // ============================================================================

    /**
     * Initialise inert state for all dialogs on page load
     * Applies inert programmatically to all dialog elements to prevent
     * interaction when they are not open
     */
    ; (function initializeDialogInertState() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', applyInertToDialogs)
        } else {
            applyInertToDialogs()
        }

        function applyInertToDialogs() {
            // Find all dialog elements (native <dialog> and custom roles)
            const dialogs = document.querySelectorAll('dialog, [role="dialog"], [role="alertdialog"]')

            dialogs.forEach(dialog => {
                // Apply inert programmatically using both native and polyfill support
                aria.setInert(dialog)
            })
        }
    })()
