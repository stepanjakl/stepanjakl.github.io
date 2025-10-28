/* Inspired by https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/examples/dialog/ */

var aria = aria || {}

aria.Utils = aria.Utils || {
    IgnoreUtilFocusChanges: false,
    dialogOpenClass: 'has-dialog',

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

aria.OpenDialogList = aria.OpenDialogList || []

aria.getCurrentDialog = () => aria.OpenDialogList[aria.OpenDialogList.length - 1]

aria.closeCurrentDialog = () => {
    const currentDialog = aria.getCurrentDialog()
    if (currentDialog) {
        currentDialog.close()
        return true
    }
    return false
}

aria.handleEscape = (event) => {
    const key = event.which || event.keyCode
    if (key === 27 && aria.closeCurrentDialog()) {
        event.stopPropagation()
    }
}

document.addEventListener('keyup', aria.handleEscape)

aria.addBackdrop = (dialogId) => {
    this.dialogNode = document.getElementById(dialogId)

    const backdropClass = 'dialog-backdrop'
    this.backdropNode = this.dialogNode.parentNode.classList.contains(backdropClass)
        ? this.dialogNode.parentNode
        : document.createElement('div')

    if (!this.dialogNode.parentNode.classList.contains(backdropClass)) {
        this.backdropNode.className = backdropClass
        this.dialogNode.parentNode.insertBefore(this.backdropNode, this.dialogNode)
        this.backdropNode.appendChild(this.dialogNode)
    }

    return this.backdropNode
}

aria.Dialog = function (dialogId, focusAfterClosed, focusFirst, hash) {
    this.dialogNode = document.getElementById(dialogId)
    if (!this.dialogNode) throw new Error(`No element found with id="${dialogId}".`)

    const validRoles = ['dialog', 'alertdialog']
    const isDialog = (this.dialogNode.getAttribute('role') || '').trim().split(/\s+/g).some(token => validRoles.includes(token))
    if (!isDialog) throw new Error('Dialog() requires a DOM element with ARIA role of dialog or alertdialog.')

    this.backdropNode = aria.addBackdrop(dialogId)

    this.backdropNode.classList.add('active')
    document.body.classList.add(aria.Utils.dialogOpenClass)

    this.focusAfterClosed = typeof focusAfterClosed === 'string' ? document.getElementById(focusAfterClosed) : focusAfterClosed
    if (!this.focusAfterClosed) throw new Error('The focusAfterClosed parameter is required for the aria.Dialog constructor.')

    this.focusFirst = typeof focusFirst === 'string' ? document.getElementById(focusFirst) : focusFirst || null

    /* if (this.dialogNode.id === 'menu_button-wrapper') {
        document.querySelector('#menu_button--open').setAttribute('tabindex', '-1')
        document.querySelector('#underlay_menu').setAttribute('tabindex', '-1')
    } */

    this.preNode = document.createElement('div')
    this.preNode.tabIndex = 0
    this.preNode.className = 'contents'
    this.dialogNode.parentNode.insertBefore(this.preNode, this.dialogNode)

    this.postNode = document.createElement('div')
    this.postNode.tabIndex = 0
    this.postNode.className = 'contents'
    this.dialogNode.parentNode.insertBefore(this.postNode, this.dialogNode.nextSibling)

    if (aria.OpenDialogList.length > 0) aria.getCurrentDialog().removeListeners()

    this.addListeners()
    aria.OpenDialogList.push(this)

    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            if (hash) window.location.hash = hash

            if (this.focusFirst) {
                this.focusFirst.focus()
            } else {
                aria.Utils.focusFirstDescendant(this.dialogNode)
            }
            this.lastFocus = document.activeElement
        })
    })
}

aria.Dialog.prototype.close = function (hash) {
    aria.OpenDialogList.pop()
    this.removeListeners()
    aria.Utils.remove(this.preNode)
    aria.Utils.remove(this.postNode)
    // this.dialogNode.classList.add('hidden')
    this.backdropNode.classList.remove('active')

    /* if (this.dialogNode.id === 'menu_button-wrapper') {
        document.querySelector('#menu_button--open').setAttribute('tabindex', '0')
        document.querySelector('#underlay_menu').setAttribute('tabindex', '0')
    } */

    requestAnimationFrame(() => {
        if (hash) window.location.hash = hash

        this.focusAfterClosed.setAttribute('data-focus-after-click', 'true')
        this.focusAfterClosed.focus()

        const handleBlur = (event) => {
            if (event.target !== document.activeElement) {
                event.target.removeAttribute('data-focus-after-click')
                event.target.removeEventListener('blur', handleBlur)
            }
        }

        this.focusAfterClosed.addEventListener('blur', handleBlur)

        if (aria.OpenDialogList.length > 0) {
            aria.getCurrentDialog().addListeners()
        } else {
            document.body.classList.remove(aria.Utils.dialogOpenClass)
        }
    })
}

aria.Dialog.prototype.replace = function (newDialogId, newFocusAfterClosed, newFocusFirst, hash) {
    // Clean up current modal-specific features before replacing
    if (this.dialogNode.id === 'modal_archive') {
        if (typeof window.cleanupArchiveModal === 'function') {
            window.cleanupArchiveModal()
        }
    } else if (this.dialogNode.id === 'modal_profile') {
        if (typeof window.cleanupProfileModal === 'function') {
            window.cleanupProfileModal()
        }
    }

    aria.OpenDialogList.pop()
    this.removeListeners()
    aria.Utils.remove(this.preNode)
    aria.Utils.remove(this.postNode)
    // this.dialogNode.classList.add('hidden')
    this.backdropNode.classList.remove('active')

    const focusAfterClosed = newFocusAfterClosed || this.focusAfterClosed
    new aria.Dialog(newDialogId, focusAfterClosed, newFocusFirst, hash)

    // Initialize new modal-specific features
    if (newDialogId === 'modal_archive' && typeof window.initializeArchiveModal === 'function') {
        window.initializeArchiveModal()
    } else if (newDialogId === 'modal_profile' && typeof window.initializeProfileModal === 'function') {
        window.initializeProfileModal()
    }
}

aria.Dialog.prototype.addListeners = function () {
    document.addEventListener('focus', this.trapFocus, true)
}

aria.Dialog.prototype.removeListeners = function () {
    document.removeEventListener('focus', this.trapFocus, true)
}

aria.Dialog.prototype.trapFocus = function (event) {
    if (aria.Utils.IgnoreUtilFocusChanges) return

    const currentDialog = aria.getCurrentDialog()

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

window.openDialog = (dialogId, focusAfterClosed, focusFirst, hash) => {
    if (aria.OpenDialogList.length > 0) {
        const topDialog = aria.getCurrentDialog()
        topDialog.replace(dialogId, focusAfterClosed, focusFirst, hash)
    }
    else {
        new aria.Dialog(dialogId, focusAfterClosed, focusFirst, hash)
    }

    // Initialize modal-specific features
    if (dialogId === 'modal_archive' && typeof window.initializeArchiveModal === 'function') {
        window.initializeArchiveModal()
    } else if (dialogId === 'modal_profile' && typeof window.initializeProfileModal === 'function') {
        window.initializeProfileModal()
    }
}

window.closeDialog = (hash) => {
    const topDialog = aria.getCurrentDialog()

    // Clean up modal-specific features before closing
    if (topDialog && topDialog.dialogNode) {
        if (topDialog.dialogNode.id === 'modal_archive') {
            if (typeof window.cleanupArchiveModal === 'function') {
                window.cleanupArchiveModal()
            }
        } else if (topDialog.dialogNode.id === 'modal_profile') {
            if (typeof window.cleanupProfileModal === 'function') {
                window.cleanupProfileModal()
            }
        }
    }

    topDialog?.close(hash)
}
