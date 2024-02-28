class timeline extends HTMLElement {
    constructor() {
        super()
        this.labels = []
    }

    static get observedAttributes() {
        return ['labels']
    }

    attributeChangedCallback(property, oldValue, newValue) {
        if (oldValue === newValue) return
        this[property] = stringToArray(newValue)
    }

    /* TODO add variables, use segment where possible */
    connectedCallback() {
        this.innerHTML = `
            <style>
                horizontal-timeline {
                    display: flex;
                    --var-name: 1;
                }

                #timeline_wrapper {
                    transition: border-radius var(--animate-out-segment) var(--ease-in-quad), margin var(--animate-out-segment) var(--ease-in-quad);
                    position: relative;
                    margin: 0 128px;
                    border-radius: 12px;
                    background-color: rgba(255, 255, 255, 0.15);
                    backdrop-filter: blur(6px);
                    -webkit-backdrop-filter: blur(6px);
                    overflow: clip;
                }

                #timeline_wrapper:hover {
                    transition: border-radius var(--animate-in-segment) var(--ease-out-quad), margin var(--animate-in-segment) var(--ease-out-quad);
                    border-radius: 18px;
                    margin: 0 64px;
                }

                #timeline_content {
                    transition: padding var(--animate-out-segment) var(--ease-in-quad);
                    // display: flex;
                    // align-items: center;
                    // justify-content: center;
                    // white-space: nowrap;
                    overflow-x: auto;
                    overflow-y: hidden;
                    scroll-behavior: smooth;
                    -webkit-overflow-scrolling: touch;
                    padding: 8px 24px 4px 24px;
                    mask-image: linear-gradient(90deg, rgba(0, 0, 0, 0) 0%, rgba(0, 0, 0, 1) var(--segment), rgba(0, 0, 0, 1) calc(100% - var(--segment)), rgba(0, 0, 0, 0) 100%);
                }

                #timeline_wrapper:hover #timeline_content {
                    transition: padding var(--animate-in-segment) var(--ease-out-quad);
                    padding: 16px calc(24px + 64px) 18px calc(24px + 64px);
                }

                #timeline_content > div {
                    transition: row-gap var(--animate-out-segment) var(--ease-in-quad);
                    row-gap: 8px;
                }

                #timeline_wrapper:hover #timeline_content > div {
                    transition: row-gap var(--animate-in-segment) var(--ease-out-quad);
                    row-gap: 12px;
                }

                #timeline {
                    height: 18px;
                    column-gap: 16px;
                }

                #timeline span {
                    transition: background var(--animate-out-segment-2\\/3) linear, height var(--animate-out-segment-2\\/3) var(--ease-in-quad);
                    background-color: rgba(255, 255, 255, 0.45);
                    width: 1.5px;
                    height: calc((6/18)*100%);
                    border-radius: 0.5px;
                }

                #timeline span:nth-child(6n + 4) {
                    height: calc((12/18)*100%);
                }

                #timeline span:nth-child(6n + 3), #timeline span:nth-child(6n + 5) {
                    height: calc((8/18)*100%);
                }

                #timeline span:nth-child(2), #timeline span:nth-last-child(2) {
                    background-color: rgba(255, 255, 255, 0.35);
                }

                #timeline span:first-child, #timeline span:last-child {
                    background-color: rgba(255, 255, 255, 0.25);
                }

                // #timeline span:first-child {
                //     opacity: 0;
                // }

                #timeline span.active,
                #timeline span.active + span,
                #timeline span.active + span + span,
                #timeline span.active + span + span + span,
                #timeline span.active + span + span + span + span,
                #timeline span.active + span + span + span + span + span {
                    transition: background var(--animate-in-segment-2\\/3) linear, height var(--animate-in-segment-2\\/3) var(--ease-out-quad);
                }

                #timeline span.active {
                    background-color: rgba(255, 255, 255, 0.75);
                    height: 100%;
                }

                #timeline span.active + span {
                    transition: background var(--animate-in-segment-2\\/3) linear calc(var(--delay-segment-1\\/3)), height var(--animate-in-segment-2\\/3) var(--ease-out-quad) calc(var(--delay-segment-1\\/3));
                    background-color: rgba(255, 255, 255, 0.7);
                    height: calc((14/18)*100%);
                }

                #timeline span.active + span + span {
                    transition: background var(--animate-in-segment-2\\/3) linear calc(2 * var(--delay-segment-1\\/3)), height var(--animate-in-segment-2\\/3) var(--ease-out-quad) calc(2 * var(--delay-segment-1\\/3));
                    background-color: rgba(255, 255, 255, 0.65);
                    height: calc((10/18)*100%);
                }

                #timeline span.active + span + span + span {
                    transition: background var(--animate-in-segment-2\\/3) linear calc(3 * var(--delay-segment-1\\/3));
                    background-color: rgba(255, 255, 255, 0.6);
                }

                #timeline span.active + span + span + span + span {
                    transition: background var(--animate-in-segment-2\\/3) linear calc(4 * var(--delay-segment-1\\/3));
                    background-color: rgba(255, 255, 255, 0.55);
                }

                #timeline span.active + span + span + span + span + span {
                    transition: background var(--animate-in-segment-2\\/3) linear calc(5 * var(--delay-segment-1\\/3));
                    background-color: rgba(255, 255, 255, 0.5);
                }

                #timeline_labels {
                    display: grid;
                    grid-auto-flow: column;
                    grid-auto-columns: 1fr;
                }

                #timeline_labels button {
                    position: relative;
                    // scroll-snap-align: start;
                    display: inline-flex;
                    justify-self: center;
                    cursor: pointer;
                    // transform: translate(-50%);
                }

                #timeline_labels button span {
                    transition: color var(--animate-out-segment-2\\/3) linear;
                    text-align: center;
                    color: var(--text-2);
                    padding: 4px 5px 4px 7px;
                    font-family: 'Chakra Petch', monospace;
                    font-weight: 600;
                    font-size: 12.8571px;
                    line-height: 14px;
                    letter-spacing: 2px;
                }

                #timeline_labels button span::before {
                    content: "";
                    margin-bottom: -0.1864em;
                    display: table;
                }

                #timeline_labels button span::after {
                    content: "";
                    margin-top: -0.2024em;
                    display: table;
                }

                #timeline_labels button.active span {
                    transition: color var(--animate-in-segment-2\\/3) linear;
                    color: var(--text-1);
                }

                #timeline_labels button::before {
                    transition: opacity var(--animate-out-segment-2\\/3) linear, inset var(--animate-out-segment-2\\/3) var(--ease-in-quad);
                    content: '';
                    position: absolute;
                    inset: 1.5px 3px;
                    opacity: 0;
                    background-color: rgba(255, 255, 255, 0.15);
                    border-radius: 9999px;
                }

                #timeline_labels button.active::before {
                    transition: opacity var(--animate-in-segment-2\\/3) linear, inset var(--animate-in-segment-2\\/3) var(--ease-out-quad);
                    opacity: 1;
                    inset: 0;
                }

                #timeline_labels button:hover::before {
                    transition: opacity var(--animate-in-segment-2\\/3) linear, inset var(--animate-in-segment-2\\/3) var(--ease-out-quad);
                    opacity: 1;
                    inset: 0;
                }

                #timeline_labels button::after {
                    content: '';
                    position: absolute;
                    inset: -30px -5px -5px -5px;
                }
            </style>

            <div id="timeline_wrapper">
                <div id="timeline_content">
                    <div class="inline-flex flex-col">
                        <div id="timeline" class="flex align-items-end">
                            ${this.labels.map((label, index) => `
                                ${index === 0 ? `<span></span>` : ''}
                                <span></span>
                                <span></span>
                                <span></span>
                                <span></span>
                                <span></span>
                                <span></span>
                            `).join('')}
                        </div>
                        <div id="timeline_labels">
                            ${this.labels.map(label => `<button type="button" data-label-for="${label}"><span>${label}</span></button>`).join('')}
                        </div>
                    </div>
                </div>
            </div>
        `

        /* TODO review the function below & make sure when button gets clicked and mouse quickly removed, there's not lag -- add .active straight away */


        const elements = Array.from(document.querySelectorAll('[data-label-for]'))

        elements.forEach(element => {
            element.addEventListener('click', () => {
                const sectionLabel = element.getAttribute('data-label-for')
                const targetElement = document.querySelector(`[data-timeline-section="${sectionLabel}"]`)

                if (targetElement) {
                    scrollParentToChildCenterVertical(document.querySelector('#modal_archive'), targetElement)
                }
            })
        })

        const intersectionObserver = new IntersectionObserver(entries => entries.forEach(entry => {
            const sectionLabel = entry.target.getAttribute('data-timeline-section')
            const labelEl = this.querySelector(`[data-label-for="${sectionLabel}"]`)
            const labelEls = Array.from(this.querySelectorAll('[data-label-for]'))
            const timelineEls = Array.from(this.querySelectorAll('#timeline span'))
            if (entry.isIntersecting) {
                scrollParentToChildCenterHorizontal(this.querySelector('#timeline_content'), labelEl)
                labelEls.forEach(element => { element.classList.remove('active') })
                labelEl.classList.add('active')
                labelEls.some((element, index) => {
                    if (element.getAttribute('data-label-for') === sectionLabel) {
                        timelineEls.forEach(element => { element.classList.remove('active') })
                        if (index === 0) {
                            timelineEls[3].classList.add('active')
                        }
                        else {
                            timelineEls[3 + (index * 6)].classList.add('active')
                        }
                    }
                })
            }
        }), { threshold: 0.75 })
        document.querySelectorAll('[data-timeline-section]').forEach(element => intersectionObserver.observe(element))

        /* let entryElWidthPrev = null
        const resizeObserver = new ResizeObserver((entries) => {
            entries.forEach((entry) => {
                const entryElWidth = entry.contentRect.width
                const timelineContent = this.querySelector('#timeline_content')
                const contentHorizontalScroll = timelineContent.scrollLeft

                console.log(entryElWidth, entryElWidthPrev, contentHorizontalScroll)

                // const isScrolledToLeft = contentHorizontalScroll === 0
                // const isScrolledToRight = contentHorizontalScroll === (timelineContent.scrollWidth - timelineContent.clientWidth)

                if (entryElWidthPrev !== null && entryElWidth !== entryElWidthPrev) {
                    const scrollAdjustment = (entryElWidth - entryElWidthPrev) / 2
                    timelineContent.scrollTo({
                        left: contentHorizontalScroll - scrollAdjustment,
                        behavior: 'instant'
                    })
                }
                entryElWidthPrev = entryElWidth
            })
        })
        resizeObserver.observe(this.querySelector('#timeline_wrapper')) */
    }
}

/* function round(value, step) {
    step || (step = 1.0);
    var inverse = 1.0 / step;
    return Math.round(value * inverse) / inverse;
} */

const stringToArray = (inputString) => {
    const match = inputString.match(/\[(.*?)\]/)
    if (match && match[1]) {
        return match[1].split(',').map(item => item.trim())
    }
    return []
}

const scrollParentToChildCenterHorizontal = (parent, child) => {
    var parentRect = parent.getBoundingClientRect()
    var childRect = child.getBoundingClientRect()
    var scrollAmount = childRect.left - parentRect.left - (parentRect.width - childRect.width) / 2
    parent.scrollLeft += scrollAmount
}

const scrollParentToChildCenterVertical = (parent, child) => {
    const parentRect = parent.getBoundingClientRect()
    const childRect = child.getBoundingClientRect()
    const scrollAmount = childRect.top - parentRect.top - (parentRect.height - childRect.height) / 2
    parent.scrollTop += scrollAmount
}

customElements.define('horizontal-timeline', timeline)
