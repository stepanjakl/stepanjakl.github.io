/*!
 * Personal website of Štěpán Jákl
 * https://stepanjakl.com
 *
 * Copyright © 2025 Štěpán Jákl
 * Released under the MIT license
 * https://github.com/stepanjakl/stepanjakl.github.io/blob/main/LICENSE
 */

// ============================================================================
// Utility Functions
// ============================================================================

/** Detect if device supports touch input */
const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0 || navigator.msMaxTouchPoints > 0

/**
 * Debounce function - limits how often a function can be called
 * @param {Function} func - The function to debounce
 * @param {number} wait - Time in milliseconds to wait before calling
 * @returns {Function} Debounced function
 */
function debounce(func, wait) {
    let timeout
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout)
            func(...args)
        }
        clearTimeout(timeout)
        timeout = setTimeout(later, wait)
    }
}

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

/**
 * Parse URL hash into base and parameters
 * @param {string} hash - URL hash (e.g., '#archive?year=2024')
 * @returns {{base: string, params: Object}} Parsed hash object
 */
function parseHash(hash = window.location.hash) {
    const [base, queryString] = hash.split('?')
    const params = {}

    if (queryString) {
        queryString.split('&').forEach(pair => {
            const [key, value] = pair.split('=')
            if (key) params[key] = value || ''
        })
    }

    return { base, params }
}

// ============================================================================
// Global Constants & Configuration
// ============================================================================

/** Shared navigation hash constants for consistent routing */
const NAVIGATION_HASHES = Object.freeze({
    PROFILE: '#profile',
    ARCHIVE: '#archive',
    MENU: '#menu'
})

/** Modal element selectors for DOM querying */
const MODAL_SELECTORS = Object.freeze({
    PROFILE: '#modal-profile',
    ARCHIVE: '#modal-archive'
})

/** Dialog configuration for consistent ID references and focus management */
const DIALOG_CONFIG = Object.freeze({
    PROFILE: {
        id: 'modal-profile',
        trigger: 'menu-link-profile'  // Element to focus when dialog closes
    },
    ARCHIVE: {
        id: 'modal-archive',
        trigger: 'menu-link-archive'
    },
    MENU: {
        id: 'menu-toggle',
        trigger: 'menu-button-open',
        close: 'menu-button-close'   // Element to focus when dialog opens
    }
})

/** Popup link selector for media files */
const POPUP_LINK_SELECTOR = 'a[target="_blank"][href$=".mp4"], a[target="_blank"][href$=".png"], a[target="_blank"][href$=".jpg"], a[target="_blank"][href$=".svg"]'

/** Data attribute for tracking touch button primed state */
const TOUCH_PRIMED_ATTRIBUTE = 'data-touch-primed'

/** Shared modal element cache to avoid repeated DOM queries */
const modalElementCache = {
    profile: null,
    archive: null
}

/**
 * Get modal element with caching
 * Shared utility used by WheelHandler and TouchHandler
 * @param {string} hash - Navigation hash (e.g., '#profile')
 * @returns {HTMLElement|null} Cached modal element or null if not found
 */
const getModalElement = (hash) => {
    if (hash === NAVIGATION_HASHES.PROFILE) {
        return modalElementCache.profile ??= document.querySelector(MODAL_SELECTORS.PROFILE)
    } else if (hash === NAVIGATION_HASHES.ARCHIVE) {
        return modalElementCache.archive ??= document.querySelector(MODAL_SELECTORS.ARCHIVE)
    }
    return null
}

// ============================================================================
// Application Namespace
// ============================================================================

/**
 * Application namespace for global state and utilities
 * Initialized early to provide getEl helper for ThemeManager
 * Full API populated later after all classes are defined
 */
window.App = window.App || {}
App._elCache = App._elCache || {}

/**
 * Get element by id with caching. Accepts either an id string or an element.
 * @param {string|HTMLElement} idOrEl
 * @returns {HTMLElement|null}
 */
App.getEl = App.getEl || ((idOrEl) => {
    if (!idOrEl) return null
    if (typeof idOrEl !== 'string') return idOrEl
    return App._elCache[idOrEl] ??= document.getElementById(idOrEl)
})

/**
 * Helper to activate (click) an element by id and optionally focus another element.
 * Intended for use from inline handlers to keep logic centralized and consistent.
 * @param {string} clickId - id of element to .click()
 * @param {string|null} focusId - id of element to .focus()
 */
App.keyActivate = (clickId, focusId = null) => {
    const el = App.getEl(clickId)
    if (el && typeof el.click === 'function') {
        el.click()
    }
    if (focusId) {
        const f = App.getEl(focusId)
        if (f && typeof f.focus === 'function') f.focus()
    }
}

// Public API methods (populated later, called from HTML)
App.timeline = null
App.textHighlighter = null
App.popupInstance = null
App.popupPreloadedLinks = null
App.initializeTimeline = null
App.positionTimeline = null
App.handleTouchButtonClick = null
App.toggleFullscreen = null

// ============================================================================
// Theme Persistence
// ============================================================================


/**
 * Manages light/dark mode persistence using localStorage
 */
class ThemeManager {
    constructor() {
        this.STORAGE_KEY = 'theme-mode'
        this.DISABLE_TRANSITIONS_CLASS = 'disable-transitions'
        this.modeCheckbox = null

        this.init()
    }

    init() {
        // Get mode checkbox element
        this.modeCheckbox = App.getEl('mode')
        if (!this.modeCheckbox) {
            console.warn('Theme mode checkbox not found')
            return
        }

        // Apply saved theme on page load
        this.applySavedTheme()

        // Listen for theme changes and persist them
        this.modeCheckbox.addEventListener('change', () => {
            this.saveTheme()
            this.disableTransitionsDuringSwitch()
        })
    }

    applySavedTheme() {
        try {
            const savedTheme = localStorage.getItem(this.STORAGE_KEY)

            if (savedTheme === 'light') {
                // Light mode: checkbox should be checked
                this.modeCheckbox.checked = true
            } else if (savedTheme === 'dark') {
                // Dark mode: checkbox should be unchecked
                this.modeCheckbox.checked = false
            }
            // If no saved preference, leave checkbox in its default state
        } catch (error) {
            console.warn('Failed to load theme preference:', error)
        }
    }

    saveTheme() {
        try {
            const theme = this.modeCheckbox.checked ? 'light' : 'dark'
            localStorage.setItem(this.STORAGE_KEY, theme)
        } catch (error) {
            console.warn('Failed to save theme preference:', error)
        }
    }

    /**
     * Temporarily disable all transitions during theme switch for instant change.
     * Re-enables transitions after a single frame to allow normal animations.
     */
    disableTransitionsDuringSwitch() {
        const html = document.documentElement
        html.classList.add(this.DISABLE_TRANSITIONS_CLASS)

        // Use afterPaint helper to re-enable transitions after theme has painted
        afterPaint(() => {
            html.classList.remove(this.DISABLE_TRANSITIONS_CLASS)
        })
    }
}

// Initialize theme manager when DOM is ready
// Since this script uses defer, DOM is already loaded
try {
    window.App = window.App || {}
    window.App.themeManager = new ThemeManager()

    // Add page-loaded class to trigger fade-in after theme is applied
    document.documentElement.classList.add('page-loaded')
} catch (error) {
    console.error('Failed to initialize theme manager:', error)
    // Fallback: theme will use browser/system default without localStorage persistence
    // Still add page-loaded class to prevent indefinite opacity 0
    document.documentElement.classList.add('page-loaded')
}

// ============================================================================
// Resize Manager
// ============================================================================

/**
 * Centralized Resize Handler
 * Reduces redundant resize calculations by consolidating all resize handlers
 * Provides register/unregister pattern for cleanup
 */
const ResizeManager = {
    handlers: [],
    initialized: false,

    /**
     * Register a resize handler function
     * @param {Function} handler - Function to call on resize
     * @returns {Function} Unregister function for cleanup
     */
    register(handler) {
        if (!this.initialized) {
            this.init()
        }

        this.handlers.push(handler)

        // Return unregister function for cleanup
        return () => {
            const index = this.handlers.indexOf(handler)
            if (index > -1) {
                this.handlers.splice(index, 1)
            }
        }
    },

    /**
     * Initialize the debounced resize listener
     */
    init() {
        const handleResize = debounce(() => {
            this.handlers.forEach(handler => {
                try {
                    handler()
                } catch (error) {
                    console.error('Resize handler error:', error)
                }
            })
        }, 150)

        window.addEventListener('resize', handleResize, { passive: true })
        this.initialized = true
    }
}

// ============================================================================
// Dialog Lifecycle Configuration
// ============================================================================

/**
 * Register lifecycle hooks for modal dialogs
 * This connects the generic dialog.js with project-specific initialization/cleanup
 */
function registerDialogLifecycleHooks() {
    // Ensure aria is available before registering hooks
    if (typeof aria === 'undefined' || !aria.registerLifecycleHooks) {
        console.warn('aria not yet loaded, deferring lifecycle hook registration')
        return
    }

    // Store original page title for restoration
    const originalTitle = document.title

    // Archive modal lifecycle
    aria.registerLifecycleHooks(DIALOG_CONFIG.ARCHIVE.id, {
        initialize: () => {
            // Add modal-specific class to body for CSS
            document.body.classList.add('modal-open', 'modal-archive-open')

            // Update page title for better browser history
            document.title = 'Archive - ' + originalTitle

            // Check if there's a year parameter for deep-linking
            const yearParam = window.location.hash.split('?year=')[1]

            // Initialize timeline on first modal open
            if (!App.timeline) {
                // Don't start observer if we have a year parameter (will start after deep-link scroll)
                App.initializeTimeline(!yearParam)

                // Position timeline after modal transition completes
                const modalArchiveEl = App.getEl('modal-archive')
                if (modalArchiveEl) {
                    let positioned = false

                    const positionOnce = () => {
                        if (!positioned) {
                            positioned = true
                            App.positionTimeline()
                        }
                    }

                    // Primary: Listen for transition end
                    const handleTransitionEnd = (event) => {
                        // Only trigger on the modal element's transform transition
                        if (event.target === modalArchiveEl && event.propertyName === 'transform') {
                            modalArchiveEl.removeEventListener('transitionend', handleTransitionEnd)
                            positionOnce()
                        }
                    }
                    modalArchiveEl.addEventListener('transitionend', handleTransitionEnd)

                    // Fallback: Timeout in case transitionend doesn't fire
                    setTimeout(positionOnce, 150)
                }
            } else {
                // Timeline already exists, restart observer if no year parameter
                if (!yearParam && App.timeline.startIntersectionObserver) {
                    App.timeline.startIntersectionObserver()
                }
            }

            // Track user scrolling on the modal to enable hash updates
            const modalArchive = getModalElement(NAVIGATION_HASHES.ARCHIVE)
            if (modalArchive && App.timeline) {
                const handleUserScroll = () => {
                    if (App.timeline) {
                        App.timeline.hasUserScrolled = true
                    }
                }
                modalArchive.addEventListener('scroll', handleUserScroll, { once: true, passive: true })
            }

            // Handle deep-link scrolling if ?year= parameter is present
            if (yearParam) {
                const modalArchiveEl = App.getEl('modal-archive')

                // Wait for modal transition to complete before scrolling
                const handleDeepLinkScroll = () => {
                    requestAnimationFrame(() => {
                        requestAnimationFrame(() => {
                            // Scroll to the section title (header) rather than the content section
                            const targetSection = document.querySelector(`[data-timeline-section="${yearParam}"]`)
                            const modalArchive = getModalElement(NAVIGATION_HASHES.ARCHIVE)

                            if (targetSection && modalArchive && App.timeline) {
                                App.timeline.scrollParentToChildVertical(modalArchive, targetSection, 'instant')
                            }

                            // Update timeline to show correct active section
                            if (App.timeline) {
                                App.timeline.setActiveLabel(yearParam)
                                App.timeline.setActiveIndicator(yearParam)

                                // Center the active label in timeline
                                const activeLabel = App.timeline.querySelector(`[data-label-for="${yearParam}"]`)
                                if (activeLabel) {
                                    App.timeline.scrollParentToChildCenterHorizontal(
                                        App.timeline.getTimelineContentEl(),
                                        activeLabel
                                    )
                                }
                            }

                            // Start observer after scrolling and timeline updates
                            if (App.timeline && App.timeline.startIntersectionObserver) {
                                App.timeline.startIntersectionObserver()
                            }
                        })
                    })
                }

                // Listen for modal transition end before scrolling
                if (modalArchiveEl) {
                    const handleModalTransition = (event) => {
                        if (event.target === modalArchiveEl && event.propertyName === 'transform') {
                            modalArchiveEl.removeEventListener('transitionend', handleModalTransition)
                            handleDeepLinkScroll()
                        }
                    }
                    modalArchiveEl.addEventListener('transitionend', handleModalTransition)

                    // Fallback timeout in case transitionend doesn't fire
                    setTimeout(handleDeepLinkScroll, 200)
                }
            }
        },
        cleanup: () => {
            // Remove modal-specific class from body
            document.body.classList.remove('modal-open', 'modal-archive-open')

            // Restore original page title
            document.title = originalTitle

            if (App.timeline) {
                App.timeline.stopIntersectionObserver()
                // Reset user scroll flag for next modal open
                App.timeline.hasUserScrolled = false
            }
        }
    })

    // Profile modal lifecycle
    let footerArtInitialized = false
    aria.registerLifecycleHooks(DIALOG_CONFIG.PROFILE.id, {
        initialize: () => {
            // Add modal-specific class to body for CSS
            document.body.classList.add('modal-open', 'modal-profile-open')

            // Update page title for better browser history
            document.title = 'Profile - ' + originalTitle

            // Only initialize footer art effect once (persists for page lifetime)
            if (!footerArtInitialized) {
                initializeModalFooterArt()
                footerArtInitialized = true
            }
        },
        cleanup: () => {
            // Remove modal-specific class from body
            document.body.classList.remove('modal-open', 'modal-profile-open')

            // Restore original page title
            document.title = originalTitle
        }
    })

    // Menu modal lifecycle (for title consistency)
    aria.registerLifecycleHooks(DIALOG_CONFIG.MENU.id, {
        initialize: () => {
            // Add modal-specific class to body for CSS
            document.body.classList.add('modal-open', 'modal-menu-open')

            document.title = 'Menu - ' + originalTitle
        },
        cleanup: () => {
            // Remove modal-specific class from body
            document.body.classList.remove('modal-open', 'modal-menu-open')

            document.title = originalTitle
        }
    })
}

// Register hooks when aria is available
// Since dialog.js loads before script.js (both use defer), call in DOMContentLoaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', registerDialogLifecycleHooks)
} else {
    registerDialogLifecycleHooks()
}

// ============================================================================
// TextHighlighter Class
// ============================================================================

/**
 * Handles text highlighting and copying with temporary text replacement
 * Used for visual feedback when copying text to clipboard
 */
class TextHighlighter {
    constructor() {
        // State
        this.originalText = ''

        // Constants
        this.HIGHLIGHT_DURATION = 1000
        this.HIGHLIGHT_ACTIVE_CLASS = 'highlight--active'
    }

    /**
     * Highlight element and optionally change text temporarily
     * Provides visual feedback for copy-to-clipboard actions
     *
     * @param {Event} event - The triggering event
     * @param {HTMLElement} textElement - Element containing text to change
     * @param {HTMLElement} highlightElement - Element to highlight
     * @param {string} temporaryText - Optional temporary text to display
     */
    highlightAndCopyText(event, textElement, highlightElement, temporaryText) {
        const target = event.target

        // Set attribute to mark as copying in progress
        target.setAttribute('data-copying', 'true')

        this.originalText = textElement.textContent
        if (temporaryText) {
            textElement.textContent = temporaryText
        }
        highlightElement.classList.add(this.HIGHLIGHT_ACTIVE_CLASS)

        setTimeout(() => {
            target.removeAttribute('data-copying')
            textElement.textContent = this.originalText
            highlightElement.classList.remove(this.HIGHLIGHT_ACTIVE_CLASS)
        }, this.HIGHLIGHT_DURATION)
    }
}


// ============================================================================
// KeyHandler Class
// ============================================================================

/**
 * Handles keyboard shortcuts and tooltip interactions
 * Manages global keyboard navigation between dialogs (P, A, M keys)
 * Controls tooltip visibility based on Ctrl/Cmd key state
 */
class KeyHandler {
    constructor() {
        // DOM Elements (lazy initialized)
        this.tooltipElements = null
        this.debugElement = null

        // Configuration
        this.TOOLTIP_ITEMS_SELECTOR = '#menu-link-profile, #menu-link-archive, #menu-toggle'
        this.TOOLTIP_ACTIVE_CLASS = 'tooltip-key--active'

        // Key constants
        this.KEYS = {
            ESCAPE: 'Escape',
            KEY_P: 'p',
            KEY_A: 'a',
            KEY_M: 'm',
            KEY_D: 'd'
        }

        // Bound handlers
        this.boundHandleKeydown = this.handleKeydown.bind(this)
        this.boundHandleKeyup = this.handleKeyup.bind(this)
        this.boundRemoveTooltips = () => this.toggleTooltipActiveClass(false)

        // Initialize event listeners
        document.addEventListener('keydown', this.boundHandleKeydown)
        document.addEventListener('keyup', this.boundHandleKeyup)
        window.addEventListener('blur', this.boundRemoveTooltips)
        document.body.addEventListener('click', this.boundRemoveTooltips)
    }

    // Animation Check

    /**
     * Check if menu intro animation has finished
     * Prevents keyboard shortcuts during initial animation
     * @returns {boolean} True if animation is finished
     */
    isMenuAnimationFinished() {
        const el = document.querySelector('.menu--animating .menu__background')
        if (!el) return true
        const animations = el.getAnimations()
        return !animations || animations.length === 0 || animations[0].playState === 'finished'
    }

    // DOM Helpers

    getTooltipElements() {
        return this.tooltipElements ??= Array.from(document.querySelectorAll(this.TOOLTIP_ITEMS_SELECTOR))
    }

    // Event Handlers

    handleKeydown(event) {
        const rawKey = event.key
        const key = rawKey?.toLowerCase()

        // Always allow Escape to close dialogs, regardless of animation state
        if (rawKey === this.KEYS.ESCAPE) {
            if (aria.getCurrentDialog()) {
                closeDialog('#')
            }
        } else {
            if (!this.isMenuAnimationFinished()) return
            switch (key) {
                case this.KEYS.KEY_P:
                    this.toggleDialog(event, NAVIGATION_HASHES.PROFILE, DIALOG_CONFIG.PROFILE.id, DIALOG_CONFIG.PROFILE.trigger)
                    break
                case this.KEYS.KEY_A:
                    // null = no focusFirst, true = use partial hash match for deep links (#archive?year=2024)
                    this.toggleDialog(event, NAVIGATION_HASHES.ARCHIVE, DIALOG_CONFIG.ARCHIVE.id, DIALOG_CONFIG.ARCHIVE.trigger, null, true)
                    break
                case this.KEYS.KEY_M:
                    this.toggleDialog(event, NAVIGATION_HASHES.MENU, DIALOG_CONFIG.MENU.id, DIALOG_CONFIG.MENU.trigger, DIALOG_CONFIG.MENU.close, false)
                    break
                case this.KEYS.KEY_D:
                    this.toggleDebug(event)
                    break
            }
        }

        requestAnimationFrame(() => this.handleTooltipActiveClass(event))
    }

    handleKeyup() {
        this.toggleTooltipActiveClass(false)
    }

    toggleTooltipActiveClass(add) {
        const elements = this.getTooltipElements()
        const method = add ? 'add' : 'remove'
        for (let i = 0; i < elements.length; i++) {
            elements[i].classList[method](this.TOOLTIP_ACTIVE_CLASS)
        }
    }

    // Dialog Control

    /**
     * Toggle dialog open/closed based on current hash
     * @param {Event} event - The triggering event
     * @param {string} hash - Target hash (e.g., '#profile')
     * @param {string} dialogId - Dialog element ID
     * @param {string} triggerId - Element to focus when closing
     * @param {string|null} focusFirst - Element to focus when opening (optional)
     * @param {boolean} useIncludes - If true, match hash with includes() instead of === (for deep links)
     */
    toggleDialog(event, hash, dialogId, triggerId, focusFirst = null, useIncludes = false) {
        event.preventDefault()

        const currentHash = window.location.hash
        // useIncludes: true = partial match (#archive?year=2024), false = exact match (#profile)
        const shouldClose = useIncludes ? currentHash.includes(hash) : currentHash === hash

        if (shouldClose) {
            closeDialog('#')
        } else {
            openDialog(dialogId, triggerId, focusFirst, hash.substring(1))
        }
    }

    toggleDebug(event) {
        event.preventDefault()
        this.debugElement ??= App.getEl('debug')
        if (this.debugElement) {
            this.debugElement.checked = !this.debugElement.checked
        }
    }

    // Tooltip Management

    handleTooltipActiveClass(event) {
        const { base: hash } = parseHash()

        if (hash) {
            this.toggleTooltipActiveClass(false)
        } else if (event.ctrlKey || event.metaKey) {
            this.toggleTooltipActiveClass(true)
        }
    }
}


// ============================================================================
// NavigationHandler Base Class
// ============================================================================

/**
 * Base class for handling vertical and horizontal navigation gestures
 * Shared logic between WheelHandler and TouchHandler
 * Manages modal opening/closing via scroll/swipe gestures
 */
class NavigationHandler {
    constructor() {
        // Configuration
        this.SCROLL_MIN_THRESHOLD = 5
    }

    // Animation Check

    /**
     * Check if menu intro animation has finished
     * Prevents navigation gestures during initial animation
     * @returns {boolean} True if animation is finished
     */
    isMenuAnimationFinished() {
        const el = document.querySelector('.menu--animating .menu__background')
        if (!el) return true
        const animations = el.getAnimations()
        return !animations || animations.length === 0 || animations[0].playState === 'finished'
    }

    // Navigation Handlers

    /**
     * Handle vertical scroll navigation (shared logic)
     * Opens profile modal at bottom of page, closes modal when scrolling up at top
     * @param {string} direction - 'up' or 'down'
     */
    handleVerticalNavigation(direction) {
        const { base: currentHash } = parseHash()

        if (currentHash === NAVIGATION_HASHES.PROFILE || currentHash === NAVIGATION_HASHES.ARCHIVE) {
            this.handleModalVerticalScroll(direction, currentHash)
        } else {
            this.handleVerticalPageScroll(direction)
        }
    }

    /**
     * Handle modal vertical scrolling (close on scroll up at top)
     * @param {string} direction - 'up' or 'down'
     * @param {string} currentHash - Current navigation hash
     */
    handleModalVerticalScroll(direction, currentHash) {
        if (direction !== 'up') return

        const modalElement = getModalElement(currentHash)
        if (modalElement?.scrollTop === 0) {
            closeDialog('#')
        }
    }

    /**
     * Handle page vertical scrolling (open modal at bottom)
     * @param {string} direction - 'up' or 'down'
     */
    handleVerticalPageScroll(direction) {
        if (direction !== 'down' || window.location.hash) return

        if (window.scrollY + window.innerHeight >= document.body.scrollHeight) {
            openDialog(DIALOG_CONFIG.PROFILE.id, DIALOG_CONFIG.PROFILE.trigger, null, 'profile')
        }
    }

    /**
     * Handle horizontal scroll navigation (shared logic)
     * @param {string} direction - 'left' or 'right'
     */
    handleHorizontalNavigation(direction) {
        const currentHash = window.location.hash
        const scrollX = window.scrollX

        if (direction === 'right' && !currentHash) {
            if (scrollX + window.innerWidth >= document.body.scrollWidth) {
                openDialog(DIALOG_CONFIG.MENU.id, DIALOG_CONFIG.MENU.trigger, DIALOG_CONFIG.MENU.close, 'menu')
            }
        } else if (direction === 'left' && currentHash === NAVIGATION_HASHES.MENU && scrollX === 0) {
            closeDialog('#')
        }
    }
}


// ============================================================================
// WheelHandler Class
// ============================================================================

/**
 * Handles mouse wheel scrolling for navigation between dialogs and pages
 * Detects vertical and horizontal wheel movements to trigger navigation
 * Extends NavigationHandler for shared gesture logic
 */
class WheelHandler extends NavigationHandler {
    constructor() {
        super()

        // Bound handlers
        this.boundHandleWheelEvent = this.handleWheelEvent.bind(this)

        // Initialize event listeners
        window.addEventListener('wheel', this.boundHandleWheelEvent, { passive: true })
    }

    // Event Handlers

    handleWheelEvent(event) {
        if (!this.isMenuAnimationFinished()) return

        const deltaX = Math.abs(event.deltaX)
        const deltaY = Math.abs(event.deltaY)

        if (deltaY > deltaX && deltaY > this.SCROLL_MIN_THRESHOLD) {
            const direction = event.deltaY > 0 ? 'down' : 'up'
            this.handleVerticalNavigation(direction)
        } else if (deltaX > deltaY && deltaX > this.SCROLL_MIN_THRESHOLD) {
            const direction = event.deltaX > 0 ? 'right' : 'left'
            this.handleHorizontalNavigation(direction)
        }
    }
}


// ============================================================================
// TouchHandler Class
// ============================================================================

/**
 * Handles touch gestures for navigation on mobile devices
 * Detects swipe directions to trigger modal navigation
 * Extends NavigationHandler for shared gesture logic
 */
class TouchHandler extends NavigationHandler {
    constructor() {
        super()

        // State
        this.touchStartX = 0
        this.touchStartY = 0

        // Bound handlers
        this.boundHandleTouchStart = this.handleTouchStart.bind(this)
        this.boundHandleTouchMove = this.handleTouchMove.bind(this)

        // Initialize event listeners
        window.addEventListener('touchstart', this.boundHandleTouchStart, { passive: true })
        window.addEventListener('touchmove', this.boundHandleTouchMove, { passive: true })
    }

    // Event Handlers

    handleTouchStart(event) {
        const touch = event.touches[0]
        this.touchStartX = touch.clientX
        this.touchStartY = touch.clientY
    }

    handleTouchMove(event) {
        if (!this.isMenuAnimationFinished()) return

        const touch = event.touches[0]
        const deltaX = Math.abs(touch.clientX - this.touchStartX)
        const deltaY = Math.abs(touch.clientY - this.touchStartY)

        if (deltaY > deltaX && deltaY > this.SCROLL_MIN_THRESHOLD) {
            const direction = touch.clientY < this.touchStartY ? 'down' : 'up'
            this.handleVerticalNavigation(direction)
        } else if (deltaX > deltaY && deltaX > this.SCROLL_MIN_THRESHOLD) {
            const direction = touch.clientX > this.touchStartX ? 'right' : 'left'
            this.handleHorizontalNavigation(direction)
        }
    }
}


// ============================================================================
// HorizontalDragScroller Class
// ============================================================================

/**
 * Enables drag-to-scroll functionality on horizontal scrollable elements
 * Provides mouse-based click-and-drag scrolling similar to mobile touch scrolling
 */
class HorizontalDragScroller {
    constructor(options = {}) {
        // Configuration
        this.element = options.element

        // State
        this.isMouseDown = false
        this.startX = 0
        this.scrollLeft = 0

        // Constants
        this.MOUSE_DOWN_CLASS = 'x-drag-scroll--mouse-down'
        this.DRAGGING_CLASS = 'x-drag-scroll--dragging'
        this.DRAG_RELEASE_TIMEOUT = 300

        // Bound handlers
        this.onMouseDownBound = this.onMouseDown.bind(this)
        this.onMouseMoveBound = this.onMouseMove.bind(this)
        this.completeDragBound = this.completeDrag.bind(this)

        // Initialize event listeners
        this.element.addEventListener('mousedown', this.onMouseDownBound)
        this.element.addEventListener('mousemove', this.onMouseMoveBound)
        this.element.addEventListener('mouseup', this.completeDragBound)
        this.element.addEventListener('mouseleave', this.completeDragBound)
    }

    // Cleanup

    destroy() {
        this.element.removeEventListener('mousedown', this.onMouseDownBound)
        this.element.removeEventListener('mousemove', this.onMouseMoveBound)
        this.element.removeEventListener('mouseup', this.completeDragBound)
        this.element.removeEventListener('mouseleave', this.completeDragBound)
    }

    // Event Handlers

    onMouseDown(event) {
        this.isMouseDown = true
        this.startX = event.clientX
        this.scrollLeft = this.element.scrollLeft
        this.element.classList.add(this.MOUSE_DOWN_CLASS)
    }

    onMouseMove(event) {
        if (!this.isMouseDown) return

        this.element.classList.add(this.DRAGGING_CLASS)
        this.element.scrollLeft = this.scrollLeft - (event.clientX - this.startX)
    }

    completeDrag() {
        if (!this.isMouseDown) return

        this.isMouseDown = false
        this.element.classList.remove(this.MOUSE_DOWN_CLASS)

        setTimeout(() => {
            this.element.classList.remove(this.DRAGGING_CLASS)
        }, this.DRAG_RELEASE_TIMEOUT)
    }
}


// ============================================================================
// HorizontalEdgeScroller Class
// ============================================================================

/**
 * Auto-scrolls content when mouse hovers near the edges
 */
class HorizontalEdgeScroller {
    constructor(options = {}) {
        // Configuration
        this.options = options
        this.element = options.element
        this.maxSpeed = options.maxSpeed ?? 0.75

        // Constants
        this.DRAGGING_CLASS = 'x-drag-scroll--dragging'
        this.EDGE_SCROLLING_CLASS = 'edge-x-scroll--scrolling'
        this.SCROLL_STOP_TIMEOUT = 300

        // State
        this.scrollSpeed = 0
        this.isScrolling = false
        this.lastTimestamp = null
        this.isSnapped = true
        this.edgeWidth = 0
        this.mediaQuery = window.matchMedia('(min-width: 45rem)')
        this.styleElement = null
        this.unregisterResize = null

        // Bound handlers
        this.scrollStep = this.scrollStep.bind(this)
        this.handleMouseOut = this.handleMouseOut.bind(this)

        if (!isTouchDevice) {
            this.handleMouseMoveBound = this.handleMouseMove.bind(this)
            this.onResizeBound = this.onResize.bind(this)
            document.addEventListener('mousemove', this.handleMouseMoveBound)
            // Use centralized resize manager instead of direct window listener
            this.unregisterResize = ResizeManager.register(this.onResizeBound)
            this.onResize()
        }
    }

    // Resize Handler

    onResize() {
        this.edgeWidth = (this.options.edgeWidthRatio ?? 3) * parseFloat(getComputedStyle(document.body).fontSize)
        this.updatePseudoElementStyles()
    }

    updatePseudoElementStyles() {
        const { id } = this.options
        this.element.setAttribute('data-edge-scroll-id', id)

        const styleId = `horizontal-edge-scroll-style-${id}`

        if (!this.styleElement) {
            this.styleElement = App.getEl(styleId)
            if (!this.styleElement) {
                this.styleElement = document.createElement('style')
                this.styleElement.id = styleId
                document.head.appendChild(this.styleElement)
            }
        }

        const { edgeWidth } = this
        this.styleElement.textContent = `
          [data-edge-scroll-id="${id}"]::before,
          [data-edge-scroll-id="${id}"]::after {
            content: '';
            position: absolute;
            z-index: 5;
            display: block;
            width: ${edgeWidth}px;
            user-select: none;
          }
          [data-edge-scroll-id="${id}"]::before {
            inset: 0 auto 0 0;
            cursor: w-resize;
          }
          [data-edge-scroll-id="${id}"]::after {
            inset: 0 0 0 auto;
            cursor: e-resize;
          }
        `
    }

    // Event Handlers

    handleMouseMove(event) {
        if (!this.mediaQuery.matches || this.element.classList.contains(this.DRAGGING_CLASS)) return

        const rect = this.element.getBoundingClientRect()
        const { clientX, clientY } = event

        const withinBounds = clientX >= rect.left && clientX <= rect.right &&
            clientY >= rect.top && clientY <= rect.bottom
        const nearLeftEdge = clientX < rect.left + this.edgeWidth
        const nearRightEdge = clientX > rect.right - this.edgeWidth

        if (withinBounds) {
            if (nearLeftEdge) {
                this.scrollSpeed = this.calculateSpeed(clientX - rect.left, 'left')
                this.startScroll()
            } else if (nearRightEdge) {
                this.scrollSpeed = this.calculateSpeed(rect.right - clientX, 'right')
                this.startScroll()
            } else if (this.isScrolling) {
                this.stopScroll()
            }
        } else {
            if (this.isScrolling) {
                this.stopScroll()
            }
            if (!this.isSnapped) {
                this.handleMouseOut()
            }
        }
    }

    handleMouseOut() {
        this.isSnapped = true

        const activeSlide = this.options.activeSlide?.get()
        if (activeSlide) {
            requestAnimationFrame(() => {
                this.element.scrollTo({
                    left: activeSlide.offsetLeft,
                    behavior: 'smooth'
                })
            })
        }

        setTimeout(() => {
            this.element.classList.remove(this.EDGE_SCROLLING_CLASS)
        }, this.SCROLL_STOP_TIMEOUT)
    }

    // Scroll Control

    startScroll() {
        if (this.isScrolling) return

        this.isScrolling = true
        this.isSnapped = false
        this.element.classList.add(this.EDGE_SCROLLING_CLASS)
        requestAnimationFrame(this.scrollStep)
    }

    stopScroll() {
        this.scrollSpeed = 0
    }

    scrollStep(timestamp) {
        if (this.lastTimestamp === null) {
            this.lastTimestamp = timestamp
        }

        const elapsed = timestamp - this.lastTimestamp
        this.lastTimestamp = timestamp
        this.element.scrollLeft += this.scrollSpeed * elapsed

        if (this.scrollSpeed !== 0) {
            requestAnimationFrame(this.scrollStep)
        } else {
            this.isScrolling = false
            this.lastTimestamp = null
        }
    }

    // Helpers

    calculateSpeed(distance, direction) {
        const speed = (this.maxSpeed * (this.edgeWidth - distance)) / this.edgeWidth
        return direction === 'left' ? -speed : speed
    }

    // Cleanup

    destroy() {
        if (!isTouchDevice && this.handleMouseMoveBound) {
            document.removeEventListener('mousemove', this.handleMouseMoveBound)
            // Unregister from centralized resize manager
            if (this.unregisterResize) {
                this.unregisterResize()
                this.unregisterResize = null
            }
        }
        if (this.styleElement && this.styleElement.parentElement) {
            this.styleElement.remove()
        }
        if (this.element) {
            this.element.removeAttribute('data-edge-scroll-id')
        }
    }
}


// ============================================================================
// CursorIdleDetector Class
// ============================================================================

/**
 * Detects cursor idle state and manages fade-out/fade-in of target element
 * Used to auto-hide UI controls (like video close button) when cursor is inactive
 * Only active on non-touch devices
 */
class CursorIdleDetector {
    constructor(options = {}) {
        // Configuration
        this.targetElement = options.targetElement || null
        this.container = options.container || document
        this.idleTimeout = options.idleTimeout || 2000 // 2 seconds default
        this.fadedClass = options.fadedClass || 'cursor-idle-fade'

        // State
        this.idleTimer = null
        this.isIdle = false

        // Bound handlers
        this.boundHandleMouseMove = this.handleMouseMove.bind(this)
        this.boundHandleMouseLeave = this.handleMouseLeave.bind(this)
    }

    // Lifecycle

    start() {
        if (!this.targetElement) return

        // Only enable cursor idle detection on non-touch devices
        if (isTouchDevice) return

        this.container.addEventListener('mousemove', this.boundHandleMouseMove, { passive: true })
        this.container.addEventListener('mouseleave', this.boundHandleMouseLeave)

        // Start idle timer immediately
        this.startIdleTimer()
    }

    stop() {
        this.container.removeEventListener('mousemove', this.boundHandleMouseMove)
        this.container.removeEventListener('mouseleave', this.boundHandleMouseLeave)
        this.clearIdleTimer()
        this.showTarget()
    }

    // Event Handlers

    handleMouseMove() {
        this.showTarget()
        this.clearIdleTimer()
        this.startIdleTimer()
    }

    handleMouseLeave() {
        this.clearIdleTimer()
        this.showTarget()
    }

    // Timer Management

    startIdleTimer() {
        this.idleTimer = setTimeout(() => {
            this.hideTarget()
        }, this.idleTimeout)
    }

    clearIdleTimer() {
        if (this.idleTimer) {
            clearTimeout(this.idleTimer)
            this.idleTimer = null
        }
    }

    // Visibility Control

    hideTarget() {
        if (!this.targetElement || this.isIdle) return
        this.isIdle = true
        this.targetElement.classList.add(this.fadedClass)
    }

    showTarget() {
        if (!this.targetElement || !this.isIdle) return
        this.isIdle = false
        this.targetElement.classList.remove(this.fadedClass)
    }

    updateTarget(newTarget) {
        this.targetElement = newTarget
        this.isIdle = false
        this.clearIdleTimer()
        if (newTarget) {
            this.startIdleTimer()
        }
    }
}


// ============================================================================
// Popup Class
// ============================================================================

/**
 * Handles image and video popups with fallback views for blocked popups
 * Opens media in new windows/tabs when possible, falls back to inline overlay
 * Supports placeholder images for progressive loading
 */
class Popup {
    constructor() {
        // Popup size configuration
        this.POPUP_SCREEN_WIDTH_RATIO = 0.9
        this.POPUP_SCREEN_HEIGHT_RATIO = 0.9

        // Aspect ratio thresholds
        this.ASPECT_RATIO_TALL_THRESHOLD = 0.85
        this.TALL_RATIO_CLASS = 'tall-ratio'
        this.SQUARE_RATIO_MIN = 0.95
        this.SQUARE_RATIO_MAX = 1.05
        this.SQUARE_RATIO_CLASS = 'square-ratio'

        // State management
        this.fallbackContainer = null
        this.wrapperElement = null
        this.stylesInjected = false
        this.handleEscapeKey = null
        this.handleFallbackClick = null
        this.triggeringElement = null // Track element that opened the viewer for focus restoration
        this.cursorIdleDetector = null // Cursor idle detector for close button

        // Static property to track popup blocking across all instances
        if (typeof Popup.isPopupBlocked === 'undefined') {
            Popup.isPopupBlocked = false
        }
    }

    // HTML Generation

    generatePopupHTML(href, isVideo, placeholderUrl, includeOverlay = false) {
        const mediaElementHtml = isVideo
            ? `<video src="${href}" controls autoplay playsinline onerror="console.error('Video file not found or failed to load: ${href}')"></video>`
            : placeholderUrl
                ? `<img src="${href}" onload="requestAnimationFrame(()=>requestAnimationFrame(()=>{this.nextElementSibling.style.opacity='0'}))" onerror="console.error('Image file not found or failed to load: ${href}')" style="width:100%;height:auto"><img src="${placeholderUrl}" onerror="console.warn('Placeholder image not found or failed to load: ${placeholderUrl}')" style="position:absolute;inset:0;width:100%;height:auto;transition:opacity .3s linear">`
                : `<img src="${href}" onerror="console.error('Image file not found or failed to load: ${href}')" />`

        const overlayHtml = includeOverlay
            ? `<div style="position:absolute;inset:0;cursor:zoom-out;z-index:1" onclick="window.close()" aria-label="Close" tabindex="0" onkeydown="if(event.key==='Enter'||event.key===' '){window.close()}"></div>`
            : ''

        return `<!DOCTYPE html>
        <html>
        <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width,initial-scale=1">
        <title>Preview</title>
        <style>
          html,body{margin:0;padding:0;background-color:#000;position:relative;min-height:100vh}
          img,video{width:100%;height:auto;display:block;position:relative;z-index:0}
        </style>
        </head>
        <body>
          ${mediaElementHtml}
          ${overlayHtml}
          <script>
            document.addEventListener('keydown', (e) => {
              if (e.key === 'Escape') {
                e.preventDefault();
                window.close();
              }
            });
          </script>
        </body>
        </html>`
    }

    // Popup Opening

    async open(element, event) {
        event.preventDefault()
        const { href } = element

        // Store triggering element for focus restoration
        this.triggeringElement = element

        const isVideo = this.isVideo(href)
        const placeholderUrl = !isVideo ? this.getPlaceholderUrl(href) : null

        const dimensions = isVideo
            ? await this.getVideoDimensions(href)
            : await this.getImageDimensions(href)

        if (!dimensions) {
            console.warn('Could not retrieve media dimensions for the popup.')
            this.showFallbackView(href, isVideo, dimensions, placeholderUrl)
            return true
        }

        if (Popup.isPopupBlocked) {
            console.info('Popups are blocked for this session. Using fallback view...')
            this.showFallbackView(href, isVideo, dimensions, placeholderUrl)
            return true
        }

        const { width, height, left, top } = this.calculateWindowSize(dimensions)
        const imageAspect = dimensions.width / dimensions.height
        const isTallImage = !isVideo && imageAspect < this.ASPECT_RATIO_TALL_THRESHOLD

        // Generate popup/tab HTML with shared functionality
        const html = this.generatePopupHTML(href, isVideo, placeholderUrl, !isVideo)
        const blob = new Blob([html], { type: 'text/html' })
        const blobUrl = URL.createObjectURL(blob)

        // If the image is tall, prefer opening a small HTML page in a new tab
        if (isTallImage) {
            const newTab = window.open(blobUrl, '_blank')

            // If opening a new tab/window failed, revoke blob and fallback inline
            if (!newTab) {
                URL.revokeObjectURL(blobUrl)
                Popup.isPopupBlocked = true
                console.info('Opening new tab was blocked. Falling back to inline view for the session.')
                this.showFallbackView(href, isVideo, dimensions, placeholderUrl)
                return true
            }

            return false
        }

        // Otherwise attempt to open a centered popup window
        const popup = window.open(blobUrl, `popup_${Date.now()}`, `toolbar=no,location=no,status=no,menubar=no,scrollbars=yes,resizable=yes,width=${width},height=${height},top=${top},left=${left},popup=yes`)

        if (!popup || popup.closed || typeof popup.closed === 'undefined') {
            Popup.isPopupBlocked = true
            console.info('Popup was blocked. Using inline fallback for the session.')
            this.showFallbackView(href, isVideo, dimensions, placeholderUrl)
            return true
        }

        return false
    }

    // Fallback View

    showFallbackView(url, isVideo, dimensions, placeholderUrl) {
        // Initialize fallback container only once
        if (!this.fallbackContainer) {
            this.initializeFallbackContainer()
        }

        // Re-add event handlers if they were removed (container reused after close)
        this.addFallbackEventHandlers()

        // Cache wrapper element reference
        if (!this.wrapperElement) {
            this.wrapperElement = this.fallbackContainer.querySelector('.media_fallback-content')
        }

        const wrapper = this.wrapperElement

        // Reset wrapper state
        wrapper.classList.remove(this.TALL_RATIO_CLASS)
        wrapper.classList.remove(this.SQUARE_RATIO_CLASS)

        // Build content based on media type
        const fragment = document.createDocumentFragment()

        let closeButton = null
        if (isVideo) {
            closeButton = this.createCloseButton()
            fragment.appendChild(closeButton)
        } else {
            const overlay = this.createCloseOverlay()
            fragment.appendChild(overlay)
        }

        // Handle square and tall ratio for images
        if (!isVideo && dimensions) {
            const aspectRatio = dimensions.width / dimensions.height
            if (aspectRatio < this.ASPECT_RATIO_TALL_THRESHOLD) {
                wrapper.classList.add(this.TALL_RATIO_CLASS)
            } else if (aspectRatio >= this.SQUARE_RATIO_MIN && aspectRatio <= this.SQUARE_RATIO_MAX) {
                wrapper.classList.add(this.SQUARE_RATIO_CLASS)
            }
        }

        // Create media element
        if (isVideo) {
            const video = document.createElement('video')
            video.src = url
            video.controls = true
            video.autoplay = true

            // Add error handler for video loading
            video.addEventListener('error', () => {
                console.error(`Video file not found or failed to load: ${url}`)
            }, { once: true })

            fragment.appendChild(video)
        } else {
            // Full image
            const img = document.createElement('img')
            img.src = url

            // Add error handler for main image
            img.addEventListener('error', () => {
                console.error(`Image file not found or failed to load: ${url}`)
            }, { once: true })

            // Placeholder image (if available)
            let placeholder = null
            if (placeholderUrl) {
                placeholder = document.createElement('img')
                placeholder.src = placeholderUrl
                placeholder.style.transition = 'opacity 0.3s linear'
                placeholder.style.opacity = '0'

                // Add error handler for placeholder image
                placeholder.addEventListener('error', () => {
                    console.warn(`Placeholder image not found or failed to load: ${placeholderUrl}`)
                }, { once: true })

                const onPlaceholderLoad = () => {
                    if (!img.complete) placeholder.style.opacity = '1'
                }

                if (placeholder.complete) {
                    onPlaceholderLoad()
                } else {
                    placeholder.onload = onPlaceholderLoad
                }
            }

            const onFullImageLoad = () => {
                // Use requestAnimationFrame to ensure image is painted before fading
                requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                        if (placeholder) placeholder.style.opacity = '0'
                    })
                })
            }

            if (img.complete && img.naturalWidth > 0) {
                // Image already loaded, but add small delay for rendering
                onFullImageLoad()
            } else {
                img.onload = onFullImageLoad
            }

            fragment.appendChild(img)
            if (placeholder) fragment.appendChild(placeholder)
        }

        // Clear and update wrapper content in one operation
        wrapper.textContent = ''
        wrapper.appendChild(fragment)

        // Add to DOM if needed
        if (!this.fallbackContainer.parentElement) {
            document.body.appendChild(this.fallbackContainer)
        }

        // Initialize cursor idle detector for video close button
        if (isVideo && closeButton) {
            // Stop any existing detector
            if (this.cursorIdleDetector) {
                this.cursorIdleDetector.stop()
            }

            // Create new detector for this close button
            this.cursorIdleDetector = new CursorIdleDetector({
                targetElement: closeButton,
                container: this.fallbackContainer,
                idleTimeout: 2000,
                fadedClass: 'cursor-idle-fade'
            })

            this.cursorIdleDetector.start()
        }
    }

    // Fallback Initialization

    initializeFallbackContainer() {
        this.fallbackContainer = document.createElement('div')
        this.fallbackContainer.className = 'media_fallback_overlay'
        this.fallbackContainer.innerHTML = `<div class="media_fallback-wrapper"><div class="media_fallback-content"></div></div>`

        // Inject styles only once
        if (!this.stylesInjected && !App.getEl('media_fallback-styles')) {
            this.injectStyles()
            this.stylesInjected = true
        }

        // Add event handlers
        this.addFallbackEventHandlers()
    }

    addFallbackEventHandlers() {
        // Set up event delegation for close actions
        if (!this.handleFallbackClick) {
            this.handleFallbackClick = (e) => {
                // Check if click is on close overlay or button
                const isCloseOverlay = e.target.classList.contains('media_fallback-close-overlay')
                const isCloseButton = e.target.classList.contains('media_fallback-close-button')
                const isInsideCloseButton = e.target.closest('.media_fallback-close-button')

                if (isCloseOverlay || isCloseButton || isInsideCloseButton) {
                    e.preventDefault()
                    e.stopPropagation()
                    this.closeFallbackView()
                }
            }
            this.fallbackContainer.addEventListener('click', this.handleFallbackClick)
        }

        // Set up escape key handler for this fallback instance
        // Use capture phase to run before other keydown handlers (KeyHandler, aria.handleEscape)
        // stopImmediatePropagation prevents ALL other handlers from running
        if (!this.handleEscapeKey) {
            this.handleEscapeKey = (e) => {
                if (e.key === 'Escape' && this.fallbackContainer?.parentElement) {
                    e.stopImmediatePropagation()
                    this.closeFallbackView()
                }
            }
            document.addEventListener('keydown', this.handleEscapeKey, { capture: true })
        }
    }

    // UI Element Creation

    createCloseButton() {
        const button = document.createElement('button')
        button.className = 'media_fallback-close-button'
        button.setAttribute('aria-label', 'Close')
        button.type = 'button'
        button.innerHTML = '<svg style="fill: currentColor; width: 1.125rem; height: 1.125rem"><use xlink:href="images/icons.svg#close"></use></svg>'
        return button
    }

    createCloseOverlay() {
        const overlay = document.createElement('div')
        overlay.className = 'media_fallback-close-overlay'
        overlay.setAttribute('aria-label', 'Close')
        overlay.tabIndex = 0
        return overlay
    }

    // Style Injection

    injectStyles() {
        const styles = document.createElement('style')
        styles.id = 'media_fallback-styles'
        styles.textContent = `
            .media_fallback_overlay {
                position: fixed;
                z-index: 300;
                inset: 0;
            }
            .media_fallback-wrapper {
                position: relative;
                width: 100%;
                height: 100%;
                overflow-y: auto;
                margin-inline: auto;
                overscroll-behavior: none;
            }
            .media_fallback-content {
                display: flex;
                position: relative;
                width: 100%;
                height: auto;
                min-height: 100%;
            }
            .media_fallback-content img {
                position: absolute;
                width: auto;
                height: auto;
                max-width: 100svh;
                max-height: 100svw;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%) rotate(-90deg);
                transform-origin: center center;
                opacity: 1;
            }
            @media (min-width: 45rem) {
                .media_fallback-content img {
                    position: relative;
                    width: 100%;
                    height: auto;
                    max-width: 100%;
                    margin: auto;
                    top: 0;
                    left: 0;
                    transform: none;
                }
                .media_fallback-content img:nth-child(2) {
                    position: absolute;
                    inset: 0;
                }
            }
            .media_fallback-content.square-ratio {
                height: auto;
            }
            .media_fallback-content.square-ratio img {
                position: absolute;
                width: auto;
                height: auto;
                max-height: 100vh;
                max-width: 100vw;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
            }
            .media_fallback-content.tall-ratio img {
                position: relative;
                width: 100%;
                height: auto;
                max-width: 100%;
                max-height: none;
                top: 0;
                left: 0;
                transform: none;
            }
            .media_fallback-content video {
                position: relative;
                width: 100%;
                height: auto;
                opacity: 1;
            }
            .media_fallback-close-overlay {
                position: absolute;
                inset: 0;
                cursor: zoom-out;
                z-index: 1;
            }
            .media_fallback-close-button {
                position: fixed;
                top: 0;
                right: 50%;
                transform: translateX(50%);
                margin-top: var(--modal-button-inset);
                width: var(--modal-button-size);
                height: var(--modal-button-size);
                border-radius: 50%;
                color: var(--light-70);
                background: var(--dark-55);
                backdrop-filter: saturate(1.75) blur(1rem);
                color: white;
                border: none;
                cursor: pointer;
                z-index: 2;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 1.5rem;
                line-height: 1;
                transition: color 200ms linear, background-color 200ms linear, opacity 300ms ease-out;
            }
            .media_fallback-close-button:hover {
                background: var(--dark-45);
                color: var(--light-95);
                transition: color 150ms linear, background-color 150ms linear, opacity 300ms ease-out;
            }
            .media_fallback-close-button::after {
                content: '';
                position: absolute;
                inset: 0;
                border-radius: 50%;
                background: var(--light-35);
                transition: background-color 200ms linear;
            }
            .media_fallback-close-button:hover::after {
                background: var(--light-45);
                transition: background-color 150ms linear;
            }
            .media_fallback-close-button.cursor-idle-fade {
                opacity: 0;
                pointer-events: none;
            }
        `
        document.head.appendChild(styles)
    }

    // Cleanup

    closeFallbackView() {
        if (this.fallbackContainer && this.fallbackContainer.parentElement) {
            // Stop cursor idle detector
            if (this.cursorIdleDetector) {
                this.cursorIdleDetector.stop()
                this.cursorIdleDetector = null
            }

            // Remove escape key handler
            if (this.handleEscapeKey) {
                document.removeEventListener('keydown', this.handleEscapeKey, { capture: true })
                this.handleEscapeKey = null
            }

            // Remove click handler
            if (this.handleFallbackClick) {
                this.fallbackContainer.removeEventListener('click', this.handleFallbackClick)
                this.handleFallbackClick = null
            }

            // Remove from DOM
            this.fallbackContainer.remove()

            // Don't nullify container - we'll reuse it and need to re-add handlers
            // Reset cached wrapper reference to force fresh content queries
            this.wrapperElement = null

            // Restore focus to the element that triggered the viewer
            // The hash should remain unchanged (modal stays open with its hash)
            if (this.triggeringElement && typeof this.triggeringElement.focus === 'function') {
                requestAnimationFrame(() => {
                    this.triggeringElement.focus()
                })
            }
        }
    }

    // Media Type Detection

    isVideo(url) {
        return /\.(mp4|webm|ogg)$/i.test(url)
    }

    getPlaceholderUrl(url) {
        return url.replace('.full.', '.min.')
    }

    // Dimension Calculation

    getImageDimensions(url) {
        return new Promise((resolve) => {
            const img = new Image()

            const handleLoad = () => {
                if (img.naturalWidth && img.naturalHeight) {
                    resolve({ width: img.naturalWidth, height: img.naturalHeight })
                } else {
                    console.error(`Image file not found or failed to load: ${url}`)
                    resolve(null)
                }
            }

            img.addEventListener('load', handleLoad, { once: true })
            img.addEventListener('error', () => {
                console.error(`Image file not found or failed to load: ${url}`)
                resolve(null)
            }, { once: true })

            img.src = url

            // Check if dimensions are already available (cached image)
            if (img.complete && img.naturalWidth > 0) {
                handleLoad()
            }
        })
    }

    getVideoDimensions(url) {
        return new Promise((resolve) => {
            const video = document.createElement('video')
            video.preload = 'metadata'

            video.addEventListener('loadedmetadata', () => {
                if (video.videoWidth && video.videoHeight) {
                    resolve({ width: video.videoWidth, height: video.videoHeight })
                } else {
                    console.error(`Video file not found or failed to load: ${url}`)
                    resolve(null)
                }
            }, { once: true })

            video.addEventListener('error', () => {
                console.error(`Video file not found or failed to load: ${url}`)
                resolve(null)
            }, { once: true })

            video.src = url
        })
    }

    calculateWindowSize(dimensions) {
        const screenWidth = screen.availWidth * this.POPUP_SCREEN_WIDTH_RATIO
        const screenHeight = screen.availHeight * this.POPUP_SCREEN_HEIGHT_RATIO
        const imageRatio = dimensions.width / dimensions.height

        let width = dimensions.width
        let height = dimensions.height

        if (width > screenWidth) {
            width = screenWidth
            height = width / imageRatio
        }
        if (height > screenHeight) {
            height = screenHeight
            width = height * imageRatio
        }

        const left = (screen.availWidth - width) / 2
        const top = (screen.availHeight - height) / 2

        return {
            width: Math.round(width),
            height: Math.round(height),
            left: Math.round(left),
            top: Math.round(top)
        }
    }
}


// ============================================================================
// Carousel Class
// ============================================================================

/**
 * Manages carousel functionality with navigation controls and intersection observers
 */
class Carousel {
    constructor(options = {}) {
        // Configuration
        const { id = '', element = null } = options
        this.id = id

        // DOM Elements
        this.carouselEl = element
        this.slidesWrapperEl = this.carouselEl.querySelector('[data-carousel-slides-wrapper]')
        this.slidesEls = Array.from(this.carouselEl.querySelectorAll('[data-carousel-slides] figure'))
        this.controlsEl = null
        this.navEl = null
        this.prevButtonEl = null
        this.nextButtonEl = null
        this.dotEls = []
        this.leftEdgeEl = null
        this.rightEdgeEl = null
        this.announcementEl = null

        // State
        this.observer = null
        this.activeSlide = null

        // Constants
        this.ACTIVE_CLASS = 'active'

        this.init()
    }

    // Initialization

    init() {
        this.createEdgeNavigation()
        this.setupEdgeNavigationEventListeners()
        this.createControlNavigation()
        this.setupControlNavigationEventListeners()
        this.setupIntersectionObserver()
    }

    // Edge Navigation

    createEdgeNavigation() {
        this.leftEdgeEl = document.createElement('div')
        this.leftEdgeEl.setAttribute('data-carousel-edge-left', '')
        this.leftEdgeEl.setAttribute('aria-hidden', 'true')
        this.slidesWrapperEl.appendChild(this.leftEdgeEl)

        this.rightEdgeEl = document.createElement('div')
        this.rightEdgeEl.setAttribute('data-carousel-edge-right', '')
        this.rightEdgeEl.setAttribute('aria-hidden', 'true')
        this.slidesWrapperEl.appendChild(this.rightEdgeEl)
    }

    setupEdgeNavigationEventListeners() {
        this.leftEdgeEl.addEventListener('click', (e) => {
            e.stopPropagation()
            if (this.activeSlide?.previousElementSibling) {
                this.scrollToSlide(this.activeSlide.previousElementSibling)
            }
        })

        this.rightEdgeEl.addEventListener('click', (e) => {
            e.stopPropagation()
            if (this.activeSlide?.nextElementSibling) {
                this.scrollToSlide(this.activeSlide.nextElementSibling)
            }
        })
    }

    // Control Navigation

    createControlNavigation() {
        this.controlsEl = document.createElement('div')
        this.controlsEl.setAttribute('data-carousel-controls', '')

        // Add ARIA live region for screen reader announcements
        this.controlsEl.innerHTML = `
                <div data-carousel-nav-wrapper>
                    <div data-carousel-nav role="tablist" aria-label="Carousel navigation"></div>
                </div>
                <ul data-carousel-arrows>
                    <li><button type="button" aria-label="Previous slide" class="carousel-button-prev"></button></li>
                    <li><button type="button" aria-label="Next slide" class="carousel-button-next"></button></li>
                </ul>
                <div class="sr-only" role="status" aria-live="polite" aria-atomic="true" data-carousel-announcement></div>
            `
        this.carouselEl.appendChild(this.controlsEl)

        this.navEl = this.controlsEl.querySelector('[data-carousel-nav]')
        this.prevButtonEl = this.controlsEl.querySelector('[data-carousel-arrows] li:first-child button')
        this.nextButtonEl = this.controlsEl.querySelector('[data-carousel-arrows] li:last-child button')
        this.announcementEl = this.controlsEl.querySelector('[data-carousel-announcement]')

        const navButtons = this.slidesEls.map((slideEl, index) => {
            const val = slideEl.getAttribute('data-value') || index
            return `<button role="tab" data-label-for="${val}" aria-label="Go to slide ${index + 1}" tabindex="${index === 0 ? '0' : '-1'}"><span class="sr-only">Slide ${index + 1}</span></button>`
        })

        this.navEl.innerHTML = navButtons.join('')
        this.dotEls = Array.from(this.navEl.querySelectorAll('button'))

        if (this.dotEls.length > 0) {
            this.dotEls[0].setAttribute('aria-current', 'true')
            this.dotEls[0].setAttribute('aria-selected', 'true')
        }
    }

    setupControlNavigationEventListeners() {
        // Use event delegation for dot buttons
        this.navEl.addEventListener('click', (event) => {
            const button = event.target.closest('button[data-label-for]')
            if (!button) return

            const targetValue = button.getAttribute('data-label-for')
            const targetSlideEl = this.carouselEl.querySelector(`figure[data-value="${targetValue}"]`)
            if (targetSlideEl) {
                this.scrollToSlide(targetSlideEl)
            }
        })

        // Keyboard navigation for carousel controls
        this.navEl.addEventListener('keydown', (event) => {
            const currentButton = event.target.closest('button[data-label-for]')
            if (!currentButton) return

            let handled = false
            const currentIndex = this.dotEls.indexOf(currentButton)

            switch (event.key) {
                case 'ArrowLeft':
                case 'ArrowUp':
                    // Navigate to previous slide
                    if (currentIndex > 0) {
                        this.dotEls[currentIndex - 1].focus()
                        this.dotEls[currentIndex - 1].click()
                    }
                    handled = true
                    break
                case 'ArrowRight':
                case 'ArrowDown':
                    // Navigate to next slide
                    if (currentIndex < this.dotEls.length - 1) {
                        this.dotEls[currentIndex + 1].focus()
                        this.dotEls[currentIndex + 1].click()
                    }
                    handled = true
                    break
                case 'Home':
                    // Go to first slide
                    this.dotEls[0].focus()
                    this.dotEls[0].click()
                    handled = true
                    break
                case 'End':
                    // Go to last slide
                    const lastIndex = this.dotEls.length - 1
                    this.dotEls[lastIndex].focus()
                    this.dotEls[lastIndex].click()
                    handled = true
                    break
            }

            if (handled) {
                event.preventDefault()
            }
        })

        this.prevButtonEl.addEventListener('click', () => this.navigateToSlide('prev'))
        this.nextButtonEl.addEventListener('click', () => this.navigateToSlide('next'))

        // Add keyboard shortcuts for prev/next buttons
        this.prevButtonEl.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                this.navigateToSlide('prev')
            }
        })

        this.nextButtonEl.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                this.navigateToSlide('next')
            }
        })
    }

    // Intersection Observer

    setupIntersectionObserver() {
        const observerCallback = (entries) => {
            for (let i = 0; i < entries.length; i++) {
                const entry = entries[i]
                if (entry.isIntersecting) {
                    this.activeSlide = entry.target
                    entry.target.classList.add(this.ACTIVE_CLASS)

                    const slideIndex = this.slidesEls.indexOf(entry.target)
                    for (let j = 0; j < this.dotEls.length; j++) {
                        const isActive = j === slideIndex
                        this.dotEls[j].toggleAttribute('aria-current', isActive)
                        this.dotEls[j].setAttribute('aria-selected', isActive ? 'true' : 'false')
                        this.dotEls[j].setAttribute('tabindex', isActive ? '0' : '-1')
                    }

                    // Announce slide change to screen readers
                    if (this.announcementEl) {
                        this.announcementEl.textContent = `Slide ${slideIndex + 1} of ${this.slidesEls.length}`
                    }
                } else {
                    entry.target.classList.remove(this.ACTIVE_CLASS)
                }
            }
        }

        this.observer = new IntersectionObserver(observerCallback, {
            root: this.carouselEl,
            rootMargin: '0%',
            threshold: 0.5
        })

        this.slidesEls.forEach(slideEl => this.observer.observe(slideEl))
    }

    // Navigation Methods

    navigateToSlide(direction) {
        if (!this.activeSlide) return

        const targetSlideEl = direction === 'prev'
            ? this.activeSlide.previousElementSibling
            : this.activeSlide.nextElementSibling

        if (targetSlideEl) {
            this.scrollToSlide(targetSlideEl)
        }
    }

    scrollToSlide(slideEl) {
        if (slideEl) {
            slideEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'start' })
        }
    }
}

// ============================================================================
// KeyboardNavigator Class
// ============================================================================

/**
 * Enables keyboard navigation for containers with focusable items
 * Supports both linear lists and 2D grids with arrow keys, Home/End
 * Used by ImageGridNavigator and MenuDropdownNavigator
 */
class KeyboardNavigator {
    constructor(options = {}) {
        // Configuration
        this.containerSelector = options.containerSelector
        this.itemSelector = options.itemSelector
        this.fallbackSelector = options.fallbackSelector
        this.is2DGrid = options.is2DGrid ?? true // Default to grid layout detection

        // State
        this.containers = null

        // Bound handlers
        this.boundHandleKeydown = this.handleKeydown.bind(this)

        this.init()
    }

    // Initialization

    init() {
        this.containers = Array.from(document.querySelectorAll(this.containerSelector))

        this.containers.forEach(container => {
            let items = this.getItems(container)

            items.forEach((item, index) => {
                // First item is focusable, rest are not (use arrow keys to navigate)
                item.setAttribute('tabindex', index === 0 ? '0' : '-1')
                item.addEventListener('keydown', this.boundHandleKeydown)
            })
        })
    }

    // DOM Helpers

    getItems(container) {
        let items = Array.from(container.querySelectorAll(this.itemSelector))

        // Fallback selector if primary selector finds nothing
        if (items.length === 0 && this.fallbackSelector) {
            items = Array.from(container.querySelectorAll(this.fallbackSelector))
        }

        return items
    }

    // Event Handlers

    handleKeydown(event) {
        const currentItem = event.target
        const container = currentItem.closest(this.containerSelector)
        if (!container) return

        const items = this.getItems(container)
        const currentIndex = items.indexOf(currentItem)
        let targetIndex = -1
        let handled = false

        // Detect grid layout (check if items wrap) only if 2D grid mode is enabled
        let itemsPerRow = 1
        if (this.is2DGrid) {
            const containerWidth = container.offsetWidth
            const itemWidth = items[0]?.offsetWidth || 0
            itemsPerRow = itemWidth > 0 ? Math.floor(containerWidth / itemWidth) : 1
        }

        switch (event.key) {
            case 'ArrowRight':
                // Move to next item
                targetIndex = Math.min(currentIndex + 1, items.length - 1)
                handled = true
                break
            case 'ArrowLeft':
                // Move to previous item
                targetIndex = Math.max(currentIndex - 1, 0)
                handled = true
                break
            case 'ArrowDown':
                if (this.is2DGrid) {
                    // Move to item in next row (grid)
                    targetIndex = Math.min(currentIndex + itemsPerRow, items.length - 1)
                } else {
                    // Move to next item (list)
                    targetIndex = Math.min(currentIndex + 1, items.length - 1)
                }
                handled = true
                break
            case 'ArrowUp':
                if (this.is2DGrid) {
                    // Move to item in previous row (grid)
                    targetIndex = Math.max(currentIndex - itemsPerRow, 0)
                } else {
                    // Move to previous item (list)
                    targetIndex = Math.max(currentIndex - 1, 0)
                }
                handled = true
                break
            case 'Home':
                // Move to first item
                targetIndex = 0
                handled = true
                break
            case 'End':
                // Move to last item
                targetIndex = items.length - 1
                handled = true
                break
            case 'Enter':
            case ' ':
                // Activate the item
                event.preventDefault()
                currentItem.click()
                return
        }

        if (handled && targetIndex !== -1 && targetIndex !== currentIndex) {
            event.preventDefault()

            // Update tabindex
            items.forEach((item, index) => {
                item.setAttribute('tabindex', index === targetIndex ? '0' : '-1')
            })

            // Focus target item
            items[targetIndex].focus()
        }
    }

    // Cleanup

    destroy() {
        if (this.containers) {
            this.containers.forEach(container => {
                const items = this.getItems(container)
                items.forEach(item => {
                    item.removeEventListener('keydown', this.boundHandleKeydown)
                    item.removeAttribute('tabindex')
                })
            })
        }
    }
}


// ============================================================================
// ImageGridNavigator Class
// ============================================================================

/**
 * Enables keyboard navigation for image grids
 * Wrapper around KeyboardNavigator with image grid specific configuration
 */
class ImageGridNavigator extends KeyboardNavigator {
    constructor(options = {}) {
        super({
            containerSelector: options.containerSelector || '.hover-cards, .image-grid',
            itemSelector: options.itemSelector || 'figure a',
            fallbackSelector: 'figure',
            is2DGrid: true
        })
    }
}


// ============================================================================
// MenuDropdownNavigator Class
// ============================================================================

/**
 * Enables keyboard navigation for menu dropdown
 * Arrow keys move through focusable items like Tab/Shift+Tab
 */
class MenuDropdownNavigator {
    constructor(options = {}) {
        // Configuration
        this.dropdownSelector = options.dropdownSelector || '#menu-dropdown'
        this.itemSelector = options.itemSelector || 'a, label, button'

        // Bound handlers
        this.boundHandleKeydown = this.handleKeydown.bind(this)

        this.init()
    }

    // Initialization

    init() {
        // Listen on document to catch events from both dropdown and close button
        document.addEventListener('keydown', this.boundHandleKeydown)
    }

    // Event Handlers

    handleKeydown(event) {
        // Only handle arrow keys
        if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp' && event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return

        // Only enable navigation when menu is actually open
        if (window.location.hash !== '#menu') return

        const dropdown = document.querySelector(this.dropdownSelector)
        if (!dropdown) return

        const closeButton = App.getEl('menu-button-close')

        // Right arrow: go to close button (only if currently in dropdown)
        if (event.key === 'ArrowRight') {
            const currentElement = document.activeElement
            const items = Array.from(dropdown.querySelectorAll(this.itemSelector))

            // Only respond if currently focused on a dropdown item
            if (items.includes(currentElement)) {
                event.preventDefault()
                if (closeButton) {
                    closeButton.focus()
                }
            }
            return
        }

        // Left arrow: go to first dropdown item (works from anywhere in menu)
        if (event.key === 'ArrowLeft') {
            event.preventDefault()
            const firstItem = dropdown.querySelector(this.itemSelector)
            if (firstItem) {
                firstItem.focus()
            }
            return
        }

        // Get all focusable items
        const items = Array.from(dropdown.querySelectorAll(this.itemSelector))
            .filter(item => {
                // Filter out items that aren't visible or focusable
                return item.offsetParent !== null &&
                    !item.hasAttribute('inert') &&
                    !item.disabled
            })

        const currentIndex = items.indexOf(document.activeElement)

        // If no item is focused, don't do anything
        if (currentIndex === -1) return

        event.preventDefault()

        let targetIndex
        if (event.key === 'ArrowDown') {
            // Move to next item (like Tab)
            targetIndex = currentIndex + 1
            if (targetIndex >= items.length) {
                targetIndex = 0 // Wrap to first item
            }
        } else {
            // Move to previous item (like Shift+Tab)
            targetIndex = currentIndex - 1
            if (targetIndex < 0) {
                targetIndex = items.length - 1 // Wrap to last item
            }
        }

        items[targetIndex].focus()
    }

    // Cleanup

    destroy() {
        document.removeEventListener('keydown', this.boundHandleKeydown)
    }
}


// ============================================================================
// Global Utility Functions
// ============================================================================

/**
 * Copy text to clipboard with iOS Safari fallback
 * @param {string} text - The text to copy to clipboard
 * @returns {Promise<boolean>} - True if copy succeeded, false otherwise
 */
async function copyToClipboard(text) {
    // Try modern Clipboard API first
    if (navigator.clipboard && navigator.clipboard.writeText) {
        try {
            await navigator.clipboard.writeText(text)
            return true
        } catch (err) {
            console.warn('Clipboard API failed, trying fallback:', err)
        }
    }

    // Fallback: legacy execCommand (better iOS Safari support)
    try {
        const textarea = document.createElement('textarea')
        textarea.value = text
        textarea.style.position = 'absolute'
        textarea.style.left = '-999rem'
        textarea.style.top = window.pageYOffset + 'px'
        textarea.setAttribute('readonly', '')
        document.body.appendChild(textarea)
        textarea.select()
        textarea.setSelectionRange(0, text.length)
        const successful = document.execCommand('copy')
        document.body.removeChild(textarea)
        return successful
    } catch (err) {
        console.error('Clipboard copy failed:', err)
        return false
    }
}

// ============================================================================
// Touch Interaction Functions
// ============================================================================

/**
 * Handles touch button/link click interactions with focus management
 * On touch devices: first tap focuses, second tap executes callback or allows default behavior
 * On non-touch devices: executes callback immediately or allows default behavior
 *
 * @param {HTMLElement} element - The element being clicked
 * @param {Event} event - The click event
 * @param {Function|null} callback - Optional callback to execute on second tap. If null, allows default behavior
 * @param {boolean} focusAfterClick - Whether to maintain focus after callback execution
 * @returns {boolean} - True if event was handled (default prevented), false if default should proceed
 */
App.handleTouchButtonClick = (element, event, callback = null, focusAfterClick = false) => {
    // Non-touch devices: execute callback or allow default
    if (!isTouchDevice) {
        if (callback) {
            event.preventDefault()
            callback()
            return true
        }
        return false
    }

    // Check if this is the second tap by looking for our marker attribute
    const isSecondTap = element.getAttribute(TOUCH_PRIMED_ATTRIBUTE) === 'true'

    // If this is the second tap, execute callback
    if (isSecondTap) {
        event.preventDefault()

        // Clean up the marker
        element.removeAttribute(TOUCH_PRIMED_ATTRIBUTE)

        if (callback) {
            callback()

            // If focusAfterClick is true, maintain focus on element after callback
            if (focusAfterClick) {
                element.setAttribute('data-focus-after-click', 'true')
                element.focus()
                element.addEventListener('blur', () => {
                    element.removeAttribute('data-focus-after-click')
                }, { once: true })
            }
            return true
        } else {
            // No callback: navigate to href manually
            if (element.href) {
                window.location.href = element.href
            }
            return false
        }
    }

    // First tap: mark element as primed for second tap
    event.preventDefault()
    element.setAttribute(TOUCH_PRIMED_ATTRIBUTE, 'true')

    // Focus the element for visual feedback
    element.focus()

    return true
}

/**
 * Initialize touch button handler with global cleanup
 * Sets up document-level click listener to clear primed state when user taps elsewhere
 * Only called once on page load for touch devices
 *
 * Related to: App.handleTouchButtonClick
 */
function initializeTouchButtonHandler() {
    // Handler will be registered in the centralized global event manager
    // See: initializeGlobalEventHandlers()
}

// ============================================================================
// Timeline Functions
// ============================================================================

/**
 * Initialize the timeline component with scrollers
 * Timeline persists for the entire session once initialized
 *
 * Integration points:
 * - Creates <horizontal-timeline> custom element
 * - Sets up edge and drag scrolling for horizontal navigation
 * - Starts intersection observer to track active sections
 *
 * @param {boolean} startObserver - Whether to start the intersection observer immediately
 */
App.initializeTimeline = (startObserver = true) => {
    // Prevent duplicate timeline creation
    if (App.timeline) {
        console.warn('Timeline already initialized')
        return
    }

    // Timeline configuration
    const TIMELINE_CONFIG = {
        labels: ['2024-21', '2021-19', '2019-18', 'elsewhen'],
        containerId: 'horizontal-timeline',
        hashPrefix: '#archive',
        scrollOffset: 24, // px from top when scrolling to sections
        scrollEndTimeout: 300, // fallback for browsers without scrollend event
        observerRootMargin: '-50% 0% -50% 0%', // center detection zone vertically
        observerThresholds: [0, 0.25, 0.5, 0.75, 1] // granular intersection updates
    }

    // Create and configure timeline element
    App.timeline = document.createElement('horizontal-timeline')
    App.timeline.labels = TIMELINE_CONFIG.labels
    App.timeline.hashPrefix = TIMELINE_CONFIG.hashPrefix
    App.timeline.scrollOffset = TIMELINE_CONFIG.scrollOffset
    App.timeline.scrollEndTimeout = TIMELINE_CONFIG.scrollEndTimeout
    App.timeline.observerRootMargin = TIMELINE_CONFIG.observerRootMargin
    App.timeline.observerThresholds = TIMELINE_CONFIG.observerThresholds

    const container = document.querySelector(`#${TIMELINE_CONFIG.containerId}`)
    if (!container) {
        console.error('Timeline: Container not found')
        return
    }

    container.appendChild(App.timeline)

    // Only start observer if requested (skip for deep-link scenarios)
    if (startObserver) {
        App.timeline.startIntersectionObserver()
    }

    // Setup horizontal scrolling enhancements
    const timelineContent = document.querySelector('#timeline-content')
    let edgeScroller, dragScroll

    const isScrollable = () => timelineContent && timelineContent.scrollWidth > timelineContent.clientWidth

    const createScrollers = () => {
        if (!isScrollable()) return
        if (!edgeScroller) edgeScroller = new HorizontalEdgeScroller({ id: 'timeline', element: timelineContent })
        if (!dragScroll) dragScroll = new HorizontalDragScroller({ element: timelineContent })
    }

    const destroyScrollers = () => {
        if (edgeScroller) {
            edgeScroller.destroy()
            edgeScroller = null
        }
        if (dragScroll) {
            dragScroll.destroy()
            dragScroll = null
        }
    }

    const handleResize = () => {
        if (isScrollable()) {
            createScrollers()
        } else {
            destroyScrollers()
        }
    }

    if (timelineContent) {
        handleResize()
        window.addEventListener('resize', handleResize)
    }
}

// ============================================================================
// Dialog Initialization Functions
// ============================================================================

/**
 * Initialize dialog elements with ARIA attributes and backdrops
 */
function initializeDialogs() {
    const dialogConfigs = [DIALOG_CONFIG.PROFILE, DIALOG_CONFIG.ARCHIVE, DIALOG_CONFIG.MENU]

    for (const config of dialogConfigs) {
        const dialogEl = App.getEl(config.id)
        if (dialogEl) {
            if (!dialogEl.getAttribute('role')) {
                dialogEl.setAttribute('role', 'dialog')
            }
            aria.addBackdrop(config.id)
        }
    }
}

/**
 * Open the appropriate dialog based on URL hash on page load
 */
const openDialogOnLoad = () => {
    const { base: baseHash } = parseHash()

    switch (baseHash) {
        case NAVIGATION_HASHES.PROFILE:
            openDialog(DIALOG_CONFIG.PROFILE.id, DIALOG_CONFIG.PROFILE.trigger, null, 'profile')
            break
        case NAVIGATION_HASHES.ARCHIVE:
            openDialog(DIALOG_CONFIG.ARCHIVE.id, DIALOG_CONFIG.ARCHIVE.trigger)
            break
        case NAVIGATION_HASHES.MENU:
            openDialog(DIALOG_CONFIG.MENU.id, DIALOG_CONFIG.MENU.trigger, DIALOG_CONFIG.MENU.close, 'menu')
            break
    }
}

// ============================================================================
// Animation Control Functions
// ============================================================================

/**
 * Add class to prevent initial page-load animations
 */
const applyNoAnimation = () => {
    const SKIP_ANIMATION_CLASS = 'skip-animation'
    const elements = document.querySelectorAll(
        `.intro__logo--animating,
            .intro__name--animating,
            .intro__name--animating .intro__name-frame>p,
            .intro__title--animating,
            .intro__title--animating>p,
            .intro__title--animating .intro__animated-text span,
            .intro__title--animating .intro__animated-text--alt span,
            .availability--animating,
            .availability--animating .availability__background,
            .availability--animating .availability__content,
            .menu--animating .menu__background,
            .menu--animating .menu__email,
            .menu--animating .menu__link,
            .menu--animating #menu-toggle`
    )

    for (let i = 0; i < elements.length; i++) {
        elements[i].classList.add(SKIP_ANIMATION_CLASS)
    }
}

// ============================================================================
// Modal-Specific Initialization Functions
// ============================================================================

/**
 * Initialize 3D transform effect for modal profile footer art based on scroll
 * Event listeners persist for page lifetime per YAGNI principle
 */
const initializeModalFooterArt = () => {
    const footerArtWrapper = document.querySelector('.modal-profile__footer-art')
    const footerArt = document.querySelector('.modal-profile__footer-art-gradient')
    const modalProfile = App.getEl(DIALOG_CONFIG.PROFILE.id)

    if (!footerArtWrapper || !footerArt || !modalProfile) return

    const handleScroll = () => {
        const rect = footerArtWrapper.getBoundingClientRect()
        const modalRect = modalProfile.getBoundingClientRect()
        const inViewDistance = Math.min(Math.max((modalRect.height + rect.height) - rect.bottom, 0), rect.height)
        const progress = Math.min(Math.max(inViewDistance / rect.height, 0), 1)
        footerArt.style.transform = `rotateX(${progress * 30}deg)`
    }

    modalProfile.addEventListener('scroll', handleScroll, { passive: true })
    window.addEventListener('resize', handleScroll)
    handleScroll()
}

// ============================================================================
// Fullscreen Functions
// ============================================================================


/**
 * Check if browser supports fullscreen API
 * @returns {boolean} True if fullscreen is supported
 */
const isFullscreenSupported = () => {
    return !!(
        document.fullscreenEnabled ||
        document.webkitFullscreenEnabled ||
        document.mozFullScreenEnabled ||
        document.msFullscreenEnabled
    )
}

/**
 * Toggle fullscreen mode for the document
 * Only called if fullscreen is supported
 */
App.toggleFullscreen = () => {
    if (!isFullscreenSupported()) {
        console.warn('Fullscreen API is not supported in this browser')
        return
    }

    if (!document.fullscreenElement) {
        const requestMethod = document.documentElement.requestFullscreen ||
            document.documentElement.webkitRequestFullscreen ||
            document.documentElement.mozRequestFullScreen ||
            document.documentElement.msRequestFullscreen

        if (requestMethod) {
            requestMethod.call(document.documentElement)
        }
    } else {
        const exitMethod = document.exitFullscreen ||
            document.webkitExitFullscreen ||
            document.mozCancelFullScreen ||
            document.msExitFullscreen

        if (exitMethod) {
            exitMethod.call(document)
        }
    }
}

/**
 * Synchronize the hidden #fullscreen input with actual fullscreen state
 * Handles native exits (Escape key) and vendor-prefixed events
 */
function setupFullscreenSync() {
    const syncHandler = () => {
        const fullscreenInput = App.getEl('fullscreen')
        const isFullscreen = !!(
            document.fullscreenElement ||
            document.webkitFullscreenElement ||
            document.mozFullScreenElement ||
            document.msFullscreenElement
        )
        if (fullscreenInput) fullscreenInput.checked = isFullscreen
    }

    // Listen for standard and vendor-prefixed fullscreen events
    document.addEventListener('fullscreenchange', syncHandler)
    document.addEventListener('webkitfullscreenchange', syncHandler)
    document.addEventListener('mozfullscreenchange', syncHandler)
    document.addEventListener('MSFullscreenChange', syncHandler)

    // Set initial state
    syncHandler()
}

// ============================================================================
// Link Enhancement Functions
// ============================================================================

/**
 * Enhance all external links with security and accessibility features
 * - Adds rel="noopener noreferrer" for security
 * - Adds screen reader text indicating link opens in new tab
 * - Ensures aria-label mentions new tab if not already present
 */
function enhanceExternalLinks() {
    const externalLinks = document.querySelectorAll('a[target="_blank"]')

    externalLinks.forEach(link => {
        // Add security attributes
        if (!link.getAttribute('rel')) {
            link.setAttribute('rel', 'noopener noreferrer')
        }

        // Check if link already has "(opens in new tab)" text
        const linkText = link.textContent.toLowerCase()
        const hasNewTabText = linkText.includes('opens in new tab') ||
            linkText.includes('opens in new window')

        // Check if aria-label already mentions new tab
        const ariaLabel = link.getAttribute('aria-label') || ''
        const ariaHasNewTab = ariaLabel.toLowerCase().includes('opens in new tab') ||
            ariaLabel.toLowerCase().includes('opens in new window')

        // Add screen reader text if not already present
        if (!hasNewTabText && !ariaHasNewTab) {
            // Check if link has existing sr-only content
            const existingSrOnly = link.querySelector('.sr-only')
            if (!existingSrOnly) {
                const srText = document.createElement('span')
                srText.className = 'sr-only'
                srText.textContent = ' (opens in new tab)'
                link.appendChild(srText)
            }

            // Update aria-label if it exists
            if (ariaLabel) {
                link.setAttribute('aria-label', `${ariaLabel} (opens in new tab)`)
            }
        }
    })
}

// ============================================================================
// Component Initialization Functions
// ============================================================================

/**
 * Initialize click handlers with cached querySelector results
 */
function initializeClickHandlers() {
    // Cache DOM queries at page load
    const nameTooltip = document.querySelector('.intro__name .tooltip__text--bottom span')
    const emailTooltip = document.querySelector('.menu__email .tooltip__text span')
    const emailHighlight = document.querySelector('.menu__email .highlight')

    // Setup name element click handler
    const nameElement = document.querySelector('.intro__name')
    if (nameElement && nameTooltip) {
        nameElement.onclick = function (event) {
            App.handleTouchButtonClick(this, event, () => {
                copyToClipboard('Štěpán Jákl')
                App.textHighlighter.highlightAndCopyText(event, nameTooltip, this, 'Copied to the clipboard')
            }, true)
        }
    }

    // Setup email button click handler
    const emailButton = document.querySelector('.menu__email-button')
    if (emailButton && emailTooltip && emailHighlight) {
        emailButton.onclick = function (event) {
            App.handleTouchButtonClick(this, event, () => {
                copyToClipboard('stepan.jakl@icloud.com')
                App.textHighlighter.highlightAndCopyText(event, emailTooltip, emailHighlight, 'Copied to the clipboard')
            })
        }
    }
}

/**
 * Initialize live timezone display that updates every 15 seconds
 */
function initializeTimezoneDisplay() {
    const timezoneEl = document.querySelector('.modal-profile__timezone-live')
    if (!timezoneEl) return

    const liveTimezoneTime = () => {
        timezoneEl.innerHTML = `(${new Intl.DateTimeFormat('de-DE', {
            timeZone: 'Europe/London',
            timeZoneName: 'short',
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        }).format(new Date())})`
    }

    liveTimezoneTime()
    setInterval(liveTimezoneTime, 15000)
}

/**
 * Initialize popup system with event delegation for media links
 */
function initializePopups() {
    // Handlers will be registered in the centralized global event manager
    // See: initializeGlobalEventHandlers()

    // Initialize popup instance for use by global handlers
    if (!window.App.popupInstance) {
        window.App.popupInstance = new Popup()
        window.App.popupPreloadedLinks = new WeakSet()
    }
}

// ============================================================================
// Hash Navigation Functions
// ============================================================================

/**
 * Setup hash change handler for archive year navigation
 */
function setupHashChangeHandler() {
    const OVERFLOW_HIDDEN_CLASS = 'overflow-hidden'
    let scrollTop = document.body.scrollTop

    window.addEventListener('scroll', () => {
        scrollTop = document.body.scrollTop
    }, { passive: true })

    window.addEventListener('hashchange', () => {
        const { base: baseHash, params } = parseHash()
        const yearParam = params.year

        // Handle archive year parameter changes during session
        if (baseHash === NAVIGATION_HASHES.ARCHIVE && yearParam) {
            // Check if modal is currently open (to distinguish from initial page load)
            const modalArchive = getModalElement(NAVIGATION_HASHES.ARCHIVE)
            const isModalOpen = document.body.classList.contains('modal-open')

            if (isModalOpen) {
                // Modal is already open (via body.modal-open class), just scroll to new section
                afterPaint(() => {
                    const targetSection = document.querySelector(`[data-timeline-section="${yearParam}"]`)

                    if (targetSection && modalArchive && App.timeline) {
                        App.timeline.scrollParentToChildVertical(modalArchive, targetSection, 'smooth')

                        // Update timeline state
                        App.timeline.setActiveLabel(yearParam)
                        App.timeline.setActiveIndicator(yearParam)

                        const activeLabel = App.timeline.querySelector(`[data-label-for="${yearParam}"]`)
                        if (activeLabel) {
                            App.timeline.scrollParentToChildCenterHorizontal(
                                App.timeline.getTimelineContentEl(),
                                activeLabel
                            )
                        }
                    }
                })
            }
        }

        // Prevent default scroll behavior
        document.body.classList.add(OVERFLOW_HIDDEN_CLASS)
        window.scroll(0, scrollTop)

        requestAnimationFrame(() => {
            document.body.classList.remove(OVERFLOW_HIDDEN_CLASS)
        })
    })
}

// ============================================================================
// Global Event Handlers
// ============================================================================

/**
 * Centralized global event handler for document-level events
 * Reduces number of event listeners by consolidating similar handlers
 * Uses event delegation pattern for optimal performance
 */
function initializeGlobalEventHandlers() {
    // Single document click handler for multiple concerns
    document.addEventListener('click', (event) => {
        // 1. Clear touch button primed states when user taps elsewhere
        if (isTouchDevice) {
            const primedElements = document.querySelectorAll(`[${TOUCH_PRIMED_ATTRIBUTE}="true"]`)
            primedElements.forEach(el => {
                if (!el.contains(event.target)) {
                    el.removeAttribute(TOUCH_PRIMED_ATTRIBUTE)
                }
            })
        }

        // 2. Handle popup link clicks
        const popupLink = event.target.closest(POPUP_LINK_SELECTOR)
        if (popupLink && App.popupInstance) {
            App.popupInstance.open(popupLink, event)
        }
    }, { capture: true })

    // Single document mouseover handler for link preloading
    document.addEventListener('mouseover', (event) => {
        const link = event.target.closest(POPUP_LINK_SELECTOR)
        if (!link || !App.popupInstance || !App.popupPreloadedLinks) return
        if (App.popupPreloadedLinks.has(link)) return

        // Preload placeholder images for faster popup display
        if (!App.popupInstance.isVideo(link.href)) {
            const placeholderUrl = App.popupInstance.getPlaceholderUrl(link.href)
            const preloadImg = new Image()
            preloadImg.src = placeholderUrl
        }
        App.popupPreloadedLinks.add(link)
    }, { passive: true })
}

// ============================================================================
// DOM Content Loaded Event Handler
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
    // Constants
    const TOUCH_DEVICE_CLASS = 'touch-device'
    const NO_FULLSCREEN_CLASS = 'no-fullscreen'

    // Helper Functions

    /**
     * Check if menu intro animation has finished
     * Helper for one-time animation check on first interaction
     */
    const isMenuAnimationFinished = () => {
        const el = document.querySelector('.menu--animating .menu__background')
        if (!el) return true
        const animations = el.getAnimations()
        return !animations || animations.length === 0 || animations[0].playState === 'finished'
    }

    // Animation Skip Setup

    // Apply no animation on first click
    document.body.addEventListener('click', () => {
        if (!isMenuAnimationFinished()) {
            applyNoAnimation()
        }
    }, { once: true })

    // Core Initialization

    initializeDialogs()
    enhanceExternalLinks()
    initializePopups()
    initializeGlobalEventHandlers()

    // Device Detection

    // Detect touch device and setup touch-specific handlers
    if (isTouchDevice) {
        document.body.classList.add(TOUCH_DEVICE_CLASS)
        initializeTouchButtonHandler()
    }

    // Detect fullscreen support
    if (!isFullscreenSupported()) {
        document.body.classList.add(NO_FULLSCREEN_CLASS)
    }

    setupFullscreenSync()

    // Hash-Based Navigation Setup

    // Initialize UI based on current hash (deep linking)
    if (window.location.hash) {
        applyNoAnimation()
        openDialogOnLoad()
    }

    setupHashChangeHandler()

    // Global Handlers Initialization

    // Initialize persistent handlers (active throughout page lifetime)
    new WheelHandler()
    new TouchHandler()
    new KeyHandler()
    App.textHighlighter = new TextHighlighter()

    // Interactive Components Initialization

    initializeClickHandlers()
    initializeTimezoneDisplay()

    // Initialize carousels
    const carouselElements = document.querySelectorAll('[data-carousel]')
    for (let i = 0; i < carouselElements.length; i++) {
        new Carousel({ id: `carousel-${i + 1}`, element: carouselElements[i] })
    }

    // Keyboard Navigation Setup

    // Initialize keyboard navigation for image grids
    new ImageGridNavigator({
        containerSelector: '.hover-cards, .image-grid',
        itemSelector: 'figure a'
    })

    // Initialize keyboard navigation for menu dropdown
    new MenuDropdownNavigator({
        dropdownSelector: '#menu-dropdown',
        itemSelector: 'a, label, button'
    })

    // Timeline Positioning Setup

    // Setup global timeline positioning function with cached queries
    App.positionTimeline = (() => {
        // Cache positioning elements (queried once, reused on every resize)
        let archiveWrapperEl, timelineContentSectionEl, timelineWrapperEl

        return () => {
            // Lazy initialization with caching
            archiveWrapperEl ??= document.querySelector('.modal-archive__timeline')
            timelineContentSectionEl ??= document.querySelector('.modal-archive__timeline-grid [data-timeline-section]')
            timelineWrapperEl ??= document.querySelector('#horizontal-timeline')

            if (!archiveWrapperEl || !timelineContentSectionEl || !timelineWrapperEl) return

            const archiveWrapperRect = archiveWrapperEl.getBoundingClientRect()
            const timelineContentSectionRect = timelineContentSectionEl.getBoundingClientRect()

            timelineWrapperEl.style.setProperty('left', `${timelineContentSectionRect.left - archiveWrapperRect.left}px`)
            timelineWrapperEl.style.setProperty('right', `${archiveWrapperRect.right - timelineContentSectionRect.right}px`)
        }
    })()

    // Resize Handler Registration

    // Register timeline positioning with centralized resize manager
    ResizeManager.register(() => {
        if (App.timeline) {
            App.positionTimeline()
        }
    })
});

// ============================================================================
// Console Welcome Message
// ============================================================================

/**
 * Display styled welcome message in browser console
 * Uses green-lime color scheme with margin/padding/border for supporting browsers
 * Browsers without spacing support get separate log statements
 */
(function () {
    // Theme Colors
    const COLOR = '#7cce00' // Green-lime (HSL: 115, 100, 75)
    const BG_COLOR = 'rgba(124, 206, 0, 0.075)'

    // Message Content
    const HEADER = 'Štěpán Jákl | Full-stack developer & interface designer'
    const LINE_1 = 'This website is built with HTML, CSS, and vanilla JavaScript.'
    const LINE_2 = 'The goal: a fast, pixel-perfect, and fully responsive experience.'
    const LINE_3 = 'No frameworks, no build tools, no generators. Just pure craftsmanship.'
    const LINE_4 = 'Interested in working together? Reach out via email at'
    const EMAIL = 'stepan.jakl@icloud.com'

    // Browser Feature Detection
    const supportsSpacing = !navigator.userAgent.includes('Safari') || navigator.userAgent.includes('Chrome')

    if (supportsSpacing) {
        // Bordered box style with padding and margin (Chrome, Firefox, Edge)
        const boxStyle = `border: max(1px, 0.0625rem) solid ${COLOR}; border-radius: 0.125rem; color: ${COLOR}; background: ${BG_COLOR}; font-size: 0.8125rem; padding: 1.40625rem 2.1875rem 1.25rem 2.1875rem; margin: 1.25rem 1.25rem;`
        const textStyle = `color: ${COLOR}; font-size: 0.75rem; margin: 0.9375rem 0 0.9375rem 1.25rem;`
        const linkStyle = `color: ${COLOR}; font-size: 0.75rem; text-decoration: underline;`

        console.log(`%c${HEADER}`, boxStyle)
        console.log(`%c${LINE_1}`, textStyle)
        console.log(`%c${LINE_2}`, textStyle)
        console.log(`%c${LINE_3}`, textStyle)
        console.log(`%c${LINE_4} %c${EMAIL}`, textStyle, linkStyle)
    } else {
        // Separate log statements for browsers without spacing support (Safari)
        const headerStyle = `color: ${COLOR}; font-size: 0.78125rem; font-weight: bold;`
        const textStyle = `color: ${COLOR};`

        console.log(`%c${HEADER}`, headerStyle)
        console.log(`%c${LINE_1}`, textStyle)
        console.log(`%c${LINE_2}`, textStyle)
        console.log(`%c${LINE_3}`, textStyle)
        console.log(`%c${LINE_4} ${EMAIL}`, textStyle)
    }
})()
