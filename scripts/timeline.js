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

/**
 * Get appropriate scroll behavior based on user's motion preferences
 * Respects prefers-reduced-motion setting for accessibility
 * @returns {string} 'auto' if reduced motion is preferred, 'smooth' otherwise
 */
function getScrollBehavior() {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    return prefersReducedMotion ? 'auto' : 'smooth'
}

// ============================================================================
// HorizontalTimeline Custom Element
// ============================================================================

/**
 * <horizontal-timeline>
 * Self-contained Custom Element that renders a horizontal timeline with labels and indicator bars.
 *
 * Features:
 * - Keeps active label centered horizontally when sections intersect viewport
 * - Highlights matching vertical indicator above active label
 * - Syncs URL query (?year=YYYY) for deep-linking
 * - All styles embedded within component
 * - Fully configurable behavior via properties
 *
 * Usage:
 *   const timeline = document.createElement('horizontal-timeline')
 *   timeline.labels = ['2024-21', '2021-19', '2019-18', 'elsewhen']
 *   timeline.hashPrefix = '#archive'  // optional, defaults to '#archive'
 *   timeline.scrollOffset = 24        // optional, defaults to 24
 *   container.appendChild(timeline)
 *   timeline.startIntersectionObserver()
 *
 * Configuration Properties:
 * - labels: Array of timeline section labels (required)
 * - hashPrefix: Hash prefix for URL updates (default: '#archive')
 * - scrollOffset: Pixels from top when scrolling to sections (default: 24)
 * - scrollEndTimeout: Fallback timeout for scrollend event (default: 300)
 * - observerRootMargin: IntersectionObserver root margin (default: '-50% 0% -50% 0%')
 * - observerThresholds: IntersectionObserver thresholds (default: [0, 0.25, 0.5, 0.75, 1])
 */
class HorizontalTimeline extends HTMLElement {
    /**
     * Index of the first "main" indicator (centered above the first label).
     *
     * HTML Structure Explanation:
     * The timeline HTML is generated with a specific pattern of divs representing vertical bars:
     * - 2 decorative divs at the start (left edge indicators)
     * - For each label: 5 divs (pattern: small, centered main bar, small, small, small)
     * - 1 final decorative div at the end (right edge indicator)
     *
     * Index breakdown (0-based):
     * [0] = First decorative div (left edge)
     * [1] = Second decorative div (left edge fade)
     * [2] = First label's leading small bar
     * [3] = First label's CENTERED MAIN BAR ← This is what we need!
     * [4] = First label's trailing small bar
     * ...and so on for subsequent labels
     *
     * This constant (3) points to the centered main bar above the first label,
     * which is marked as "active" when that timeline section is visible.
     * See CSS selector: `#timeline div:nth-child(6n + 4)` for 66.67% height bars.
     */
    static TIMELINE_FIRST_INDICATOR_INDEX = 3

    /**
     * Number of indicator divs per label group.
     *
     * Pattern per label (6 divs total):
     * [0] = Small bar (left padding)
     * [1] = Medium-tall bar (centered - the "main" indicator at nth-child(6n+4))
     * [2] = Small bar
     * [3] = Small bar
     * [4] = Small bar
     * [5] = Small bar (right padding before next group)
     *
     * When calculating which indicator to highlight for a given label index,
     * we use: TIMELINE_FIRST_INDICATOR_INDEX + (labelIndex * TIMELINE_INDICATORS_PER_LABEL)
     *
     * Example for label index 2:
     * 3 + (2 × 6) = 3 + 12 = 15 (the centered bar above the 3rd label)
     *
     * This constant ensures the calculation stays in sync with the HTML generation
     * in the render() method, which creates exactly 6 divs per label with specific
     * data-value attributes for click/hover handling.
     */
    static TIMELINE_INDICATORS_PER_LABEL = 6

    constructor() {
        super()

        // Public configuration (set from script.js)
        this.labels = []
        this.hashPrefix = '#archive'
        this.scrollOffset = 24
        this.scrollEndTimeout = 300
        this.observerRootMargin = '-50% 0% -50% 0%'
        this.observerThresholds = [0, 0.25, 0.5, 0.75, 1]

        // Private state
        this.activeSection = null
        this.isScrolling = false
        this.hasUserScrolled = false    // Track if user has manually scrolled

        // Cached DOM references (lazy-initialized)
        this.timelineContentEl = null
        this.labelEls = null
        this.timelineAllDivEls = null
        this.sectionEls = null
        this.modalArchiveEl = null

        // Observer instance
        this.intersectionObserver = null

        // Resize handler cleanup (registered with centralized ResizeManager)
        this.unregisterResize = null

        // Bound event handlers (for cleanup)
        this.boundHandleMouseLeave = null
        this.boundHandleScrollEnd = null
        this.boundHandleClick = null
        this.boundHandleMouseOver = null
        this.boundHandleMouseOut = null
    }

    static get observedAttributes() {
        return ['labels']
    }

    // ========================================================================
    // Lifecycle Methods
    // ========================================================================

    connectedCallback() {
        this.render()
        this.setupEventHandlers()

        // Notify that timeline is ready for external initialization
        if (this.onReady && typeof this.onReady === 'function') {
            // Use double rAF to ensure layout is complete before callback
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    this.onReady()
                })
            })
        }
    }

    disconnectedCallback() {
        this.destroy()
    }

    // ========================================================================
    // Rendering
    // ========================================================================

    render() {
        if (!this.labels || !this.labels.length) {
            console.warn('HorizontalTimeline: No labels provided')
            return
        }

        this.innerHTML = `
            <div id="timeline-wrapper">
                <div id="timeline-content">
                    <div>
                        <div id="timeline">
                            ${this.labels.map((label, index) => `
                                ${index === 0 ? `<div><span></span></div>` : ''}
                                <div><span></span></div>
                                <div data-value="${label}"><span></span></div>
                                <div data-value="${label}"><span></span></div>
                                <div data-value="${label}"><span></span></div>
                                <div data-value="${label}"><span></span></div>
                                <div data-value="${label}"><span></span></div>
                            `).join('')}
                        </div>
                        <div id="timeline_labels" role="tablist" aria-label="Timeline navigation">
                            ${this.labels.map((label, index) => `<button type="button" role="tab" data-label-for="${label}" aria-label="View ${label} projects" tabindex="${index === 0 ? '0' : '-1'}"><span>${label}<span></span></span></button>`).join('')}
                        </div>
                    </div>
                </div>
            </div>
        `
    }

    // ========================================================================
    // DOM Helpers
    // ========================================================================

    getTimelineContentEl() {
        return this.timelineContentEl ??= this.querySelector('#timeline-content')
    }

    getLabelEls() {
        return this.labelEls ??= Array.from(this.querySelectorAll('[data-label-for]'))
    }

    getTimelineAllDivEls() {
        return this.timelineAllDivEls ??= Array.from(this.querySelectorAll('#timeline div'))
    }

    getSectionEls() {
        return this.sectionEls ??= Array.from(document.querySelectorAll('[data-timeline-section]'))
    }

    getModalArchiveEl() {
        return this.modalArchiveEl ??= document.querySelector('#modal-archive')
    }

    // ========================================================================
    // Scrollable State Management
    // ========================================================================

    updateScrollableClass() {
        const timelineContent = this.getTimelineContentEl()
        if (!timelineContent) return

        const isScrollable = timelineContent.scrollWidth > timelineContent.clientWidth
        this.classList.toggle('timeline-scrollable', isScrollable)
    }

    // ========================================================================
    // Scrolling Utilities
    // ========================================================================

    /**
     * Smoothly scroll horizontally to center a child element within its parent.
     * Returns a Promise that resolves when scrolling completes.
     *
     * @param {HTMLElement} parent - Scrollable container
     * @param {HTMLElement} child - Element to center
     * @returns {Promise<void>}
     */
    scrollParentToChildCenterHorizontal(parent, child) {
        if (!parent || !child) return Promise.resolve()

        return new Promise((resolve) => {
            this.isScrolling = true

            const parentRect = parent.getBoundingClientRect()
            const childRect = child.getBoundingClientRect()
            const scrollAmount = childRect.left - parentRect.left - (parentRect.width - childRect.width) / 2
            const initialScrollLeft = parent.scrollLeft

            // Early exit if at left edge and scrolling left
            if (initialScrollLeft === 0 && scrollAmount < 0) {
                this.isScrolling = false
                resolve()
                return
            }

            const handleScrollEnd = () => {
                if (this.boundHandleScrollEnd) {
                    parent.removeEventListener('scrollend', this.boundHandleScrollEnd)
                    this.boundHandleScrollEnd = null
                }
                this.isScrolling = false
                resolve()
            }

            // Use scrollend event if supported, otherwise fall back to timeout
            if ('onscrollend' in window) {
                this.boundHandleScrollEnd = handleScrollEnd
                parent.addEventListener('scrollend', this.boundHandleScrollEnd, { once: true })
            } else {
                setTimeout(handleScrollEnd, this.scrollEndTimeout)
            }

            parent.scroll({
                left: initialScrollLeft + scrollAmount,
                behavior: getScrollBehavior()
            })
        })
    }

    /**
     * Scroll vertically to reveal a child element with an offset from the top.
     *
     * @param {HTMLElement} parent - Scrollable container
     * @param {HTMLElement} child - Element to scroll into view
     * @param {string} scrollBehavior - 'instant', 'smooth', or null (auto-detect based on preferences)
     */
    scrollParentToChildVertical(parent, child, scrollBehavior = null) {
        if (!parent || !child) return

        const parentRect = parent.getBoundingClientRect()
        const childRect = child.getBoundingClientRect()
        const scrollAmount = childRect.top - parentRect.top - this.scrollOffset

        // Use getScrollBehavior() if no explicit behavior provided
        const behavior = scrollBehavior || getScrollBehavior()

        if (behavior === 'instant' || behavior === 'auto') {
            // Temporarily disable smooth scrolling
            parent.classList.add('scroll-behavior-auto')
            parent.scrollTop += scrollAmount
            requestAnimationFrame(() => {
                parent.classList.remove('scroll-behavior-auto')
            })
        } else {
            parent.scrollBy({
                top: scrollAmount,
                behavior: behavior
            })
        }
    }

    // ========================================================================
    // Event Handlers
    // ========================================================================

    handleLabelClick(labelEl) {
        const section = labelEl.getAttribute('data-label-for')
        const targetElement = document.querySelector(`[data-timeline-section="${section}"]`)
        const modalArchive = this.getModalArchiveEl()

        if (targetElement && modalArchive) {
            this.scrollParentToChildVertical(modalArchive, targetElement)
        }
    }

    handleIntersection(entries) {
        // Find most visible intersecting section
        const intersectingEntries = entries.filter(entry => entry.isIntersecting)
        if (!intersectingEntries.length) return

        const mostVisible = intersectingEntries.reduce((best, current) =>
            current.intersectionRatio > best.intersectionRatio ? current : best
        )

        const targetSection = mostVisible.target.getAttribute('data-timeline-section')
        const targetLabel = this.querySelector(`[data-label-for="${targetSection}"]`)
        if (!targetLabel) return

        // Only update URL if modal is open AND user has a year parameter or has scrolled
        // This prevents automatically adding ?year= when opening modal without params
        if (window.location.hash.includes(this.hashPrefix)) {
            const currentYear = window.location.hash.split('?year=')[1]

            // Only update if:
            // 1. There's already a year parameter that's different, OR
            // 2. User has actively scrolled the modal
            const shouldUpdateHash = (currentYear && currentYear !== targetSection) || this.hasUserScrolled

            if (shouldUpdateHash) {
                const baseHash = window.location.hash.split('?')[0]
                window.history.replaceState(
                    null,
                    '',
                    `${window.location.pathname}${baseHash}?year=${targetSection}`
                )
            }
        }

        // Center the active label
        this.scrollParentToChildCenterHorizontal(this.getTimelineContentEl(), targetLabel)

        // Update active states
        this.setActiveLabel(targetSection)
        this.setActiveIndicator(targetSection)

        // Store active section reference
        this.activeSection = targetSection
    }

    handleMouseLeave() {
        if (this.isScrolling || !this.activeSection) return

        const activeLabel = this.querySelector(`[data-label-for="${this.activeSection}"]`)
        if (activeLabel) {
            this.scrollParentToChildCenterHorizontal(this.getTimelineContentEl(), activeLabel)
        }
    }

    handleResize() {
        // Update scrollable class when dimensions change
        this.updateScrollableClass()
    }

    // ========================================================================
    // State Management
    // ========================================================================

    /**
     * Set the active label, removing active class from all others.
     */
    setActiveLabel(section) {
        const labelEls = this.getLabelEls()
        labelEls.forEach(el => el.classList.remove('active'))

        const activeLabel = this.querySelector(`[data-label-for="${section}"]`)
        if (activeLabel) {
            activeLabel.classList.add('active')
        }
    }

    /**
     * Set the active indicator (vertical bar) above the active label.
     */
    setActiveIndicator(section) {
        const timelineEls = this.getTimelineAllDivEls()
        const labelEls = this.getLabelEls()

        // Clear all active indicators
        timelineEls.forEach(el => el.classList.remove('active'))

        // Find index of active label
        const labelIndex = labelEls.findIndex(el =>
            el.getAttribute('data-label-for') === section
        )

        if (labelIndex === -1) return

        // Calculate indicator position (centered above label)
        const indicatorIndex = HorizontalTimeline.TIMELINE_FIRST_INDICATOR_INDEX +
            (labelIndex === 0 ? 0 : labelIndex * HorizontalTimeline.TIMELINE_INDICATORS_PER_LABEL)

        if (timelineEls[indicatorIndex]) {
            timelineEls[indicatorIndex].classList.add('active')
        }
    }

    // ========================================================================
    // Event Setup
    // ========================================================================

    /**
     * Initialize all event handlers using delegation pattern.
     */
    setupEventHandlers() {
        // Click handling - labels and indicators
        this.boundHandleClick = (event) => {
            // Handle label clicks
            const labelButton = event.target.closest('#timeline_labels [data-label-for]')
            if (labelButton && this.contains(labelButton)) {
                this.handleLabelClick(labelButton)
                return
            }

            // Handle indicator clicks - delegate to corresponding label
            const indicator = event.target.closest('#timeline [data-value]')
            if (indicator && this.contains(indicator)) {
                const value = indicator.getAttribute('data-value')
                const label = this.querySelector(`[data-label-for="${value}"]`)
                if (label) label.click()
            }
        }
        this.addEventListener('click', this.boundHandleClick)

        // Keyboard navigation for timeline labels
        this.boundHandleKeydown = (event) => {
            const labelButton = event.target.closest('#timeline_labels [data-label-for]')
            if (!labelButton || !this.contains(labelButton)) return

            const labelEls = this.getLabelEls()
            const currentIndex = labelEls.indexOf(labelButton)
            let targetIndex = -1
            let handled = false

            switch (event.key) {
                case 'ArrowLeft':
                case 'ArrowUp':
                    targetIndex = Math.max(currentIndex - 1, 0)
                    handled = true
                    break
                case 'ArrowRight':
                case 'ArrowDown':
                    targetIndex = Math.min(currentIndex + 1, labelEls.length - 1)
                    handled = true
                    break
                case 'Home':
                    targetIndex = 0
                    handled = true
                    break
                case 'End':
                    targetIndex = labelEls.length - 1
                    handled = true
                    break
            }

            if (handled && targetIndex !== -1 && targetIndex !== currentIndex) {
                event.preventDefault()

                // Update tabindex
                labelEls.forEach((el, index) => {
                    el.setAttribute('tabindex', index === targetIndex ? '0' : '-1')
                })

                // Focus and click target
                labelEls[targetIndex].focus()
                labelEls[targetIndex].click()
            }
        }
        this.addEventListener('keydown', this.boundHandleKeydown)

        // Hover highlighting - bidirectional between indicators and labels
        this.boundHandleMouseOver = (event) => {
            // Indicator hover -> highlight label
            const indicator = event.target.closest('#timeline [data-value]')
            if (indicator && this.contains(indicator)) {
                const value = indicator.getAttribute('data-value')
                const label = this.querySelector(`[data-label-for="${value}"]`)
                if (label) label.classList.add('highlight')
                return
            }

            // Label hover -> highlight centered indicator
            const label = event.target.closest('#timeline_labels [data-label-for]')
            if (label && this.contains(label)) {
                const value = label.getAttribute('data-label-for')
                const indicator = this.querySelector(`#timeline div:nth-child(6n + 4)[data-value="${value}"]`)
                if (indicator) indicator.classList.add('highlight')
            }
        }

        this.boundHandleMouseOut = (event) => {
            // Remove highlight from indicator-triggered label
            const indicator = event.target.closest('#timeline [data-value]')
            if (indicator && this.contains(indicator)) {
                const value = indicator.getAttribute('data-value')
                const label = this.querySelector(`[data-label-for="${value}"]`)
                if (label) label.classList.remove('highlight')
                return
            }

            // Remove highlight from label-triggered indicator
            const label = event.target.closest('#timeline_labels [data-label-for]')
            if (label && this.contains(label)) {
                const value = label.getAttribute('data-label-for')
                const indicator = this.querySelector(`#timeline div:nth-child(6n + 4)[data-value="${value}"]`)
                if (indicator) indicator.classList.remove('highlight')
            }
        }

        this.addEventListener('mouseover', this.boundHandleMouseOver)
        this.addEventListener('mouseout', this.boundHandleMouseOut)

        // Mouse leave - recenter active label
        this.boundHandleMouseLeave = () => this.handleMouseLeave()
        this.addEventListener('mouseleave', this.boundHandleMouseLeave)

        // Window resize - register with centralized ResizeManager (if available)
        if (typeof ResizeManager !== 'undefined') {
            this.unregisterResize = ResizeManager.register(() => this.handleResize())
        }
    }

    // ========================================================================
    // Intersection Observer
    // ========================================================================

    /**
     * Start observing content sections to track which is most visible.
     * Updates timeline state as user scrolls through sections.
     *
     * Configuration:
     * - rootMargin centers the detection zone vertically
     * - Multiple thresholds provide granular intersection ratio updates
     */
    startIntersectionObserver() {
        if (this.intersectionObserver) {
            console.warn('Timeline: Observer already running')
            return
        }

        const sectionEls = this.getSectionEls()
        if (!sectionEls.length) {
            console.warn('Timeline: No sections found to observe')
            return
        }

        this.intersectionObserver = new IntersectionObserver(
            entries => this.handleIntersection(entries),
            {
                rootMargin: this.observerRootMargin,
                threshold: this.observerThresholds
            }
        )

        sectionEls.forEach(section => this.intersectionObserver.observe(section))
    }

    /**
     * Stop observing sections and clean up observer instance.
     */
    stopIntersectionObserver() {
        if (!this.intersectionObserver) return

        this.intersectionObserver.disconnect()
        this.intersectionObserver = null
    }

    // ========================================================================
    // Cleanup
    // ========================================================================

    /**
     * Clean up all event listeners and observers.
     * Called automatically when element is removed from DOM.
     */
    destroy() {
        // Stop intersection observer
        this.stopIntersectionObserver()

        // Remove event listeners
        const listeners = [
            { target: this, type: 'click', handler: 'boundHandleClick' },
            { target: this, type: 'keydown', handler: 'boundHandleKeydown' },
            { target: this, type: 'mouseover', handler: 'boundHandleMouseOver' },
            { target: this, type: 'mouseout', handler: 'boundHandleMouseOut' },
            { target: this, type: 'mouseleave', handler: 'boundHandleMouseLeave' }
        ]

        listeners.forEach(({ target, type, handler }) => {
            if (this[handler]) {
                target.removeEventListener(type, this[handler])
                this[handler] = null
            }
        })

        // Unregister from centralized resize manager
        if (this.unregisterResize) {
            this.unregisterResize()
            this.unregisterResize = null
        }

        // Clean up scroll end listener if exists
        if (this.boundHandleScrollEnd) {
            const timelineContent = this.getTimelineContentEl()
            if (timelineContent) {
                timelineContent.removeEventListener('scrollend', this.boundHandleScrollEnd)
            }
            this.boundHandleScrollEnd = null
        }

        // Clear cached DOM references
        this.timelineContentEl = null
        this.labelEls = null
        this.timelineAllDivEls = null
        this.sectionEls = null
        this.modalArchiveEl = null

        // Clear state
        this.activeSection = null
        this.isScrolling = false
    }
}

// ============================================================================
// Register Custom Element
// ============================================================================

customElements.define('horizontal-timeline', HorizontalTimeline)
