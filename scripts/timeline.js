/*!
 * Personal website of Štěpán Jákl
 * https://stepanjakl.github.io
 *
 * Copyright © 2025 Štěpán Jákl
 * Released under the MIT license
 * https://github.com/stepanjakl/stepanjakl.github.io/blob/main/LICENSE
 */

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
        this.isScrolling = false        // Cached DOM references (lazy-initialized)
        this.timelineContentEl = null
        this.labelEls = null
        this.timelineAllDivEls = null
        this.sectionEls = null
        this.modalArchiveEl = null

        // Observer instance
        this.intersectionObserver = null

        // Bound event handlers (for cleanup)
        this.boundHandleResize = null
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
            <style>
                /*
                * Modal - Archive
                */

                /* Host element */
                horizontal-timeline {
                    display: flex;
                    justify-content: center;
                    transition: margin var(--animate-out-segment, 150ms) var(--ease-in-quad, ease-in);
                    margin: 0 3rem;
                }

                horizontal-timeline:hover {
                    transition: margin var(--animate-in-segment, 150ms) var(--ease-out-quad, ease-out);
                    margin: 0 1rem;
                }

                horizontal-timeline::before {
                    content: '';
                    position: absolute;
                    inset: -0.5rem;
                }

                /* Wrapper */
                #timeline-wrapper {
                    transition:
                        border-radius var(--animate-out-segment, 150ms) var(--ease-in-quad, ease-in),
                        transform var(--animate-out-segment, 150ms) var(--ease-in-quad, ease-in);
                    position: relative;
                    width: auto;
                    max-width: 100%;
                    border-radius: 0.75rem;
                    background-color: rgba(0, 91, 102, 0.95);
                    overflow: hidden;
                    contain: content;
                }

                horizontal-timeline:hover #timeline-wrapper {
                    transition:
                        border-radius var(--animate-in-segment, 150ms) var(--ease-out-quad, ease-out),
                        transform var(--animate-in-segment, 150ms) var(--ease-out-quad, ease-out);
                    border-radius: 1.125rem;
                    transform: translateY(0.5625rem);
                }

                /* Scrollable content area */
                #timeline-content {
                    transition: padding var(--animate-out-segment, 150ms) var(--ease-in-quad, ease-in);
                    overflow-x: scroll;
                    overflow-y: hidden;
                    scroll-behavior: auto;
                    white-space: nowrap;
                    scrollbar-width: none;
                    -ms-overflow-style: none;
                    padding: 0.5rem 1.5rem 0.25rem 1.5rem;
                    mask-image: linear-gradient(
                        90deg,
                        rgba(0, 0, 0, 0) 0%,
                        rgba(0, 0, 0, 1) var(--segment, 1.5rem),
                        rgba(0, 0, 0, 1) calc(100% - var(--segment, 1.5rem)),
                        rgba(0, 0, 0, 0) 100%
                    );
                }

                #timeline-content::-webkit-scrollbar {
                    display: none;
                }

                horizontal-timeline.timeline-scrollable #timeline-content {
                    cursor: grab;
                }

                horizontal-timeline:hover #timeline-content {
                    transition: padding var(--animate-in-segment, 150ms) var(--ease-out-quad, ease-out);
                    padding: 0.875rem 5.5rem 0.625rem 5.5rem;
                }

                #timeline-content > div {
                    display: inline-flex;
                    flex-direction: column;
                }

                /* Timeline bar */
                #timeline {
                    display: flex;
                    transition: height var(--animate-out-segment, 150ms) var(--ease-in-quad, ease-in);
                    height: 1.125rem;
                }

                horizontal-timeline:hover #timeline {
                    transition: height var(--animate-in-segment, 150ms) var(--ease-out-quad, ease-out);
                    height: 1.75rem;
                }

                /* Timeline indicators (vertical bars) */
                #timeline div {
                    display: flex;
                    align-items: end;
                    padding: 0 0.5rem;
                }

                #timeline div[data-value] {
                    cursor: pointer;
                }

                #timeline div span {
                    transition:
                        background-color 100ms linear,
                        height 100ms var(--ease-in-quad, ease-in);
                    background-color: rgba(255, 255, 255, 0.45);
                    width: max(1.5px, 0.09375rem);
                    height: 33.33%;
                    border-radius: max(0.5px, 0.09375rem);
                }

                /* Pattern-based indicator heights */
                #timeline div:nth-child(6n + 4) span {
                    height: 66.67%;
                }

                #timeline div:nth-child(6n + 3) span,
                #timeline div:nth-child(6n + 5) span {
                    height: 44.44%;
                }

                #timeline div:nth-child(2) span,
                #timeline div:nth-last-child(2) span {
                    background-color: rgba(255, 255, 255, 0.35);
                }

                #timeline div:first-child span,
                #timeline div:last-child span {
                    background-color: rgba(255, 255, 255, 0.25);
                }

                /* Hover states - indicator and neighbors */
                #timeline div:hover span,
                #timeline div.highlight span {
                    transition:
                        background-color 100ms linear,
                        height 100ms var(--ease-out-quad, ease-out) !important;
                    height: 100% !important;
                }

                #timeline div:has(+ div:hover) span,
                #timeline div:hover + div span,
                #timeline div:has(+ div.highlight) span,
                #timeline div.highlight + div span {
                    transition:
                        background-color 100ms linear,
                        height 100ms var(--ease-out-quad, ease-out) !important;
                    height: 77.78% !important;
                }

                #timeline div:has(+ div + div:hover) span,
                #timeline div:hover + div + div span,
                #timeline div:has(+ div + div.highlight) span,
                #timeline div.highlight + div + div span {
                    transition:
                        background-color 100ms linear,
                        height 100ms var(--ease-out-quad, ease-out) !important;
                    height: 55.56% !important;
                }

                /* Active state - indicator and ripple effect */
                #timeline div.active span {
                    transition:
                        background-color 100ms linear,
                        height 100ms var(--ease-out-quad, ease-out);
                    background-color: rgba(255, 255, 255, 0.75);
                    height: 100%;
                }

                #timeline div.active + div span,
                #timeline div:has(+ div.active) span {
                    transition:
                        background-color 100ms linear 100ms,
                        height 100ms var(--ease-out-quad, ease-out);
                    background-color: rgba(255, 255, 255, 0.7);
                    height: 77.78%;
                }

                #timeline div.active + div + div span,
                #timeline div:has(+ div + div.active) span {
                    transition:
                        background-color 100ms linear 200ms,
                        height 100ms var(--ease-out-quad, ease-out);
                    background-color: rgba(255, 255, 255, 0.65);
                    height: 55.56%;
                }

                #timeline div.active + div + div + div span,
                #timeline div:has(+ div + div + div.active) span {
                    transition:
                        background-color 100ms linear 300ms,
                        height 100ms var(--ease-out-quad, ease-out);
                    background-color: rgba(255, 255, 255, 0.6);
                }

                #timeline div.active + div + div + div + div span,
                #timeline div:has(+ div + div + div + div.active) span {
                    transition:
                        background-color 100ms linear 400ms,
                        height 100ms var(--ease-out-quad, ease-out);
                    background-color: rgba(255, 255, 255, 0.55);
                }

                #timeline div.active + div + div + div + div + div span,
                #timeline div:has(+ div + div + div + div + div.active) span {
                    transition:
                        background-color 100ms linear 500ms,
                        height 100ms var(--ease-out-quad, ease-out);
                    background-color: rgba(255, 255, 255, 0.5);
                }

                /* Labels */
                #timeline_labels {
                    display: grid;
                    grid-auto-flow: column;
                    grid-auto-columns: 1fr;
                    padding: 0 0.5rem;
                }

                #timeline_labels button {
                    transition: padding var(--animate-out-segment, 150ms) var(--ease-in-quad, ease-in);
                    position: relative;
                    display: inline-flex;
                    justify-content: center;
                    cursor: pointer;
                    padding-top: 0.5rem;
                    border: none;
                    background: none;
                }

                horizontal-timeline:hover #timeline_labels button {
                    transition: padding var(--animate-in-segment, 150ms) var(--ease-out-quad, ease-out);
                    padding-top: 0.875rem;
                }

                #timeline_labels button > span {
                    position: relative;
                    transition: color 100ms linear;
                    text-align: center;
                    color: var(--text-2, #999);
                    padding: 0.25rem 0.3125rem 0.25rem 0.4375rem;
                    font-family: 'Chakra Petch', monospace;
                    font-weight: 600;
                    font-size: 0.80356875rem;
                    line-height: 0.875rem;
                    letter-spacing: 0.125rem;
                    text-transform: uppercase;
                }

                #timeline_labels button > span::before {
                    content: "";
                    margin-bottom: -0.1864em;
                    display: table;
                }

                #timeline_labels button > span::after {
                    content: "";
                    margin-top: -0.2024em;
                    display: table;
                }

                #timeline_labels button:last-child > span {
                    font-size: 0.75892875rem;
                    line-height: 0.84375rem;
                }

                #timeline_labels button:last-child > span::before {
                    margin-bottom: -0.1986em;
                }

                #timeline_labels button:last-child > span::after {
                    margin-top: -0.21455em;
                }

                #timeline_labels button.active span {
                    transition: color 100ms linear;
                    color: var(--text-1, #fff);
                }

                /* Label background pill */
                #timeline_labels button > span > span {
                    transition:
                        opacity 100ms linear,
                        inset 100ms var(--ease-in-quad, ease-in);
                    content: "";
                    position: absolute;
                    inset: 0 0.1875rem 0.09375rem 0.1875rem;
                    opacity: 0;
                    background-color: rgba(255, 255, 255, 0.15);
                    border-radius: 999rem;
                }

                #timeline_labels button.active > span > span,
                #timeline_labels button.highlight > span > span,
                #timeline_labels button:hover > span > span,
                #timeline_labels button:focus > span > span {
                    transition:
                        opacity 100ms linear,
                        inset 100ms var(--ease-out-quad, ease-out);
                    opacity: 1;
                    inset: -0.09375rem 0 0 0;
                }

                /* Responsive adjustments */
                @media (min-width: 60rem) {
                    horizontal-timeline {
                        margin: 0 6rem;
                    }

                    horizontal-timeline:hover {
                        margin: 0 2rem;
                    }
                }
            </style>

            <noscript>
                <style>
                    /* No-JS: Expand hit area for anchor-based navigation */
                    #timeline_labels button::after {
                        content: "";
                        position: absolute;
                        inset: -1.875rem -0.3125rem -0.3125rem -0.3125rem;
                    }
                </style>
            </noscript>

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

        this.updateScrollableClass()
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
                behavior: 'smooth'
            })
        })
    }

    /**
     * Scroll vertically to reveal a child element with an offset from the top.
     *
     * @param {HTMLElement} parent - Scrollable container
     * @param {HTMLElement} child - Element to scroll into view
     * @param {string} scrollBehavior - 'instant' or 'smooth' (default)
     */
    scrollParentToChildVertical(parent, child, scrollBehavior = 'smooth') {
        if (!parent || !child) return

        const parentRect = parent.getBoundingClientRect()
        const childRect = child.getBoundingClientRect()
        const scrollAmount = childRect.top - parentRect.top - this.scrollOffset

        if (scrollBehavior === 'instant') {
            // Temporarily disable smooth scrolling
            parent.classList.add('scroll-behavior-auto')
            parent.scrollTop += scrollAmount
            requestAnimationFrame(() => {
                parent.classList.remove('scroll-behavior-auto')
            })
        } else {
            parent.scrollBy({
                top: scrollAmount,
                behavior: 'smooth'
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

        // Update URL query parameter for deep-linking
        if (window.location.hash.includes(this.hashPrefix)) {
            const currentYear = window.location.hash.split('?year=')[1]
            if (currentYear !== targetSection) {
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

        // Store for persistence
        this.activeSection = targetSection
        localStorage.setItem('archiveYear', targetSection)
    }

    handleMouseLeave() {
        if (this.isScrolling || !this.activeSection) return

        const activeLabel = this.querySelector(`[data-label-for="${this.activeSection}"]`)
        if (activeLabel) {
            this.scrollParentToChildCenterHorizontal(this.getTimelineContentEl(), activeLabel)
        }
    }

    handleResize() {
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

        // Window resize - update scrollable state
        this.boundHandleResize = () => this.handleResize()
        window.addEventListener('resize', this.boundHandleResize)
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
            { target: this, type: 'mouseleave', handler: 'boundHandleMouseLeave' },
            { target: window, type: 'resize', handler: 'boundHandleResize' }
        ]

        listeners.forEach(({ target, type, handler }) => {
            if (this[handler]) {
                target.removeEventListener(type, this[handler])
                this[handler] = null
            }
        })

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
