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
 * Custom Element that renders a horizontal timeline with labels and a bar of vertical lines.
 * - Keeps the active label centered horizontally when sections intersect the viewport.
 * - Highlights the matching vertical indicator above the active label.
 * - Syncs the URL query (?year=YYYY) when inside the archive modal.
 */
class HorizontalTimeline extends HTMLElement {
    constructor() {
        super()

        // State properties
        this.labels = []
        this.activeSection = null
        this.isScrolling = false

        // DOM element caches
        this.timelineContentEl = null
        this.labelEls = null
        this.timelineAllDivEls = null
        this.sectionEls = null
        this.modalArchiveEl = null

        // Observer instance
        this.intersectionObserver = null

        // Bound event handlers
        this.boundHandleResize = null
        this.boundHandleMouseLeave = null
        this.boundHandleScrollEnd = null

        // Constants
        this.TIMELINE_FIRST_INDICATOR_INDEX = 3
        this.TIMELINE_INDICATORS_PER_LABEL = 6
        this.HASH_PREFIX = '#archive'
        this.SCROLLABLE_CLASS = 'timeline-scrollable'
        this.ACTIVE_CLASS = 'active'
        this.HIGHLIGHT_CLASS = 'highlight'
        this.SCROLL_BEHAVIOR_AUTO_CLASS = 'scroll-behavior-auto'
        this.SCROLL_END_TIMEOUT = 300
        this.SCROLL_OFFSET = 24
        this.OBSERVER_ROOT_MARGIN = '-50% 0% -50% 0%'
        this.OBSERVER_THRESHOLDS = [0, 0.25, 0.5, 0.75, 1]
    }

    static get observedAttributes() {
        return ['labels']
    }

    // ========================================================================
    // Lifecycle Methods
    // ========================================================================

    connectedCallback() {
        this.render()
        this.initializeTimeline()
        this.setupHighlighting()
    }

    disconnectedCallback() {
        this.destroy()
    }

    // ========================================================================
    // Rendering
    // ========================================================================

    render() {
        this.innerHTML = `
            <style>
                horizontal-timeline {
                    display: flex;
                    justify-content: center;
                    transition: margin var(--animate-out-segment) var(--ease-in-quad);
                    margin: 0 3rem;
                }

                horizontal-timeline:hover {
                    transition: margin var(--animate-in-segment) var(--ease-out-quad);
                    margin: 0 1rem;
                }

                @media (min-width: 60rem) {
                    horizontal-timeline {
                        margin: 0 6rem;
                    }

                    horizontal-timeline:hover {
                        margin: 0 2rem;
                    }
                }

                horizontal-timeline::before {
                    content: '';
                    position: absolute;
                    inset: -0.5rem;
                }

                #timeline-wrapper {
                    transition: border-radius var(--animate-out-segment) var(--ease-in-quad), transform var(--animate-out-segment) var(--ease-in-quad);
                    position: relative;
                    width: auto;
                    max-width: 100%;
                    border-radius: 0.75rem;
                    background-color: rgba(0, 91, 102, 0.95); /* 210, 100, 35 */
                    /* background-image: radial-gradient(circle at 0.09375rem 0.09375rem, #00768450 max(1px, 0.0625rem), transparent max(1px, 0.0625rem)), radial-gradient(circle at 0.09375rem 0.09375rem, #00768450 max(1px, 0.0625rem), transparent max(1px, 0.0625rem));
                    background-size: 0.875rem 0.875rem;
                    background-position: 0.1875rem 0.0625rem, 0.625rem 0.5rem;
                    background-repeat: repeat;
                    background-origin: content-box; */
                    overflow: clip;
                    contain: content;
                    /* backdrop-filter: blur(0.375rem);
                    -webkit-backdrop-filter: blur(0.375rem); */
                }

                horizontal-timeline:hover #timeline-wrapper {
                    transition: border-radius var(--animate-in-segment) var(--ease-out-quad), transform var(--animate-in-segment) var(--ease-out-quad);
                    border-radius: 1.125rem;
                    transform: translateY(calc((0.375rem + 0.375rem + 0.375rem) / 2)); // derived from #timeline-content padding values
                }

                #timeline-content {
                    transition: padding var(--animate-out-segment) var(--ease-in-quad);
                    overflow-x: scroll;
                    overflow-y: hidden;
                    scroll-behavior: auto;
                    white-space: nowrap;
                    scrollbar-width: none;
                    -ms-overflow-style: none;
                    padding: 0.5rem 1.5rem 0.25rem 1.5rem;
                    mask-image: linear-gradient(90deg, rgba(0, 0, 0, 0) 0%, rgba(0, 0, 0, 1) var(--segment), rgba(0, 0, 0, 1) calc(100% - var(--segment)), rgba(0, 0, 0, 0) 100%);
                }

                horizontal-timeline.timeline-scrollable #timeline-content {
                    cursor: grab;
                }

                #timeline-content::-webkit-scrollbar {
                    display: none;
                }

                horizontal-timeline:hover #timeline-content {
                    transition: padding var(--animate-in-segment) var(--ease-out-quad);
                    padding: calc(0.5rem + 0.375rem) calc(1.5rem + 4rem) calc(0.25rem + 0.375rem) calc(1.5rem + 4rem);
                }

                #timeline-content > div {
                    transition: row-gap var(--animate-out-segment) var(--ease-in-quad);
                }

                horizontal-timeline:hover #timeline-content > div {
                    transition: row-gap var(--animate-in-segment) var(--ease-out-quad);
                }

                #timeline {
                    transition: height var(--animate-out-segment) var(--ease-in-quad);
                    height: 1.125rem;
                }

                horizontal-timeline:hover #timeline {
                    transition: height var(--animate-in-segment) var(--ease-out-quad);
                    height: 1.75rem;
                }

                #timeline div {
                    display: flex;
                    align-items: end;
                    padding: 0 0.5rem;
                }

                #timeline div[data-value] {
                    cursor: pointer;
                }

                #timeline-content #timeline div span {
                    transition: background-color var(--animate-out-segment-2\\/3) linear, height var(--animate-out-segment-2\\/3) var(--ease-in-quad);
                    background-color: rgba(255, 255, 255, 0.45);
                    width: max(1.5px, 0.09375rem);
                    height: calc((6/18) * 100%);
                    border-radius: max(0.5px, 0.09375rem);
                }

                #timeline-content #timeline div:hover span,
                #timeline-content #timeline div.highlight span {
                    transition: background-color var(--animate-in-segment-2\\/3) linear, height var(--animate-in-segment-2\\/3) var(--ease-out-quad) !important;
                    height: 100% !important;
                }

                #timeline-content #timeline div:has(+ div:hover) span,
                #timeline-content #timeline div:hover + div span,
                #timeline-content #timeline div:has(+ div.highlight) span,
                #timeline-content #timeline div.highlight + div span {
                    transition: background-color var(--animate-in-segment-2\\/3) linear, height var(--animate-in-segment-2\\/3) var(--ease-out-quad) !important;
                    height: calc((14/18) * 100%) !important;
                }

                #timeline-content #timeline div:has(+ div + div:hover) span,
                #timeline-content #timeline div:hover + div + div span,
                #timeline-content #timeline div:has(+ div + div.highlight) span,
                #timeline-content #timeline div.highlight + div + div span {
                    transition: background-color var(--animate-in-segment-2\\/3) linear, height var(--animate-in-segment-2\\/3) var(--ease-out-quad) !important;
                    height: calc((10/18) * 100%) !important;
                }

                #timeline-content #timeline div:nth-child(6n + 4) span {
                    height: calc((12/18) * 100%);
                }

                #timeline-content #timeline div:nth-child(6n + 3) span, #timeline-content #timeline div:nth-child(6n + 5) span {
                    height: calc((8/18) * 100%);
                }

                #timeline-content #timeline div:nth-child(2) span, #timeline-content #timeline div:nth-last-child(2) span {
                    background-color: rgba(255, 255, 255, 0.35);
                }

                #timeline-content #timeline div:first-child span, #timeline-content #timeline div:last-child span {
                    background-color: rgba(255, 255, 255, 0.25);
                }

                #timeline-content #timeline div.active span {
                    transition: background-color var(--animate-in-segment-2\\/3) linear, height var(--animate-in-segment-2\\/3) var(--ease-out-quad);
                    background-color: rgba(255, 255, 255, 0.75);
                    height: 100%;
                }

                #timeline-content #timeline div.active + div span,
                #timeline-content #timeline div:has(+ div.active) span {
                    transition: background-color var(--animate-in-segment-2\\/3) linear var(--animate-in-segment-2\\/3), height var(--animate-in-segment-2\\/3) var(--ease-out-quad);
                    background-color: rgba(255, 255, 255, 0.7);
                    height: calc((14/18) * 100%);
                }

                #timeline-content #timeline div.active + div + div span,
                #timeline-content #timeline div:has(+ div + div.active) span {
                    transition: background-color var(--animate-in-segment-2\\/3) linear calc(2 * var(--animate-in-segment-2\\/3)), height var(--animate-in-segment-2\\/3) var(--ease-out-quad);
                    background-color: rgba(255, 255, 255, 0.65);
                    height: calc((10/18) * 100%);
                }

                #timeline-content #timeline div.active + div + div + div span,
                #timeline-content #timeline div:has(+ div + div + div.active) span {
                    transition: background-color var(--animate-in-segment-2\\/3) linear calc(3 * var(--animate-in-segment-2\\/3)), height var(--animate-in-segment-2\\/3) var(--ease-out-quad);
                    background-color: rgba(255, 255, 255, 0.6);
                }

                #timeline-content #timeline div.active + div + div + div + div span,
                #timeline-content #timeline div:has(+ div + div + div + div.active) span {
                    transition: background-color var(--animate-in-segment-2\\/3) linear calc(4 * var(--animate-in-segment-2\\/3)), height var(--animate-in-segment-2\\/3) var(--ease-out-quad);
                    background-color: rgba(255, 255, 255, 0.55);
                }

                #timeline-content #timeline div.active + div + div + div + div + div span,
                #timeline-content #timeline div:has(+ div + div + div + div + div.active) span {
                    transition: background-color var(--animate-in-segment-2\\/3) linear calc(5 * var(--animate-in-segment-2\\/3)), height var(--animate-in-segment-2\\/3) var(--ease-out-quad);
                    background-color: rgba(255, 255, 255, 0.5);
                }

                #timeline_labels {
                    display: grid;
                    grid-auto-flow: column;
                    grid-auto-columns: 1fr;
                    padding: 0 0.5rem;
                }

                #timeline_labels button {
                    transition: padding var(--animate-out-segment) var(--ease-in-quad);
                    position: relative;
                    display: inline-flex;
                    justify-content: center;
                    cursor: pointer;
                    padding-top: 0.5rem;
                }

                horizontal-timeline:hover #timeline_labels button {
                    row-gap var(--animate-in-segment) var(--ease-out-quad);
                    padding-top: calc(0.5rem + 0.375rem);
                }

                /* #timeline_labels button:not(:last-child)::before {
                    content: "✦";
                    position: absolute;
                    right: 0;
                    color: var(--text-2);
                    text-align: center;
                    font-family: 'Bai Jamjuree', sans-serif;
                    font-size: 0.6875rem;
                    line-height: 1.063125rem;
                    transform: translateX(50%);
                } */

                #timeline_labels button>span {
                    position: relative;
                    transition: color var(--animate-out-segment-2\\/3) linear;
                    text-align: center;
                    color: var(--text-2);
                    padding: 0.25rem 0.3125rem 0.25rem 0.4375rem;
                    font-family: 'Chakra Petch', monospace;
                    font-weight: 600;
                    font-size: 0.80356875rem;
                    line-height: 0.875rem;
                    letter-spacing: 0.125rem;
                    text-transform: uppercase;
                }

                #timeline_labels button>span::before {
                    content: "";
                    margin-bottom: -0.1864em;
                    display: table;
                }

                #timeline_labels button>span::after {
                    content: "";
                    margin-top: -0.2024em;
                    display: table;
                }

                #timeline_labels button:last-child>span {
                    font-size: 0.75892875rem;
                    line-height: 0.84375rem;
                }

                #timeline_labels button:last-child>span::before {
                    content: "";
                    margin-bottom: -0.1986em;
                    display: table;
                }

                #timeline_labels button:last-child>span::after {
                    content: "";
                    margin-top: -0.21455em;
                    display: table;
                }

                #timeline_labels button.active span {
                    transition: color var(--animate-in-segment-2\\/3) linear;
                    color: var(--text-1);
                }

                #timeline_labels button>span>span {
                    transition: opacity var(--animate-out-segment-2\\/3) linear, inset var(--animate-out-segment-2\\/3) var(--ease-in-quad);
                    content: "";
                    position: absolute;
                    inset: 0 0.1875rem 0.09375rem 0.1875rem;
                    opacity: 0;
                    background-color: rgba(255, 255, 255, 0.15);
                    border-radius: 999rem;
                }

                #timeline_labels button.active>span>span {
                    transition: opacity var(--animate-in-segment-2\\/3) linear, inset var(--animate-in-segment-2\\/3) var(--ease-out-quad);
                    opacity: 1;
                    inset: -0.09375rem 0 0 0;
                }

                #timeline_labels button.highlight>span>span,
                #timeline_labels button:hover>span>span, #timeline_labels button:focus>span>span {
                    transition: opacity var(--animate-in-segment-2\\/3) linear, inset var(--animate-in-segment-2\\/3) var(--ease-out-quad);
                    opacity: 1;
                    inset: -0.09375rem 0 0 0;
                }
            </style>

            <noscript>
                <style>
                    #timeline_labels button::after {
                        content: "";
                        position: absolute;
                        inset: -1.875rem -0.3125rem -0.3125rem -0.3125rem;
                    }
                </style>
            </noscript>

            <div id="timeline-wrapper">
                <div id="timeline-content">
                    <div class="inline-flex flex-col">
                        <div id="timeline" class="flex">
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
                        <div id="timeline_labels">
                            ${this.labels.map(label => `<button type="button" data-label-for="${label}"><span>${label}<span></span></span></button>`).join('')}
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
        return this.modalArchiveEl ??= document.querySelector('#modal_archive')
    }

    // ========================================================================
    // Scrollable State Management
    // ========================================================================

    updateScrollableClass() {
        const timelineContent = this.getTimelineContentEl()
        if (!timelineContent) return

        const isScrollable = timelineContent.scrollWidth > timelineContent.clientWidth

        if (isScrollable) {
            this.classList.add(this.SCROLLABLE_CLASS)
        } else {
            this.classList.remove(this.SCROLLABLE_CLASS)
        }
    }

    // ========================================================================
    // Scrolling Utilities
    // ========================================================================

    /**
     * Smoothly scroll a horizontally scrollable parent so that the child is centered.
     * Resolves when native 'scrollend' fires or after a small timeout fallback.
     */
    scrollParentToChildCenterHorizontal(parent, child) {
        if (!parent || !child) return Promise.resolve()

        return new Promise((resolve) => {
            this.isScrolling = true

            const parentRect = parent.getBoundingClientRect()
            const childRect = child.getBoundingClientRect()
            const scrollAmount = childRect.left - parentRect.left - (parentRect.width - childRect.width) / 2
            const initialScrollLeft = parent.scrollLeft

            // Early exit if already at left edge and trying to scroll left
            if (initialScrollLeft === 0 && scrollAmount < 0) {
                this.isScrolling = false
                resolve()
                return
            }

            const isScrollEndSupported = 'onscrollend' in window

            const handleScrollEnd = () => {
                if (this.boundHandleScrollEnd) {
                    parent.removeEventListener('scrollend', this.boundHandleScrollEnd)
                    this.boundHandleScrollEnd = null
                }
                this.isScrolling = false
                resolve()
            }

            if (isScrollEndSupported) {
                this.boundHandleScrollEnd = handleScrollEnd
                parent.addEventListener('scrollend', this.boundHandleScrollEnd, { once: true })
            }

            parent.scroll({
                left: initialScrollLeft + scrollAmount,
                behavior: 'smooth'
            })

            // Fallback timeout for browsers without 'scrollend' event
            if (!isScrollEndSupported) {
                setTimeout(handleScrollEnd, this.SCROLL_END_TIMEOUT)
            }
        })
    }

    /**
     * Vertically scroll a container so that the target child is comfortably visible near the top.
     * If scrollBehavior === 'instant', temporarily force instant scrolling to avoid animation.
     */
    scrollParentToChildVertical(parent, child, scrollBehavior) {
        if (!parent || !child) return

        if (scrollBehavior === 'instant') {
            parent.classList.add(this.SCROLL_BEHAVIOR_AUTO_CLASS)
        }

        const parentRect = parent.getBoundingClientRect()
        const childRect = child.getBoundingClientRect()
        const scrollAmount = childRect.top - parentRect.top - this.SCROLL_OFFSET

        if (scrollBehavior === 'instant') {
            parent.scrollTop += scrollAmount
            requestAnimationFrame(() => {
                parent.classList.remove(this.SCROLL_BEHAVIOR_AUTO_CLASS)
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
        // Find the most intersecting entry (highest intersectionRatio)
        const intersectingEntries = entries.filter(entry => entry.isIntersecting)
        if (intersectingEntries.length === 0) return

        const mostIntersecting = intersectingEntries.reduce((best, current) =>
            current.intersectionRatio > best.intersectionRatio ? current : best
        )

        const targetSection = mostIntersecting.target.getAttribute('data-timeline-section')
        const targetLabelEl = this.querySelector(`[data-label-for="${targetSection}"]`)
        if (!targetLabelEl) return

        const timelineEls = this.getTimelineAllDivEls()
        const labelEls = this.getLabelEls()
        const timelineContent = this.getTimelineContentEl()

        // Update URL query param to reflect active year
        if (window.location.hash.includes(this.HASH_PREFIX)) {
            const currentYear = window.location.hash.split('?year=')[1]
            if (currentYear !== targetSection) {
                const hashWithoutParams = window.location.hash.split('?')[0]
                window.history.replaceState(
                    {},
                    '',
                    `${window.location.pathname}${hashWithoutParams}?year=${targetSection}`
                )
            }
        }

        this.scrollParentToChildCenterHorizontal(timelineContent, targetLabelEl)

        // Activate the appropriate label
        for (let i = 0; i < labelEls.length; i++) {
            labelEls[i].classList.remove(this.ACTIVE_CLASS)
        }
        targetLabelEl.classList.add(this.ACTIVE_CLASS)

        // Activate the corresponding vertical indicator in the timeline bar
        const labelIndex = labelEls.findIndex((el) => el.getAttribute('data-label-for') === targetSection)

        for (let i = 0; i < timelineEls.length; i++) {
            timelineEls[i].classList.remove(this.ACTIVE_CLASS)
        }

        // Target the centered timeline indicator (vertical line) above the active label.
        const indicatorIdx = this.TIMELINE_FIRST_INDICATOR_INDEX + (labelIndex === 0 ? 0 : labelIndex * this.TIMELINE_INDICATORS_PER_LABEL)
        if (timelineEls[indicatorIdx]) {
            timelineEls[indicatorIdx].classList.add(this.ACTIVE_CLASS)
        }

        this.activeSection = targetSection
        localStorage.setItem('archiveYear', targetSection)
    }

    handleMouseLeave() {
        if (this.isScrolling) return

        const timelineContent = this.getTimelineContentEl()
        const activeLabel = this.querySelector(`[data-label-for="${this.activeSection}"]`)

        this.scrollParentToChildCenterHorizontal(timelineContent, activeLabel)
    }

    handleResize() {
        this.updateScrollableClass()
    }

    // ========================================================================
    // Initialization
    // ========================================================================

    initializeTimeline() {
        // Cache DOM references
        this.getTimelineContentEl()
        this.getLabelEls()
        this.getTimelineAllDivEls()
        this.getSectionEls()

        // Setup event listeners
        this.setupLabelClickHandlers()
        this.setupDeepLinkHandling()
        this.setupMouseLeaveHandler()
        this.setupResizeHandler()
    }

    setupLabelClickHandlers() {
        const labelEls = this.getLabelEls()

        for (let i = 0; i < labelEls.length; i++) {
            const labelEl = labelEls[i]
            labelEl.addEventListener('click', () => this.handleLabelClick(labelEl))
        }
    }

    setupDeepLinkHandling() {
        // Handle deep-link with ?year= parameter on page load
        if (!window.location.hash.includes('?year=')) return

        const yearParam = window.location.hash.split('?year=')[1]
        const modalArchive = this.getModalArchiveEl()

        window.history.pushState({}, '', `${window.location.pathname}${this.HASH_PREFIX}`)

        requestAnimationFrame(() => {
            window.history.replaceState(
                {},
                '',
                `${window.location.pathname}${this.HASH_PREFIX}?year=${yearParam}`
            )

            if (typeof openDialog === 'function') {
                const menuLinkArchive = document.querySelector('#menu_link_archive')
                openDialog('modal_archive', menuLinkArchive)
            }

            const targetElement = document.querySelector(`[data-timeline-section="${yearParam}"]`)
            if (targetElement && modalArchive) {
                this.scrollParentToChildVertical(modalArchive, targetElement, 'instant')
            }
        })
    }

    setupMouseLeaveHandler() {
        this.boundHandleMouseLeave = () => this.handleMouseLeave()
        this.addEventListener('mouseleave', this.boundHandleMouseLeave)
    }

    setupResizeHandler() {
        this.boundHandleResize = () => this.handleResize()
        window.addEventListener('resize', this.boundHandleResize)
    }

    // ========================================================================
    // Highlighting
    // ========================================================================

    setupHighlighting() {
        this.setupLabelToIndicatorHighlighting()
        this.setupIndicatorToLabelHighlighting()
    }

    /**
     * Hover and click linkage from the top indicator bar → labels.
     */
    setupIndicatorToLabelHighlighting() {
        const timelineEls = this.querySelectorAll('#timeline [data-value]')

        for (let i = 0; i < timelineEls.length; i++) {
            const timelineEl = timelineEls[i]
            const value = timelineEl.getAttribute('data-value')
            const labelEl = this.querySelector(`#timeline_labels [data-label-for="${value}"]`)

            if (!labelEl) continue

            timelineEl.addEventListener('mouseenter', () => {
                labelEl.classList.add(this.HIGHLIGHT_CLASS)
            })

            timelineEl.addEventListener('mouseleave', () => {
                labelEl.classList.remove(this.HIGHLIGHT_CLASS)
            })

            timelineEl.addEventListener('click', () => {
                labelEl.click()
            })
        }
    }

    /**
     * Hover linkage from labels → matching centered indicator bar element.
     */
    setupLabelToIndicatorHighlighting() {
        const labelEls = this.getLabelEls()

        for (let i = 0; i < labelEls.length; i++) {
            const labelEl = labelEls[i]
            const value = labelEl.getAttribute('data-label-for')
            const timelineEl = this.querySelector(`#timeline div:nth-child(6n + 4)[data-value="${value}"]`)

            if (!timelineEl) continue

            labelEl.addEventListener('mouseenter', () => {
                timelineEl.classList.add(this.HIGHLIGHT_CLASS)
            })

            labelEl.addEventListener('mouseleave', () => {
                timelineEl.classList.remove(this.HIGHLIGHT_CLASS)
            })
        }
    }

    // ========================================================================
    // Intersection Observer
    // ========================================================================

    /**
     * Start an IntersectionObserver that tracks which content section is most visible.
     * rootMargin centers the active window; thresholds provide richer intersectionRatio values.
     */
    startIntersectionObserver() {
        if (this.intersectionObserver) return

        this.intersectionObserver = new IntersectionObserver(
            (entries) => this.handleIntersection(entries),
            {
                rootMargin: this.OBSERVER_ROOT_MARGIN,
                threshold: this.OBSERVER_THRESHOLDS
            }
        )

        const sectionEls = this.getSectionEls()
        for (let i = 0; i < sectionEls.length; i++) {
            this.intersectionObserver.observe(sectionEls[i])
        }
    }

    stopIntersectionObserver() {
        if (!this.intersectionObserver) return

        this.intersectionObserver.disconnect()
        this.intersectionObserver = null
    }

    // ========================================================================
    // Cleanup
    // ========================================================================

    destroy() {
        this.stopIntersectionObserver()

        if (this.boundHandleMouseLeave) {
            this.removeEventListener('mouseleave', this.boundHandleMouseLeave)
            this.boundHandleMouseLeave = null
        }

        if (this.boundHandleResize) {
            window.removeEventListener('resize', this.boundHandleResize)
            this.boundHandleResize = null
        }

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
    }
}

// ============================================================================
// Register Custom Element
// ============================================================================

customElements.define('horizontal-timeline', HorizontalTimeline)
