/*!
 * Personal website of Štěpán Jákl
 * https://stepanjakl.github.io
 *
 * Copyright © 2025 Štěpán Jákl
 * Released under the MIT license
 * https://github.com/stepanjakl/stepanjakl.github.io/blob/main/LICENSE
 */

// ============================================================================
// Utility Functions
// ============================================================================

const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0 || navigator.msMaxTouchPoints > 0

const isAnimationFinished = (selector) => {
    const animations = document.querySelector(selector)?.getAnimations()
    return !animations || animations.length === 0 || animations[0].playState === 'finished'
}

// Shared animation gate selector (used across handlers)
const ANIMATION_CHECK_SELECTOR = '.menu--animating .menu__background'

const getCurrentHash = () => window.location.hash

const getHashWithoutParams = () => getCurrentHash().split('?')[0]

// Exact hash match (e.g., getCurrentHash() === '#profile')
const isHash = (hash) => getCurrentHash() === hash

// Partial hash match - for deep links with params (e.g., '#archive?year=2024' includes '#archive')
const hashIncludes = (hash) => getCurrentHash().includes(hash)

// WeakMap to track one-time blur handlers for touch buttons without mutating elements
const touchBlurHandlers = new WeakMap()

// Shared navigation constants
const NAVIGATION_HASHES = Object.freeze({
    PROFILE: '#profile',
    ARCHIVE: '#archive',
    MENU: '#menu'
})

const MODAL_SELECTORS = Object.freeze({
    PROFILE: '#modal-profile',
    ARCHIVE: '#modal-archive'
})

// Dialog configuration for consistent ID references
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

// ============================================================================
// Dialog Lifecycle Configuration
// ============================================================================

/**
 * Register lifecycle hooks for modal dialogs
 * This connects the generic dialog.js with project-specific initialization/cleanup
 */
function registerDialogLifecycleHooks(retryCount = 0) {
    if (typeof aria === 'undefined' || typeof aria.registerLifecycleHooks !== 'function') {
        // Retry up to 50 times (500ms total) if aria isn't ready yet
        if (retryCount < 50) {
            setTimeout(() => registerDialogLifecycleHooks(retryCount + 1), 10)
        } else {
            console.error('Failed to register dialog lifecycle hooks: aria not available')
        }
        return
    }

    // Archive modal lifecycle
    aria.registerLifecycleHooks(DIALOG_CONFIG.ARCHIVE.id, {
        initialize: () => {
            // Initialize timeline on first modal open
            if (!window.timelineEl) {
                window.initializeTimeline()

                // Position timeline after modal transition completes
                const modalArchiveEl = document.getElementById('modal-archive')
                if (modalArchiveEl) {
                    let positioned = false

                    const positionOnce = () => {
                        if (!positioned) {
                            positioned = true
                            window.positionTimeline()
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
            }

            // Start the observer when modal opens
            if (window.timelineEl && window.timelineEl.startIntersectionObserver) {
                window.timelineEl.startIntersectionObserver()
            }
        },
        cleanup: () => {
            if (window.timelineEl) {
                window.timelineEl.stopIntersectionObserver()
            }
        }
    })

    // Profile modal lifecycle
    aria.registerLifecycleHooks(DIALOG_CONFIG.PROFILE.id, {
        initialize: () => {
            // Only initialize if not already initialized
            if (!window.footerArtCleanup) {
                window.footerArtCleanup = initializeModalFooterArt()
            }
        }
        // No cleanup needed - footer art persists for the session
    })
}

// Register hooks immediately (will retry if aria not loaded yet)
registerDialogLifecycleHooks()

// ============================================================================
// TextHighlighter Class
// ============================================================================

/**
 * Handles text highlighting and copying with temporary text replacement
 */
class TextHighlighter {
    constructor() {
        this.originalText = ''
        this.HIGHLIGHT_DURATION = 1000
        this.HIGHLIGHT_ACTIVE_CLASS = 'highlight--active'
    }

    highlightAndCopyText(event, textElement, highlightElement, temporaryText) {
        const target = event.target
        if (target.getAttribute('data-copying') !== '') {
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
}


// ============================================================================
// KeyHandler Class
// ============================================================================

/**
 * Handles keyboard shortcuts and tooltip interactions
 */
class KeyHandler {
    constructor() {
        this.tooltipElements = null
        this.debugElement = null
        this.TOOLTIP_ITEMS_SELECTOR = '#menu-link-profile, #menu-link-archive, #menu-toggle'
        this.TOOLTIP_ACTIVE_CLASS = 'tooltip-key--active'

        this.KEYS = {
            ESCAPE: 'Escape',
            KEY_P: 'p',
            KEY_A: 'a',
            KEY_M: 'm',
            KEY_D: 'd'
        }

        this.boundHandleKeydown = this.handleKeydown.bind(this)
        this.boundHandleKeyup = this.handleKeyup.bind(this)
        this.boundRemoveTooltips = () => this.toggleTooltipActiveClass(false)

        document.addEventListener('keydown', this.boundHandleKeydown)
        document.addEventListener('keyup', this.boundHandleKeyup)
        window.addEventListener('blur', this.boundRemoveTooltips)
        document.body.addEventListener('click', this.boundRemoveTooltips)
    }

    getTooltipElements() {
        return this.tooltipElements ??= Array.from(document.querySelectorAll(this.TOOLTIP_ITEMS_SELECTOR))
    }

    handleKeydown(event) {
        const rawKey = event.key
        const key = rawKey?.toLowerCase()

        // Always allow Escape to close dialogs, regardless of animation state
        if (rawKey === this.KEYS.ESCAPE) {
            if (aria.getCurrentDialog()) {
                closeDialog('#')
            }
        } else {
            if (!isAnimationFinished(ANIMATION_CHECK_SELECTOR)) return
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

        // useIncludes: true = partial match (#archive?year=2024), false = exact match (#profile)
        const shouldClose = useIncludes ? hashIncludes(hash) : isHash(hash)

        if (shouldClose) {
            closeDialog('#')
        } else {
            openDialog(dialogId, triggerId, focusFirst, hash.substring(1))
        }
    }

    toggleDebug(event) {
        event.preventDefault()
        this.debugElement ??= document.getElementById('debug')
        if (this.debugElement) {
            this.debugElement.checked = !this.debugElement.checked
        }
    }

    handleTooltipActiveClass(event) {
        const hash = getCurrentHash()
        const hashValue = hash.split('#')[1]

        if (hashValue) {
            this.toggleTooltipActiveClass(false)
        } else if (event.ctrlKey || event.metaKey) {
            if (!hash) {
                this.toggleTooltipActiveClass(true)
            }
        }
    }
}


// ============================================================================
// WheelHandler Class
// ============================================================================

/**
 * Handles mouse wheel scrolling for navigation between dialogs and pages
 */
class WheelHandler {
    constructor() {
        this.modalProfileEl = null
        this.modalArchiveEl = null
        this.SCROLL_MIN_THRESHOLD = 5

        this.boundHandleWheelEvent = this.handleWheelEvent.bind(this)
        window.addEventListener('wheel', this.boundHandleWheelEvent, { passive: true })
    }

    getModalElement(hash) {
        if (hash === NAVIGATION_HASHES.PROFILE) {
            return this.modalProfileEl ??= document.querySelector(MODAL_SELECTORS.PROFILE)
        } else if (hash === NAVIGATION_HASHES.ARCHIVE) {
            return this.modalArchiveEl ??= document.querySelector(MODAL_SELECTORS.ARCHIVE)
        }
        return null
    }

    handleWheelEvent(event) {
        if (!isAnimationFinished(ANIMATION_CHECK_SELECTOR)) return

        const deltaX = Math.abs(event.deltaX)
        const deltaY = Math.abs(event.deltaY)

        if (deltaY > deltaX && deltaY > this.SCROLL_MIN_THRESHOLD) {
            this.handleVerticalScroll(event.deltaY)
        } else if (deltaX > deltaY && deltaX > this.SCROLL_MIN_THRESHOLD) {
            this.handleHorizontalScroll(event.deltaX)
        }
    }

    handleVerticalScroll(deltaY) {
        const direction = deltaY > 0 ? 'down' : 'up'
        const currentHash = getHashWithoutParams()

        if (currentHash === NAVIGATION_HASHES.PROFILE || currentHash === NAVIGATION_HASHES.ARCHIVE) {
            this.handleModalVerticalScroll(direction, currentHash)
        } else {
            this.handleVerticalPageScroll(direction)
        }
    }

    handleModalVerticalScroll(direction, currentHash) {
        if (direction !== 'up') return

        const modalElement = this.getModalElement(currentHash)
        if (modalElement?.scrollTop === 0) {
            closeDialog('#')
        }
    }

    handleVerticalPageScroll(direction) {
        if (direction !== 'down' || getCurrentHash()) return

        if (window.scrollY + window.innerHeight >= document.body.scrollHeight) {
            openDialog(DIALOG_CONFIG.PROFILE.id, DIALOG_CONFIG.PROFILE.trigger, null, 'profile')
        }
    }

    handleHorizontalScroll(deltaX) {
        const direction = deltaX > 0 ? 'right' : 'left'
        const hash = getCurrentHash()
        const scrollX = window.scrollX

        if (direction === 'right' && !hash) {
            if (scrollX + window.innerWidth >= document.body.scrollWidth) {
                openDialog(DIALOG_CONFIG.MENU.id, DIALOG_CONFIG.MENU.trigger, DIALOG_CONFIG.MENU.close, 'menu')
            }
        } else if (direction === 'left' && hash === NAVIGATION_HASHES.MENU && scrollX === 0) {
            closeDialog('#')
        }
    }
}


// ============================================================================
// TouchHandler Class
// ============================================================================

/**
 * Handles touch gestures for navigation on mobile devices
 */
class TouchHandler {
    constructor() {
        this.touchStartX = 0
        this.touchStartY = 0
        this.modalProfileEl = null
        this.modalArchiveEl = null
        this.SCROLL_MIN_THRESHOLD = 5

        this.boundHandleTouchStart = this.handleTouchStart.bind(this)
        this.boundHandleTouchMove = this.handleTouchMove.bind(this)
        window.addEventListener('touchstart', this.boundHandleTouchStart, { passive: true })
        window.addEventListener('touchmove', this.boundHandleTouchMove, { passive: true })
    }

    handleTouchStart(event) {
        const touch = event.touches[0]
        this.touchStartX = touch.clientX
        this.touchStartY = touch.clientY
    }

    getModalElement(hash) {
        if (hash === NAVIGATION_HASHES.PROFILE) {
            return this.modalProfileEl ??= document.querySelector(MODAL_SELECTORS.PROFILE)
        } else if (hash === NAVIGATION_HASHES.ARCHIVE) {
            return this.modalArchiveEl ??= document.querySelector(MODAL_SELECTORS.ARCHIVE)
        }
        return null
    }

    handleTouchMove(event) {
        if (!isAnimationFinished(ANIMATION_CHECK_SELECTOR)) return

        const touch = event.touches[0]
        const deltaX = Math.abs(touch.clientX - this.touchStartX)
        const deltaY = Math.abs(touch.clientY - this.touchStartY)

        if (deltaY > deltaX && deltaY > this.SCROLL_MIN_THRESHOLD) {
            this.handleVerticalScroll(touch.clientY)
        } else if (deltaX > deltaY && deltaX > this.SCROLL_MIN_THRESHOLD) {
            this.handleHorizontalScroll(touch.clientX)
        }
    }

    handleVerticalScroll(touchEndY) {
        const direction = touchEndY < this.touchStartY ? 'down' : 'up'
        const currentHash = getHashWithoutParams()

        if (currentHash === NAVIGATION_HASHES.PROFILE || currentHash === NAVIGATION_HASHES.ARCHIVE) {
            this.handleModalScroll(direction, currentHash)
        } else {
            this.handleVerticalPageScroll(direction)
        }
    }

    handleModalScroll(direction, currentHash) {
        if (direction !== 'up') return

        const modalElement = this.getModalElement(currentHash)
        if (modalElement?.scrollTop === 0) {
            closeDialog('#')
        }
    }

    handleVerticalPageScroll(direction) {
        if (direction !== 'down' || getCurrentHash()) return

        if (window.scrollY + window.innerHeight >= document.body.scrollHeight) {
            openDialog(DIALOG_CONFIG.PROFILE.id, DIALOG_CONFIG.PROFILE.trigger, null, 'profile')
        }
    }

    handleHorizontalScroll(touchEndX) {
        const direction = touchEndX > this.touchStartX ? 'right' : 'left'
        const hash = getCurrentHash()
        const scrollX = window.scrollX

        if (direction === 'right' && hash === NAVIGATION_HASHES.MENU && scrollX + window.innerWidth >= document.body.scrollWidth) {
            closeDialog('#')
        } else if (direction === 'left' && !hash && scrollX === 0) {
            openDialog(DIALOG_CONFIG.MENU.id, DIALOG_CONFIG.MENU.trigger, DIALOG_CONFIG.MENU.close, 'menu')
        }
    }
}


// ============================================================================
// HorizontalDragScroller Class
// ============================================================================

/**
 * Enables drag-to-scroll functionality on horizontal scrollable elements
 */
class HorizontalDragScroller {
    constructor(options = {}) {
        this.element = options.element
        this.isMouseDown = false
        this.startX = 0
        this.scrollLeft = 0

        this.MOUSE_DOWN_CLASS = 'x-drag-scroll--mouse-down'
        this.DRAGGING_CLASS = 'x-drag-scroll--dragging'
        this.DRAG_RELEASE_TIMEOUT = 300

        this.onMouseDownBound = this.onMouseDown.bind(this)
        this.onMouseMoveBound = this.onMouseMove.bind(this)
        this.completeDragBound = this.completeDrag.bind(this)

        this.element.addEventListener('mousedown', this.onMouseDownBound)
        this.element.addEventListener('mousemove', this.onMouseMoveBound)
        this.element.addEventListener('mouseup', this.completeDragBound)
        this.element.addEventListener('mouseleave', this.completeDragBound)
    }

    destroy() {
        this.element.removeEventListener('mousedown', this.onMouseDownBound)
        this.element.removeEventListener('mousemove', this.onMouseMoveBound)
        this.element.removeEventListener('mouseup', this.completeDragBound)
        this.element.removeEventListener('mouseleave', this.completeDragBound)
    }

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
        this.options = options
        this.element = options.element
        this.maxSpeed = options.maxSpeed ?? 0.75
        this.scrollSpeed = 0
        this.isScrolling = false
        this.lastTimestamp = null
        this.isSnapped = true
        this.edgeWidth = 0
        this.mediaQuery = window.matchMedia('(min-width: 45rem)')
        this.styleElement = null

        this.DRAGGING_CLASS = 'x-drag-scroll--dragging'
        this.EDGE_SCROLLING_CLASS = 'edge-x-scroll--scrolling'
        this.SCROLL_STOP_TIMEOUT = 300

        this.scrollStep = this.scrollStep.bind(this)
        this.handleMouseOut = this.handleMouseOut.bind(this)

        if (!isTouchDevice) {
            this.handleMouseMoveBound = this.handleMouseMove.bind(this)
            this.onResizeBound = this.onResize.bind(this)
            document.addEventListener('mousemove', this.handleMouseMoveBound)
            window.addEventListener('resize', this.onResizeBound)
            this.onResize()
        }
    }

    onResize() {
        this.edgeWidth = (this.options.edgeWidthRatio ?? 3) * parseFloat(getComputedStyle(document.body).fontSize)
        this.updatePseudoElementStyles()
    }

    updatePseudoElementStyles() {
        const { id } = this.options
        this.element.setAttribute('data-edge-scroll-id', id)

        const styleId = `horizontal-edge-scroll-style-${id}`

        if (!this.styleElement) {
            this.styleElement = document.getElementById(styleId)
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

    startScroll() {
        if (this.isScrolling) return

        this.isScrolling = true
        this.isSnapped = false
        this.element.classList.add(this.EDGE_SCROLLING_CLASS)
        requestAnimationFrame(this.scrollStep)
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

    stopScroll() {
        this.scrollSpeed = 0
    }

    calculateSpeed(distance, direction) {
        const speed = (this.maxSpeed * (this.edgeWidth - distance)) / this.edgeWidth
        return direction === 'left' ? -speed : speed
    }

    destroy() {
        if (!isTouchDevice && this.handleMouseMoveBound) {
            document.removeEventListener('mousemove', this.handleMouseMoveBound)
            window.removeEventListener('resize', this.onResizeBound)
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
// Popup Class
// ============================================================================

/**
 * Handles image and video popups with fallback views for blocked popups
 */
class Popup {
    constructor() {
        this.widthRatio = 0.9
        this.heightRatio = 0.9
        this.fallbackContainer = null
        this.wrapperElement = null
        this.stylesInjected = false
        this.handleEscapeKey = null
        this.handleFallbackClick = null

        this.ASPECT_RATIO_TALL_THRESHOLD = 0.85
        this.SQUARE_RATIO_MIN = 0.95
        this.SQUARE_RATIO_MAX = 1.05
        this.SQUARE_RATIO_CLASS = 'square-ratio'

        // Static property to track popup blocking across all instances
        if (typeof Popup.isPopupBlocked === 'undefined') {
            Popup.isPopupBlocked = false
        }
    }

    generatePopupHTML(href, isVideo, placeholderUrl, includeOverlay = false) {
        const mediaElementHtml = isVideo
            ? `<video src="${href}" controls autoplay playsinline></video>`
            : placeholderUrl
                ? `<img src="${href}" onload="requestAnimationFrame(()=>requestAnimationFrame(()=>{this.nextElementSibling.style.opacity='0'}))" style="width:100%;height:auto"><img src="${placeholderUrl}" style="position:absolute;inset:0;width:100%;height:auto;transition:opacity .3s linear">`
                : `<img src="${href}" />`

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

    async open(element, event) {
        event.preventDefault()
        const { href } = element

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
        // Add overlay for all images (not videos)
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
        else {
            // Otherwise attempt to open a centered popup window
            const popup = window.open(blobUrl, `popup_${Date.now()}`, `toolbar=no,location=no,status=no,menubar=no,scrollbars=yes,resizable=yes,width=${width},height=${height},top=${top},left=${left},popup=yes`)

            if (!popup || popup.closed || typeof popup.closed === 'undefined') {
                Popup.isPopupBlocked = true
                console.info('Popup was blocked. Using inline fallback for the session.')
                this.showFallbackView(href, isVideo, dimensions, placeholderUrl)
                return true
            }
        }

        return false
    }

    showFallbackView(url, isVideo, dimensions, placeholderUrl) {
        // Initialize fallback container only once
        if (!this.fallbackContainer) {
            this.initializeFallbackContainer()
        }

        // Cache wrapper element reference
        if (!this.wrapperElement) {
            this.wrapperElement = this.fallbackContainer.querySelector('.media_fallback-content')
        }

        const wrapper = this.wrapperElement

        // Reset wrapper state
        wrapper.classList.remove(this.SQUARE_RATIO_CLASS)

        // Build content based on media type
        const fragment = document.createDocumentFragment()

        if (isVideo) {
            const closeButton = this.createCloseButton()
            fragment.appendChild(closeButton)
        } else {
            const overlay = this.createCloseOverlay()
            fragment.appendChild(overlay)
        }

        // Handle square ratio for images
        if (!isVideo && dimensions) {
            const aspectRatio = dimensions.width / dimensions.height
            if (aspectRatio >= this.SQUARE_RATIO_MIN && aspectRatio <= this.SQUARE_RATIO_MAX) {
                wrapper.classList.add(this.SQUARE_RATIO_CLASS)
            }
        }

        // Create media element
        if (isVideo) {
            const video = document.createElement('video')
            video.src = url
            video.controls = true
            video.autoplay = true
            fragment.appendChild(video)
        } else {
            // Full image
            const img = document.createElement('img')
            img.src = url

            // Placeholder image (if available)
            let placeholder = null
            if (placeholderUrl) {
                placeholder = document.createElement('img')
                placeholder.src = placeholderUrl
                placeholder.style.position = 'absolute'
                placeholder.style.inset = '0'
                placeholder.style.margin = 'auto'
                placeholder.style.transition = 'opacity 0.3s linear'
                placeholder.style.opacity = '0'

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
    }

    initializeFallbackContainer() {
        this.fallbackContainer = document.createElement('div')
        this.fallbackContainer.className = 'media_fallback_overlay'
        this.fallbackContainer.innerHTML = `<div class="media_fallback-wrapper"><div class="media_fallback-content"></div></div>`

        // Inject styles only once
        if (!this.stylesInjected && !document.getElementById('media_fallback-styles')) {
            this.injectStyles()
            this.stylesInjected = true
        }

        // Set up event delegation for close actions
        this.handleFallbackClick = (e) => {
            if (e.target.classList.contains('media_fallback-close-overlay') ||
                e.target.classList.contains('media_fallback-close-button') ||
                e.target.closest('.media_fallback-close-button')) {
                this.closeFallbackView()
            }
        }
        this.fallbackContainer.addEventListener('click', this.handleFallbackClick)

        // Set up escape key handler once
        this.handleEscapeKey = (e) => {
            if (e.key === 'Escape' && this.fallbackContainer?.parentElement) {
                e.stopPropagation()
                e.preventDefault()
                this.closeFallbackView()
            }
        }
        document.addEventListener('keydown', this.handleEscapeKey, true)
    }

    createCloseButton() {
        const button = document.createElement('button')
        button.className = 'media_fallback-close-button'
        button.setAttribute('aria-label', 'Close')
        button.type = 'button'
        button.innerHTML = '<svg class="fill-current" style="width: 1.125rem; height: 1.125rem"><use xlink:href="images/icons.svg#close"></use></svg>'
        return button
    }

    createCloseOverlay() {
        const overlay = document.createElement('div')
        overlay.className = 'media_fallback-close-overlay'
        overlay.setAttribute('aria-label', 'Close')
        overlay.tabIndex = 0
        return overlay
    }

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
            .media_fallback-content.square-ratio {
                height: 100%;
                min-height: auto;
                align-items: center;
                justify-content: center;
            }
            .media_fallback-content img {
                position: relative;
                margin: auto;
                width: 100%;
                height: auto;
                opacity: 1;
            }
            .media_fallback-content.square-ratio img {
                width: auto;
                height: 100%;
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
                right: 0;
                margin-top: var(--modal-button-inset);
                margin-right: var(--modal-button-inset);
                width: var(--modal-button-size);
                height: var(--modal-button-size);
                border-radius: 50%;
                color: rgba(255,255,255,0.75);
                background: rgba(0, 0, 0, 0.55);
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
                transition: color 200ms linear, background-color 200ms linear;
            }
            .media_fallback-close-button:hover {
                background: rgba(0, 0, 0, 0.45);
                color: rgba(255,255,255,0.95);
                transition: color 150ms linear, background-color 150ms linear;
            }
            .media_fallback-close-button::after {
                content: '';
                position: absolute;
                inset: 0;
                border-radius: 50%;
                background: rgba(255, 255, 255, 0.15);
                mix-blend-mode: lighten;
                transition: background-color 200ms linear;
            }
            .media_fallback-close-button:hover::after {
                background: rgba(255, 255, 255, 0.25);
                transition: background-color 150ms linear;
            }
            .media_fallback-close-button:focus {
                outline: 2px solid white;
                outline-offset: 2px;
            }
        `
        document.head.appendChild(styles)
    }

    closeFallbackView() {
        if (this.fallbackContainer && this.fallbackContainer.parentElement) {
            this.fallbackContainer.remove()
            // Note: We keep the Escape key event listener attached since it's added only once
            // during initialization and checks if container is in DOM
        }
    }

    isVideo(url) {
        return /\.(mp4|webm|ogg)$/i.test(url)
    }

    getPlaceholderUrl(url) {
        return url.replace('.full.', '.min.')
    }

    getImageDimensions(url) {
        return new Promise((resolve) => {
            const img = new Image()

            const handleLoad = () => {
                if (img.naturalWidth && img.naturalHeight) {
                    resolve({ width: img.naturalWidth, height: img.naturalHeight })
                } else {
                    resolve(null)
                }
            }

            img.addEventListener('load', handleLoad, { once: true })
            img.addEventListener('error', () => resolve(null), { once: true })

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
                resolve({ width: video.videoWidth, height: video.videoHeight })
            }, { once: true })

            video.addEventListener('error', () => {
                resolve(null)
            }, { once: true })

            video.src = url
        })
    }

    calculateWindowSize(dimensions) {
        const screenWidth = screen.availWidth * this.widthRatio
        const screenHeight = screen.availHeight * this.heightRatio
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
        const { id = '', element = null } = options
        this.id = id
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
        this.observer = null
        this.activeSlide = {
            element: null,
            get: () => this.activeSlide.element,
            set: (el) => this.activeSlide.element = el
        }

        this.ACTIVE_CLASS = 'active'

        this.init()
    }

    init() {
        this.createEdgeNavigation()
        this.setupEdgeNavigationEventListeners()
        this.createControlNavigation()
        this.setupControlNavigationEventListeners()
        this.setupIntersectionObserver()
    }

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
            const activeSlide = this.activeSlide.get()
            if (activeSlide?.previousElementSibling) {
                this.scrollToSlide(activeSlide.previousElementSibling)
            }
        })

        this.rightEdgeEl.addEventListener('click', (e) => {
            e.stopPropagation()
            const activeSlide = this.activeSlide.get()
            if (activeSlide?.nextElementSibling) {
                this.scrollToSlide(activeSlide.nextElementSibling)
            }
        })
    }

    createControlNavigation() {
        this.controlsEl = document.createElement('div')
        this.controlsEl.setAttribute('data-carousel-controls', '')
        this.controlsEl.innerHTML = `
                <div data-carousel-nav-wrapper>
                    <div data-carousel-nav></div>
                </div>
                <ul data-carousel-arrows>
                    <li><button type="button" aria-label="Previous slide"></button></li>
                    <li><button type="button" aria-label="Next slide"></button></li>
                </ul>
            `
        this.carouselEl.appendChild(this.controlsEl)

        this.navEl = this.controlsEl.querySelector('[data-carousel-nav]')
        this.prevButtonEl = this.controlsEl.querySelector('[data-carousel-arrows] li:first-child button')
        this.nextButtonEl = this.controlsEl.querySelector('[data-carousel-arrows] li:last-child button')

        const navButtons = this.slidesEls.map((slideEl, index) => {
            const val = slideEl.getAttribute('data-value') || index
            return `<button data-label-for="${val}"><span class="sr-only">Slide ${index + 1}</span></button>`
        })

        this.navEl.innerHTML = navButtons.join('')
        this.dotEls = Array.from(this.navEl.querySelectorAll('button'))

        if (this.dotEls.length > 0) {
            this.dotEls[0].setAttribute('aria-current', 'true')
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

        this.prevButtonEl.addEventListener('click', () => this.navigateToSlide('prev'))
        this.nextButtonEl.addEventListener('click', () => this.navigateToSlide('next'))
    }

    setupIntersectionObserver() {
        const observerCallback = (entries) => {
            for (let i = 0; i < entries.length; i++) {
                const entry = entries[i]
                if (entry.isIntersecting) {
                    this.activeSlide.set(entry.target)
                    entry.target.classList.add(this.ACTIVE_CLASS)

                    const slideIndex = this.slidesEls.indexOf(entry.target)
                    for (let j = 0; j < this.dotEls.length; j++) {
                        this.dotEls[j].toggleAttribute('aria-current', j === slideIndex)
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

    navigateToSlide(direction) {
        const currentSlideEl = this.activeSlide.get()
        if (!currentSlideEl) return

        const targetSlideEl = direction === 'prev'
            ? currentSlideEl.previousElementSibling
            : currentSlideEl.nextElementSibling

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
// Global Functions
// ============================================================================

/**
 * Handles touch button click interactions with focus management
 * On touch devices: first tap focuses, second tap executes callback
 * On non-touch devices: executes callback immediately
 */
window.handleTouchButtonClick = (element, event, callback, focusAfterClick = false) => {
    event.preventDefault()

    // Non-touch devices execute immediately
    if (!isTouchDevice) {
        callback()
        return
    }

    // Track click count on the element
    element.clickCount = (element.clickCount || 0) + 1

    // First click: set up blur handler and focus
    if (element.clickCount === 1) {
        const handleBlur = () => {
            element.clickCount = 0
            element.removeAttribute('data-focus-after-click')
            touchBlurHandlers.delete(element)
        }

        touchBlurHandlers.set(element, handleBlur)
        element.addEventListener('blur', handleBlur, { once: true })
        element.focus()
        return
    }

    // Second click: execute callback
    if (element.clickCount === 2 || element.getAttribute('data-focus-after-click') === 'true') {
        callback()

        // If focusAfterClick is true, maintain focus on element after callback
        if (focusAfterClick) {
            element.setAttribute('data-focus-after-click', 'true')
            element.focus()
            element.addEventListener('blur', () => {
                element.removeAttribute('data-focus-after-click')
            }, { once: true })
        }
    }
}

/**
 * Initializes the timeline component with scrollers and deep-link handling.
 * Timeline persists for the entire session once initialized.
 *
 * Integration points:
 * - Creates <horizontal-timeline> custom element
 * - Sets up edge and drag scrolling for horizontal navigation
 * - Handles deep-link URLs with ?year= parameter
 * - Starts intersection observer to track active sections
 */
window.initializeTimeline = () => {
    // Prevent duplicate timeline creation
    if (window.timelineEl) {
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
    window.timelineEl = document.createElement('horizontal-timeline')
    window.timelineEl.labels = TIMELINE_CONFIG.labels
    window.timelineEl.hashPrefix = TIMELINE_CONFIG.hashPrefix
    window.timelineEl.scrollOffset = TIMELINE_CONFIG.scrollOffset
    window.timelineEl.scrollEndTimeout = TIMELINE_CONFIG.scrollEndTimeout
    window.timelineEl.observerRootMargin = TIMELINE_CONFIG.observerRootMargin
    window.timelineEl.observerThresholds = TIMELINE_CONFIG.observerThresholds

    const container = document.querySelector(`#${TIMELINE_CONFIG.containerId}`)
    if (!container) {
        console.error('Timeline: Container not found')
        return
    }

    container.appendChild(window.timelineEl)

    // Start intersection observer to track active sections
    window.timelineEl.startIntersectionObserver()

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

    // Handle deep-link URLs with ?year= parameter
    handleTimelineDeepLink()
}

/**
 * Handle deep-link URLs with ?year= parameter.
 * Opens archive modal and scrolls to the specified year section.
 *
 * Example: https://example.com/#archive?year=2024-21
 */
function handleTimelineDeepLink() {
    if (!window.location.hash.includes('?year=')) return

    const yearParam = window.location.hash.split('?year=')[1]
    if (!yearParam) return

    // Use the same hash prefix as configured for the timeline
    const hashPrefix = window.timelineEl?.hashPrefix || '#archive'

    // Temporarily clear hash to prevent browser's default scroll jump
    window.history.pushState(null, '', `${window.location.pathname}${hashPrefix}`)

    requestAnimationFrame(() => {
        // Restore hash with year parameter
        window.history.replaceState(
            null,
            '',
            `${window.location.pathname}${hashPrefix}?year=${yearParam}`
        )

        // Open archive modal
        if (typeof openDialog === 'function' && typeof DIALOG_CONFIG !== 'undefined') {
            openDialog(DIALOG_CONFIG.ARCHIVE.id, DIALOG_CONFIG.ARCHIVE.trigger)
        }

        // Scroll to target section instantly (no animation to avoid jarring UX)
        const targetSection = document.querySelector(`[data-timeline-section="${yearParam}"]`)
        const modalArchive = document.querySelector('#modal-archive')

        if (targetSection && modalArchive && window.timelineEl) {
            window.timelineEl.scrollParentToChildVertical(modalArchive, targetSection, 'instant')
        }
    })
}

/**
 * Initializes dialog elements with ARIA attributes and backdrops
 */
function initializeDialogs() {
    const dialogConfigs = [DIALOG_CONFIG.PROFILE, DIALOG_CONFIG.ARCHIVE, DIALOG_CONFIG.MENU]

    for (const config of dialogConfigs) {
        const dialogEl = document.getElementById(config.id)
        if (dialogEl) {
            if (!dialogEl.getAttribute('role')) {
                dialogEl.setAttribute('role', 'dialog')
            }
            aria.addBackdrop(config.id)
        }
    }
}

/**
 * Adds class to prevent initial page-load animations
 */
const applyNoAnimation = () => {
    const SKIP_ANIMATION_CLASS = 'skip-animation'
    const elements = document.querySelectorAll(
        `#square-2,
             #square-3,
             #square-4,
            .intro__logo--animating,
            .intro__name--animating,
            .intro__name--animating .intro__name-frame>p,
            .intro__primary-title.intro__title--animating,
            .intro__secondary-title.intro__title--animating,
            .intro__primary-title.intro__title--animating>p,
            .intro__secondary-title.intro__title--animating>p,
            .intro__primary-title.intro__title--animating .intro__animated-text span,
            .intro__secondary-title.intro__title--animating .intro__animated-text span,
            .intro__primary-title.intro__title--animating .intro__animated-text--alt span,
            .intro__secondary-title.intro__title--animating .intro__animated-text--alt span,
            .availability--animating,
            .availability--animating .availability__background,
            .availability--animating .availability__content,
            .menu--animating .menu__background,
            .menu--animating .menu__email,
            .menu--animating .menu__link,
            .menu--animating .menu__toggle`
    )

    for (let i = 0; i < elements.length; i++) {
        elements[i].classList.add(SKIP_ANIMATION_CLASS)
    }
}

/**
 * Opens the appropriate dialog based on URL hash on page load
 */
const openDialogOnLoad = () => {
    switch (window.location.hash.split('?')[0]) {
        case '#profile':
            openDialog(DIALOG_CONFIG.PROFILE.id, DIALOG_CONFIG.PROFILE.trigger, null, 'profile')
            break
        case '#archive':
            const yearParam = window.location.hash.split('?year=')[1]
            if (yearParam) {
                localStorage.setItem('archiveYear', yearParam)
            }
            openDialog(DIALOG_CONFIG.ARCHIVE.id, DIALOG_CONFIG.ARCHIVE.trigger, null, window.location.hash)
            break
        case '#menu':
            openDialog(DIALOG_CONFIG.MENU.id, DIALOG_CONFIG.MENU.trigger, DIALOG_CONFIG.MENU.close, 'menu')
            break
    }
}


/**
 * Initializes 3D transform effect for modal profile footer art based on scroll
 */
const initializeModalFooterArt = () => {
    const footerArtWrapper = document.querySelector('.modal-profile__footer-art')
    const footerArt = document.querySelector('.modal-profile__footer-art-gradient')
    const modalProfile = document.getElementById(DIALOG_CONFIG.PROFILE.id)

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

    // Return cleanup function
    return () => {
        modalProfile.removeEventListener('scroll', handleScroll)
        window.removeEventListener('resize', handleScroll)
    }
}


/**
 * Toggles fullscreen mode for the document
 */
window.toggleFullscreen = () => {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen()
    } else if (document.exitFullscreen) {
        document.exitFullscreen()
    }
}

// ============================================================================
// DOM Content Loaded Event Handler
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
    const ANIMATION_CHECK_SELECTOR = '.menu--animating .menu__background'
    const TOUCH_DEVICE_CLASS = 'touch-device'
    const OVERFLOW_HIDDEN_CLASS = 'overflow-hidden'

    // Apply no animation on first click
    document.body.addEventListener('click', () => {
        if (!isAnimationFinished(ANIMATION_CHECK_SELECTOR)) {
            applyNoAnimation()
        }
    }, { once: true })

    initializeDialogs()

    // Detect touch device
    if (isTouchDevice) {
        document.body.classList.add(TOUCH_DEVICE_CLASS)
    }

    // Initialize the UI elements based on the current hash
    if (window.location.hash) {
        applyNoAnimation()
        openDialogOnLoad()
    }

    // Prevent the default behavior of scrolling to the hash
    let scrollTop = document.body.scrollTop

    window.addEventListener('scroll', () => {
        scrollTop = document.body.scrollTop
    }, { passive: true })

    window.addEventListener('hashchange', () => {
        document.body.classList.add(OVERFLOW_HIDDEN_CLASS)
        window.scroll(0, scrollTop)

        requestAnimationFrame(() => {
            document.body.classList.remove(OVERFLOW_HIDDEN_CLASS)
        })
    })

    // Initialize global handlers (persistent throughout page lifetime)
    new WheelHandler()
    new TouchHandler()
    new KeyHandler()

    // Initialize text highlighter
    window.textHighlighter = new TextHighlighter()

    // Initialize carousels (persistent throughout page lifetime)
    const carouselElements = document.querySelectorAll('[data-carousel]')
    for (let i = 0; i < carouselElements.length; i++) {
        new Carousel({ id: `carousel-${i + 1}`, element: carouselElements[i] })
    }

    // Initialize popups with delegated listeners to reduce per-link handlers
    const popupInstance = new Popup()
    const preloadedLinks = new WeakSet()

    document.addEventListener('mouseover', (e) => {
        const link = e.target.closest('a[target="_blank"][href$=".mp4"], a[target="_blank"][href$=".png"], a[target="_blank"][href$=".jpg"], a[target="_blank"][href$=".svg"]')
        if (!link) return
        if (preloadedLinks.has(link)) return
        if (!popupInstance.isVideo(link.href)) {
            const placeholderUrl = popupInstance.getPlaceholderUrl(link.href)
            const preloadImg = new Image()
            preloadImg.src = placeholderUrl
        }
        preloadedLinks.add(link)
    })

    document.addEventListener('click', (e) => {
        const link = e.target.closest('a[target="_blank"][href$=".mp4"], a[target="_blank"][href$=".png"], a[target="_blank"][href$=".jpg"], a[target="_blank"][href$=".svg"]')
        if (!link) return
        popupInstance.open(link, e)
    })

    // Setup global timeline positioning function
    window.positionTimeline = () => {
        const archiveWrapperEl = document.querySelector('.archive-timeline')
        const timelineContentSectionEl = document.querySelector('.archive-timeline [data-timeline-section]')
        const timelineWrapperEl = document.querySelector('#horizontal-timeline')

        if (!archiveWrapperEl || !timelineContentSectionEl || !timelineWrapperEl) return

        const archiveWrapperRect = archiveWrapperEl.getBoundingClientRect()
        const timelineContentSectionRect = timelineContentSectionEl.getBoundingClientRect()

        timelineWrapperEl.style.setProperty('left', `${timelineContentSectionRect.left - archiveWrapperRect.left}px`)
        timelineWrapperEl.style.setProperty('right', `${archiveWrapperRect.right - timelineContentSectionRect.right}px`)
    }

    // Position timeline on resize (if it exists)
    window.addEventListener('resize', () => {
        if (window.timelineEl) {
            window.positionTimeline()
        }
    })
})
