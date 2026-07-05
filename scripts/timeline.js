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
 * Global utilities imported from the `App` namespace (defined in `script.js`).
 * - ResizeManager: Manages resize events and debounces them for performance.
 * - App.getScrollBehavior: Provides scroll behavior respecting `prefers-reduced-motion` for accessibility.
 */
/* global ResizeManager */

// ============================================================================
// HorizontalTimeline Custom Element
// ============================================================================

/**
 * <horizontal-timeline>
 * Self-contained custom element that renders a horizontal timeline with labels and indicator bars.
 *
 * Features:
 * - Keeps active label centred horizontally when sections intersect viewport
 * - Highlights matching vertical indicator above active label
 * - Syncs URL query (?year=YYYY) for deep-linking
 * - All styles embedded within component
 * - Fully configurable behaviour via properties
 *
 * Usage:
 *   const timeline = document.createElement('horizontal-timeline')
 *   timeline.labels = ['2026', '2025-21', '2023-19', '2019-18', 'elsewhen']
 *   timeline.hashPrefix = '#archive'  // Optional, defaults to '#archive'
 *   timeline.scrollOffset = 24        // Optional, defaults to 24
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
	// These offsets mirror the decorative bar pattern generated in render().
	static TIMELINE_FIRST_INDICATOR_INDEX = 3;
	static TIMELINE_INDICATORS_PER_LABEL = 6;

	constructor() {
		super();

		// Public configuration (set from script.js)
		this.labels = [];
		this.hashPrefix = '#archive';
		this.scrollOffset = 24;
		this.scrollEndTimeout = 300;
		this.observerRootMargin = '-50% 0% -50% 0%';
		this.observerThresholds = [0, 0.25, 0.5, 0.75, 1];

		// Private state
		this.activeSection = null;
		this.isScrolling = false;
		this.hasUserScrolled = false; // Track if user has manually scrolled

		// Cached DOM references (lazy-initialised)
		this.timelineContentEl = null;
		this.labelEls = null;
		this.timelineAllDivEls = null;
		this.sectionEls = null;
		this.modalArchiveEl = null;

		// Observer instance
		this.intersectionObserver = null;

		// Resize handler cleanup (registered with centralised ResizeManager)
		this.unregisterResize = null;

		// Bound event handlers (for cleanup)
		this.boundHandleMouseLeave = null;
		this.boundHandleScrollEnd = null;
		this.boundHandleClick = null;
		this.boundHandleKeydown = null;
		this.boundHandleMouseOver = null;
		this.boundHandleMouseOut = null;
	}

	// ========================================================================
	// Lifecycle Methods
	// ========================================================================

	connectedCallback() {
		this.render();
		this.setupEventHandlers();
	}

	disconnectedCallback() {
		this.destroy();
	}

	// ========================================================================
	// Rendering
	// ========================================================================

	render() {
		if (!this.labels || !this.labels.length) {
			console.warn('HorizontalTimeline: No labels provided');
			return;
		}

		/* eslint-disable indent -- HTML formatting in template literal */
		this.innerHTML = `
            <div id="timeline-wrapper">
                <div id="timeline-content">
                    <div>
                        <div id="timeline_bars">
                            ${this.labels
								.map(
									(label, index) => `
                                ${index === 0 ? '<div><span></span></div>' : ''}
                                <div><span></span></div>
                                <div data-value='${label}'><span></span></div>
                                <div data-value='${label}'><span></span></div>
                                <div data-value='${label}'><span></span></div>
                                <div data-value='${label}'><span></span></div>
                                <div data-value='${label}'><span></span></div>
                            `
								)
								.join('')}
                        </div>
                        <div id="timeline_labels" role="tablist" aria-label="Timeline navigation">
                            ${this.labels.map((label, index) => `<button type="button" role="tab" data-label-for="${label}" aria-label="View ${label} projects" aria-selected="${index === 0 ? 'true' : 'false'}" aria-controls="timeline-content-${label}" tabindex="${index === 0 ? '0' : '-1'}"><span>${label}<span></span></span></button>`).join('')}
                        </div>
                    </div>
                </div>
            </div>
        `;
		/* eslint-enable indent */
	}

	// ========================================================================
	// DOM Helpers
	// ========================================================================

	getTimelineContentEl() {
		return (this.timelineContentEl ??= this.querySelector('#timeline-content'));
	}

	getLabelEls() {
		return (this.labelEls ??= Array.from(this.querySelectorAll('[data-label-for]')));
	}

	getTimelineAllDivEls() {
		return (this.timelineAllDivEls ??= Array.from(this.querySelectorAll('#timeline_bars div')));
	}

	getSectionEls() {
		return (this.sectionEls ??= Array.from(
			document.querySelectorAll('[data-timeline-section]')
		));
	}

	getModalArchiveEl() {
		return (this.modalArchiveEl ??= document.querySelector('#modal-archive'));
	}

	// ========================================================================
	// Scrollable State Management
	// ========================================================================

	updateScrollableClass() {
		const timelineContent = this.getTimelineContentEl();
		if (!timelineContent) return;

		const isScrollable = timelineContent.scrollWidth > timelineContent.clientWidth;
		this.classList.toggle('timeline-scrollable', isScrollable);
	}

	// ========================================================================
	// Scrolling Utilities
	// ========================================================================

	/**
	 * Smoothly scroll horizontally to centre a child element within its parent
	 * Returns a Promise that resolves when scrolling completes
	 *
	 * @param {HTMLElement} parent - Scrollable container
	 * @param {HTMLElement} child - Element to centre
	 * @returns {Promise<void>}
	 */
	scrollParentToChildCenterHorizontal(parent, child) {
		if (!parent || !child) return Promise.resolve();

		return new Promise((resolve) => {
			if (this.boundHandleScrollEnd) {
				parent.removeEventListener('scrollend', this.boundHandleScrollEnd);
				this.boundHandleScrollEnd = null;
			}

			this.isScrolling = true;

			const parentRect = parent.getBoundingClientRect();
			const childRect = child.getBoundingClientRect();
			const scrollAmount =
				childRect.left - parentRect.left - (parentRect.width - childRect.width) / 2;
			const initialScrollLeft = parent.scrollLeft;

			if (Math.abs(scrollAmount) < 1 || (initialScrollLeft === 0 && scrollAmount < 0)) {
				this.isScrolling = false;
				resolve();
				return;
			}

			let scrollEndFallback = null;
			const handleScrollEnd = () => {
				// Identity check: a superseded scroll's stale fallback timer must not
				// deregister the listener belonging to a newer scroll
				if (this.boundHandleScrollEnd === handleScrollEnd) {
					parent.removeEventListener('scrollend', this.boundHandleScrollEnd);
					this.boundHandleScrollEnd = null;
				}
				if (scrollEndFallback) {
					clearTimeout(scrollEndFallback);
				}
				this.isScrolling = false;
				resolve();
			};

			scrollEndFallback = setTimeout(handleScrollEnd, this.scrollEndTimeout);

			if ('onscrollend' in window) {
				this.boundHandleScrollEnd = handleScrollEnd;
				parent.addEventListener('scrollend', this.boundHandleScrollEnd, { once: true });
			}

			parent.scroll({
				left: initialScrollLeft + scrollAmount,
				behavior: App.getScrollBehavior()
			});
		});
	}

	/**
	 * Scroll vertically to reveal a child element with an offset from the top
	 *
	 * @param {HTMLElement} parent - Scrollable container
	 * @param {HTMLElement} child - Element to scroll into view
	 * @param {string} scrollBehavior - 'instant', 'smooth', or null (auto-detect based on preferences)
	 */
	scrollParentToChildVertical(parent, child, scrollBehavior = null) {
		if (!parent || !child) return;

		const parentRect = parent.getBoundingClientRect();
		const childRect = child.getBoundingClientRect();
		const scrollAmount = childRect.top - parentRect.top - this.scrollOffset;

		// Use App.getScrollBehavior() if no explicit behaviour provided
		const behavior = scrollBehavior || App.getScrollBehavior();

		if (behavior === 'instant' || behavior === 'auto') {
			// Temporarily disable smooth scrolling
			parent.classList.add('scroll-behavior-auto');
			parent.scrollTop += scrollAmount;
			requestAnimationFrame(() => {
				parent.classList.remove('scroll-behavior-auto');
			});
		} else {
			parent.scrollBy({
				top: scrollAmount,
				behavior: behavior
			});
		}
	}

	// ========================================================================
	// Event Handlers
	// ========================================================================

	handleLabelClick(labelEl) {
		const section = labelEl.getAttribute('data-label-for');
		const targetElement = document.querySelector(`[data-timeline-section="${section}"]`);
		const modalArchive = this.getModalArchiveEl();

		if (targetElement && modalArchive) {
			this.scrollParentToChildVertical(modalArchive, targetElement);
		}
	}

	handleIntersection(entries) {
		// Find most visible intersecting section
		const intersectingEntries = entries.filter((entry) => entry.isIntersecting);
		if (!intersectingEntries.length) return;

		const mostVisible = intersectingEntries.reduce((best, current) =>
			current.intersectionRatio > best.intersectionRatio ? current : best
		);

		const targetSection = mostVisible.target.getAttribute('data-timeline-section');
		const targetLabel = this.querySelector(`[data-label-for="${targetSection}"]`);
		if (!targetLabel) return;

		// Only update URL if modal is open AND user has a year parameter or has scrolled
		// This prevents automatically adding ?year= when opening modal without params
		if (window.location.hash.includes(this.hashPrefix)) {
			const currentYear = window.location.hash.split('?year=')[1];

			// Only update if:
			// 1. There's already a year parameter that's different, OR
			// 2. User has actively scrolled the modal
			const shouldUpdateHash =
				(currentYear && currentYear !== targetSection) || this.hasUserScrolled;

			if (shouldUpdateHash) {
				const baseHash = window.location.hash.split('?')[0];
				window.history.replaceState(
					null,
					'',
					`${window.location.pathname}${baseHash}?year=${targetSection}`
				);
			}
		}

		// Centre the active label
		this.scrollParentToChildCenterHorizontal(this.getTimelineContentEl(), targetLabel);

		// Update active states
		this.setActiveLabel(targetSection);
		this.setActiveIndicator(targetSection);

		// Store active section reference
		this.activeSection = targetSection;
	}

	handleMouseLeave() {
		if (this.isScrolling || !this.activeSection) return;

		const activeLabel = this.querySelector(`[data-label-for="${this.activeSection}"]`);
		if (activeLabel) {
			this.scrollParentToChildCenterHorizontal(this.getTimelineContentEl(), activeLabel);
		}
	}

	handleResize() {
		// Update scrollable class when dimensions change
		this.updateScrollableClass();
	}

	// ========================================================================
	// State Management
	// ========================================================================

	/**
	 * Set the active label, removing active class from all others.
	 * Also announces the change to screen readers via live region.
	 */
	setActiveLabel(section) {
		const labelEls = this.getLabelEls();
		labelEls.forEach((el) => {
			const isActive = el.getAttribute('data-label-for') === section;

			// Visual state
			el.classList.toggle('active', isActive);

			// Screen reader state
			el.setAttribute('aria-selected', isActive ? 'true' : 'false');
			el.setAttribute('tabindex', isActive ? '0' : '-1');
		});

		const activeLabel = this.querySelector(`[data-label-for="${section}"]`);
		if (activeLabel) {
			// Announce current section to screen readers
			const announcement = document.getElementById('timeline-announcement');
			if (announcement) {
				announcement.textContent = `Viewing ${section} projects`;
			}
		}
	}

	/**
	 * Set the active indicator (vertical bar) above the active label.
	 */
	setActiveIndicator(section) {
		const timelineEls = this.getTimelineAllDivEls();
		const labelEls = this.getLabelEls();

		// Clear all active indicators
		timelineEls.forEach((el) => el.classList.remove('active'));

		// Find index of active label
		const labelIndex = labelEls.findIndex(
			(el) => el.getAttribute('data-label-for') === section
		);

		if (labelIndex === -1) return;

		// Calculate indicator position (centred above label)
		const indicatorIndex =
			HorizontalTimeline.TIMELINE_FIRST_INDICATOR_INDEX +
			labelIndex * HorizontalTimeline.TIMELINE_INDICATORS_PER_LABEL;

		if (timelineEls[indicatorIndex]) {
			timelineEls[indicatorIndex].classList.add('active');
		}
	}

	// ========================================================================
	// Event Setup
	// ========================================================================

	/**
	 * Initialise all event handlers using delegation pattern
	 */
	setupEventHandlers() {
		// Click handling - labels and indicators
		this.boundHandleClick = (event) => {
			// Handle label clicks
			const labelButton = event.target.closest('#timeline_labels [data-label-for]');
			if (labelButton && this.contains(labelButton)) {
				this.handleLabelClick(labelButton);
				return;
			}

			// Handle indicator clicks - delegate to corresponding label
			const indicator = event.target.closest('#timeline_bars [data-value]');
			if (indicator && this.contains(indicator)) {
				const value = indicator.getAttribute('data-value');
				const label = this.querySelector(`[data-label-for="${value}"]`);
				if (label) label.click();
			}
		};
		this.addEventListener('click', this.boundHandleClick);

		// Keyboard navigation for timeline labels
		this.boundHandleKeydown = (event) => {
			const labelButton = event.target.closest('#timeline_labels [data-label-for]');
			if (!labelButton || !this.contains(labelButton)) return;

			const labelEls = this.getLabelEls();
			const currentIndex = labelEls.indexOf(labelButton);
			let targetIndex = -1;
			let handled = false;

			switch (event.key) {
				case 'ArrowLeft':
				case 'ArrowUp':
					targetIndex = Math.max(currentIndex - 1, 0);
					handled = true;
					break;
				case 'ArrowRight':
				case 'ArrowDown':
					targetIndex = Math.min(currentIndex + 1, labelEls.length - 1);
					handled = true;
					break;
				case 'Home':
					targetIndex = 0;
					handled = true;
					break;
				case 'End':
					targetIndex = labelEls.length - 1;
					handled = true;
					break;
			}

			if (handled && targetIndex !== -1 && targetIndex !== currentIndex) {
				event.preventDefault();

				// Update tabindex
				labelEls.forEach((el, index) => {
					el.setAttribute('tabindex', index === targetIndex ? '0' : '-1');
				});

				// Focus and click target
				labelEls[targetIndex].focus();
				labelEls[targetIndex].click();
			}
		};
		this.addEventListener('keydown', this.boundHandleKeydown);

		// Hover highlighting - bidirectional between indicators and labels
		this.boundHandleMouseOver = (event) => {
			// Indicator hover → highlight label
			const indicator = event.target.closest('#timeline_bars [data-value]');
			if (indicator && this.contains(indicator)) {
				const value = indicator.getAttribute('data-value');
				const label = this.querySelector(`[data-label-for="${value}"]`);
				if (label) label.classList.add('highlight');
				return;
			}

			// Label hover → highlight centred indicator
			const label = event.target.closest('#timeline_labels [data-label-for]');
			if (label && this.contains(label)) {
				const value = label.getAttribute('data-label-for');
				const indicator = this.querySelector(
					`#timeline_bars div:nth-child(6n + 4)[data-value="${value}"]`
				);
				if (indicator) indicator.classList.add('highlight');
			}
		};

		this.boundHandleMouseOut = (event) => {
			// Remove highlight from indicator-triggered label
			const indicator = event.target.closest('#timeline_bars [data-value]');
			if (indicator && this.contains(indicator)) {
				const value = indicator.getAttribute('data-value');
				const label = this.querySelector(`[data-label-for="${value}"]`);
				if (label) label.classList.remove('highlight');
				return;
			}

			// Remove highlight from label-triggered indicator
			const label = event.target.closest('#timeline_labels [data-label-for]');
			if (label && this.contains(label)) {
				const value = label.getAttribute('data-label-for');
				const indicator = this.querySelector(
					`#timeline_bars div:nth-child(6n + 4)[data-value="${value}"]`
				);
				if (indicator) indicator.classList.remove('highlight');
			}
		};

		this.addEventListener('mouseover', this.boundHandleMouseOver);
		this.addEventListener('mouseout', this.boundHandleMouseOut);

		// Mouse leave - recentre active label
		this.boundHandleMouseLeave = () => this.handleMouseLeave();
		this.addEventListener('mouseleave', this.boundHandleMouseLeave);

		// Window resize - register with centralised ResizeManager (if available)
		if (typeof ResizeManager !== 'undefined') {
			this.unregisterResize = ResizeManager.register(() => this.handleResize());
		}
	}

	// ========================================================================
	// Intersection Observer
	// ========================================================================

	/**
	 * Start observing content sections to track which is most visible
	 * Updates timeline state as user scrolls through sections
	 *
	 * Configuration:
	 * - rootMargin centres the detection zone vertically
	 * - Multiple thresholds provide granular intersection ratio updates
	 */
	startIntersectionObserver() {
		if (this.intersectionObserver) {
			return;
		}

		const sectionEls = this.getSectionEls();
		if (!sectionEls.length) {
			console.warn('Timeline: No sections found to observe');
			return;
		}

		this.intersectionObserver = new IntersectionObserver(
			(entries) => this.handleIntersection(entries),
			{
				rootMargin: this.observerRootMargin,
				threshold: this.observerThresholds
			}
		);

		sectionEls.forEach((section) => this.intersectionObserver.observe(section));
	}

	/**
	 * Stop observing sections and clean up observer instance.
	 */
	stopIntersectionObserver() {
		if (!this.intersectionObserver) return;

		this.intersectionObserver.disconnect();
		this.intersectionObserver = null;
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
		this.stopIntersectionObserver();

		// Remove event listeners
		const listeners = [
			{ target: this, type: 'click', handler: 'boundHandleClick' },
			{ target: this, type: 'keydown', handler: 'boundHandleKeydown' },
			{ target: this, type: 'mouseover', handler: 'boundHandleMouseOver' },
			{ target: this, type: 'mouseout', handler: 'boundHandleMouseOut' },
			{ target: this, type: 'mouseleave', handler: 'boundHandleMouseLeave' }
		];

		listeners.forEach(({ target, type, handler }) => {
			if (this[handler]) {
				target.removeEventListener(type, this[handler]);
				this[handler] = null;
			}
		});

		// Unregister from centralised resize manager
		if (this.unregisterResize) {
			this.unregisterResize();
			this.unregisterResize = null;
		}

		// Clean up scroll end listener if it exists
		if (this.boundHandleScrollEnd) {
			const timelineContent = this.getTimelineContentEl();
			if (timelineContent) {
				timelineContent.removeEventListener('scrollend', this.boundHandleScrollEnd);
			}
			this.boundHandleScrollEnd = null;
		}

		// Clear cached DOM references
		this.timelineContentEl = null;
		this.labelEls = null;
		this.timelineAllDivEls = null;
		this.sectionEls = null;
		this.modalArchiveEl = null;

		// Clear state
		this.activeSection = null;
		this.isScrolling = false;
	}
}

// ============================================================================
// Register Custom Element
// ============================================================================

if (!customElements.get('horizontal-timeline')) {
	customElements.define('horizontal-timeline', HorizontalTimeline);
}
