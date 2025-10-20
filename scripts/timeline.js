class timeline extends HTMLElement {
    constructor() {
        super()
        this.labels = []
        this.activeSection = null
        this.isScrolling = false
        this.intersectionObserver = null
        this.timelineContentEl = null
        this.labelEls = null
        this.hash = '#archive'
    }

    static get observedAttributes() {
        return ['labels']
    }

    attributeChangedCallback(property, oldValue, newValue) {
        if (oldValue === newValue) return
        this[property] = stringToArray(newValue)
    }

    connectedCallback() {
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
                    /* backdrop-filter: blur(0.375rem);
                    -webkit-backdrop-filter: blur(0.375rem); */
                    overflow: clip;
                    contain: content;
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
                    cursor: grab;
                    padding: 0.5rem 1.5rem 0.25rem 1.5rem;
                    mask-image: linear-gradient(90deg, rgba(0, 0, 0, 0) 0%, rgba(0, 0, 0, 1) var(--segment), rgba(0, 0, 0, 1) calc(100% - var(--segment)), rgba(0, 0, 0, 0) 100%);
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

                #timeline div span {
                    transition: background-color var(--animate-out-segment-2\\/3) linear, height var(--animate-out-segment-2\\/3) var(--ease-in-quad);
                    background-color: rgba(255, 255, 255, 0.45);
                    width: max(1.5px, 0.09375rem);
                    height: calc((6/18) * 100%);
                    border-radius: max(0.5px, 0.09375rem);
                }

                #timeline div:hover span,
                #timeline div.highlight span {
                    transition: background-color var(--animate-in-segment-2\\/3) linear, height var(--animate-in-segment-2\\/3) var(--ease-out-quad) !important;
                    height: 100% !important;
                }

                #timeline div:has(+ div:hover) span,
                #timeline div:hover + div span,
                #timeline div:has(+ div.highlight) span,
                #timeline div.highlight + div span {
                    height: calc((14/18) * 100%) !important;
                }

                #timeline div:has(+ div + div:hover) span,
                #timeline div:hover + div + div span,
                #timeline div:has(+ div + div.highlight) span,
                #timeline div.highlight + div + div span {
                    height: calc((10/18) * 100%) !important;
                }

                #timeline div:nth-child(6n + 4) span {
                    height: calc((12/18) * 100%);
                }

                #timeline div:nth-child(6n + 3) span, #timeline div:nth-child(6n + 5) span {
                    height: calc((8/18) * 100%);
                }

                #timeline div:nth-child(2) span, #timeline div:nth-last-child(2) span {
                    background-color: rgba(255, 255, 255, 0.35);
                }

                #timeline div:first-child span, #timeline div:last-child span {
                    background-color: rgba(255, 255, 255, 0.25);
                }

                #timeline div.active span {
                    background-color: rgba(255, 255, 255, 0.75);
                    height: 100%;
                }

                #timeline div.active + div span {
                    transition: background-color var(--animate-in-segment-2\\/3) linear calc(var(--delay-segment-1\\/3)), height var(--animate-in-segment-2\\/3) var(--ease-out-quad));
                    background-color: rgba(255, 255, 255, 0.7);
                    height: calc((14/18) * 100%);
                }

                #timeline div.active + div + div span {
                    transition: background-color var(--animate-in-segment-2\\/3) linear calc(2 * var(--delay-segment-1\\/3)), height var(--animate-in-segment-2\\/3) var(--ease-out-quad);
                    background-color: rgba(255, 255, 255, 0.65);
                    height: calc((10/18) * 100%);
                }

                #timeline div.active + div + div + div span {
                    transition: background-color var(--animate-in-segment-2\\/3) linear calc(3 * var(--delay-segment-1\\/3)), height var(--animate-in-segment-2\\/3) var(--ease-out-quad);
                    background-color: rgba(255, 255, 255, 0.6);
                }

                #timeline div.active + div + div + div + div span {
                    transition: background-color var(--animate-in-segment-2\\/3) linear calc(4 * var(--delay-segment-1\\/3)), height var(--animate-in-segment-2\\/3) var(--ease-out-quad);
                    background-color: rgba(255, 255, 255, 0.55);
                }

                #timeline div.active + div + div + div + div + div span {
                    transition: background-color var(--animate-in-segment-2\\/3) linear calc(5 * var(--delay-segment-1\\/3)), height var(--animate-in-segment-2\\/3) var(--ease-out-quad);
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

        let firstLoad = true

        const scrollParentToChildCenterHorizontal = (parent, child) => {
            if (parent === null || child === null) return
            return new Promise((resolve) => {
                this.isScrolling = true
                let parentRect = parent.getBoundingClientRect()
                let childRect = child.getBoundingClientRect()
                let scrollAmount = childRect.left - parentRect.left - (parentRect.width - childRect.width) / 2
                let initialScrollLeft = parent.scrollLeft

                const isScrollEndSupported = 'onscrollend' in window

                const handleScrollEnd = (event) => {
                    parent.removeEventListener('scrollend', handleScrollEnd)
                    this.isScrolling = false
                    resolve()
                }

                if (initialScrollLeft === 0 && scrollAmount < 0) {
                    resolve()
                    return
                }

                if (isScrollEndSupported) {
                    parent.addEventListener('scrollend', handleScrollEnd)
                }

                parent.scroll({
                    left: initialScrollLeft + scrollAmount,
                    behavior: 'smooth'
                })

                if (!isScrollEndSupported) {
                    setTimeout(() => {
                        this.isScrolling = false
                        resolve()
                    }, 300)
                }
            })
        }

        const scrollParentToChildVertical = (parent, child, scrollBehavior) => {
            if (scrollBehavior === 'instant') {
                parent.classList.add('scroll-behavior-auto')
            }

            const parentRect = parent.getBoundingClientRect()
            const childRect = child.getBoundingClientRect()
            const scrollAmount = childRect.top - parentRect.top - 24
            parent.scrollTop += scrollAmount

            if (scrollBehavior === 'instant') {
                parent.classList.remove('scroll-behavior-auto')
            }
        }

        const handleLabelClick = (modalArchiveEl, labelEl) => () => {
            const section = labelEl.getAttribute('data-label-for')
            const targetElement = document.querySelector(`[data-timeline-section="${section}"]`)
            if (targetElement) {
                scrollParentToChildVertical(modalArchiveEl, targetElement)
            }
        }

        const handleIntersection = (timelineContentEl, labelEls) => (entries) => {
            entries.forEach(async (entry) => {
                const targetSection = entry.target.getAttribute('data-timeline-section')
                const targetLabelEl = this.querySelector(`[data-label-for="${targetSection}"]`)
                const timelineEls = Array.from(this.querySelectorAll('#timeline div'))

                if (entry.isIntersecting) {
                    if (window.location.hash.includes(this.hash) && window.location.hash.split('?year=')[1] !== targetSection) {
                        window.history.replaceState({}, '', window.location.pathname + window.location.hash.split('?')[0] + '?year=' + targetSection)
                    }

                    await scrollParentToChildCenterHorizontal(timelineContentEl, targetLabelEl)

                    labelEls.forEach((labelEl) => labelEl.classList.remove('active'))
                    targetLabelEl.classList.add('active')

                    const index = labelEls.findIndex((labelEl) => labelEl.getAttribute('data-label-for') === targetSection)
                    timelineEls.forEach((timelineEl) => timelineEl.classList.remove('active'))
                    timelineEls[3 + (index === 0 ? 0 : index * 6)].classList.add('active')

                    this.activeSection = targetSection

                    localStorage.setItem('archiveYear', targetSection)
                }
            })
        }

        const initializeTimeline = (() => {
            this.timelineContentEl = this.querySelector('#timeline-content')
            this.labelEls = Array.from(this.querySelectorAll('[data-label-for]'))

            const modalArchiveEl = document.querySelector('#modal_archive')

            this.labelEls.forEach((labelEl) => {
                labelEl.addEventListener('click', handleLabelClick(modalArchiveEl, labelEl))
            })

            if (window.location.hash.includes('?year=')) {
                const yearParam = window.location.hash.split('?year=')[1]

                window.history.pushState({}, '', `${window.location.pathname}${this.hash}`)

                requestAnimationFrame(async () => {
                    window.history.replaceState({}, '', `${window.location.pathname}${this.hash}?year=${yearParam}`)
                    openDialog('modal_archive', document.querySelector('#menu_link_archive'))

                    const targetElement = document.querySelector(`[data-timeline-section="${yearParam}"]`)
                    if (targetElement) {
                        scrollParentToChildVertical(modalArchiveEl, targetElement, 'instant')
                        // await scrollParentToChildCenterHorizontal(this.timelineContentEl, this.querySelector(`[data-label-for="${yearParam}"]`))
                    }
                })
            }

            this.addEventListener('mouseleave', async () => {
                if (this.isScrolling) return
                await scrollParentToChildCenterHorizontal(this.timelineContentEl, this.querySelector(`[data-label-for="${this.activeSection}"]`))
            })
        })()

        const highlightLabelEls = (() => {
            const timelineEls = this.querySelectorAll('#timeline [data-value]')

            timelineEls.forEach(timelineEl => {
                const value = timelineEl.getAttribute('data-value')
                const labelEl = this.querySelector(`#timeline_labels [data-label-for="${value}"]`)

                if (labelEl) {
                    timelineEl.addEventListener('mouseenter', () => {
                        labelEl.classList.add('highlight')
                    })

                    timelineEl.addEventListener('mouseleave', () => {
                        labelEl.classList.remove('highlight')
                    })

                    timelineEl.addEventListener('click', () => {
                        labelEl.click()
                    })
                }
            })
        })()

        const highlightTimelineEls = (() => {
            this.labelEls.forEach(labelEl => {
                const value = labelEl.getAttribute('data-label-for')
                const timelineEl = this.querySelector(`#timeline div:nth-child(6n + 4)[data-value="${value}"]`)

                if (labelEl) {
                    labelEl.addEventListener('mouseenter', () => {
                        timelineEl.classList.add('highlight')
                    })

                    labelEl.addEventListener('mouseleave', () => {
                        timelineEl.classList.remove('highlight')
                    })
                }
            })
        })()

        const setupIntersectionObserver = (timelineContentEl, labelEls) => {
            this.intersectionObserver = new IntersectionObserver(handleIntersection(timelineContentEl, labelEls), {
                rootMargin: '-50% 0% -50% 0%',
                threshold: 0
            })
            document.querySelectorAll('[data-timeline-section]').forEach(async (element) => await this.intersectionObserver.observe(element))
        }

        this.startIntersectionObserver = () => {
            setupIntersectionObserver(this.timelineContentEl, this.labelEls)
        }

        this.stopIntersectionObserver = () => {
            this.intersectionObserver.disconnect()
        }
    }
}

const stringToArray = (inputString) => {
    const match = inputString.match(/\[(.*?)\]/)
    if (match && match[1]) {
        return match[1].split(',').map(item => item.trim())
    }
    return []
}

customElements.define('horizontal-timeline', timeline)
