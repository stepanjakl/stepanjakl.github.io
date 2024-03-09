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

    /* TODO add variables, use --segment where possible */
    connectedCallback() {
        this.innerHTML = `
            <style>
                horizontal-timeline {
                    display: flex;
                    --var-name: 1;
                }

                #timeline_wrapper {
                    transition: border-radius var(--animate-out-segment) var(--ease-in-quad), margin var(--animate-out-segment) var(--ease-in-quad), transform var(--animate-out-segment) var(--ease-in-quad);
                    position: relative;
                    margin: 0 8rem;
                    border-radius: 0.75rem;
                    background-color: rgba(255, 255, 255, 0.15);
                    backdrop-filter: blur(0.375rem);
                    -webkit-backdrop-filter: blur(0.375rem);
                    overflow: clip;
                }

                #timeline_wrapper:hover {
                    transition: border-radius var(--animate-in-segment) var(--ease-out-quad), margin var(--animate-in-segment) var(--ease-out-quad), transform var(--animate-in-segment) var(--ease-out-quad);
                    border-radius: 1.125rem;
                    margin: 0 4rem;
                    transform: translateY(calc(1.125rem / 4))
                }

                #timeline_content {
                    transition: padding var(--animate-out-segment) var(--ease-in-quad);
                    overflow-x: scroll;
                    overflow-y: hidden;
                    scroll-behavior: smooth;
                    white-space: nowrap;
                    scrollbar-width: none;
                    -webkit-overflow-scrolling: touch;
                    -ms-overflow-style: none;
                    padding: 0.5rem 1.5rem 0.25rem 1.5rem;
                    mask-image: linear-gradient(90deg, rgba(0, 0, 0, 0) 0%, rgba(0, 0, 0, 1) var(--segment), rgba(0, 0, 0, 1) calc(100% - var(--segment)), rgba(0, 0, 0, 0) 100%);
                }

                #timeline_content::-webkit-scrollbar {
                    display: none;
                }

                #timeline_wrapper:hover #timeline_content {
                    transition: padding var(--animate-in-segment) var(--ease-out-quad);
                    padding: calc(0.5rem + 0.375rem) calc(1.5rem + 4rem) calc(0.25rem + 0.375rem) calc(1.5rem + 4rem);
                }

                #timeline_content > div {
                    transition: row-gap var(--animate-out-segment) var(--ease-in-quad);
                    row-gap: 0.5rem;
                }

                #timeline_wrapper:hover #timeline_content > div {
                    transition: row-gap var(--animate-in-segment) var(--ease-out-quad);
                    row-gap: calc(0.5rem + 0.375rem);
                }

                #timeline {
                    height: 1.125rem;
                    column-gap: 1rem;
                }

                #timeline span {
                    transition: background var(--animate-out-segment-2\\/3) linear, height var(--animate-out-segment-2\\/3) var(--ease-in-quad);
                    background-color: rgba(255, 255, 255, 0.45);
                    width: 0.09375rem;
                    height: calc((6/18)*100%);
                    border-radius: 0.03125rem;
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
                    display: inline-flex;
                    justify-self: center;
                    cursor: pointer;
                }

                #timeline_labels button span {
                    transition: color var(--animate-out-segment-2\\/3) linear;
                    text-align: center;
                    color: var(--text-2);
                    padding: 0.25rem 0.3125rem 0.25rem 0.4375rem;
                    font-family: 'Chakra Petch', monospace;
                    font-weight: 600;
                    font-size: 0.80356875rem;
                    line-height: 0.875rem;
                    letter-spacing: 0.125rem;
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
                    inset: 0.09375rem 0.1875rem;
                    opacity: 0;
                    background-color: rgba(255, 255, 255, 0.15);
                    border-radius: 999rem;
                }

                #timeline_labels button.active::before {
                    transition: opacity var(--animate-in-segment-2\\/3) linear, inset var(--animate-in-segment-2\\/3) var(--ease-out-quad);
                    opacity: 1;
                    inset: 0;
                }

                #timeline_labels button:hover::before, #timeline_labels button:focus::before {
                    transition: opacity var(--animate-in-segment-2\\/3) linear, inset var(--animate-in-segment-2\\/3) var(--ease-out-quad);
                    opacity: 1;
                    inset: 0;
                }

                #timeline_labels button::after {
                    content: '';
                    position: absolute;
                    inset: -1.875rem -0.3125rem -0.3125rem -0.3125rem;
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


        const scrollParentToChildCenterHorizontal = (parent, child) => {
            var parentRect = parent.getBoundingClientRect()
            var childRect = child.getBoundingClientRect()
            var scrollAmount = childRect.left - parentRect.left - (parentRect.width - childRect.width) / 2
            parent.scrollLeft += scrollAmount
        }

        const scrollParentToChildVertical = (parent, child) => {
            const parentRect = parent.getBoundingClientRect()
            const childRect = child.getBoundingClientRect()
            const scrollAmount = childRect.top - parentRect.top - 24
            parent.scrollTop += scrollAmount
        }

        const handleLabelClick = (modalArchiveEl, labelEl) => () => {
            const section = labelEl.getAttribute('data-label-for')
            const targetElement = document.querySelector(`[data-timeline-section="${section}"]`)
            if (targetElement) {
                scrollParentToChildVertical(modalArchiveEl, targetElement)
            }
        }

        const handleIntersection = (timelineContentEl, labelEls) => (entries) => {
            entries.forEach((entry) => {
                const targetSection = entry.target.getAttribute('data-timeline-section')
                const targetLabelEl = document.querySelector(`[data-label-for="${targetSection}"]`)
                const timelineEls = Array.from(document.querySelectorAll('#timeline span'))

                if (entry.isIntersecting) {
                    targetLabelEl.focus()
                    scrollParentToChildCenterHorizontal(timelineContentEl, targetLabelEl)

                    labelEls.forEach((labelEl) => labelEl.classList.remove('active'))
                    targetLabelEl.classList.add('active')

                    const index = labelEls.findIndex((labelEl) => labelEl.getAttribute('data-label-for') === targetSection)
                    timelineEls.forEach((timelineEl) => timelineEl.classList.remove('active'))
                    timelineEls[3 + (index === 0 ? 0 : index * 6)].classList.add('active')
                }
            })
        }

        const setupIntersectionObserver = (timelineContentEl, labelEls) => {
            const intersectionObserver = new IntersectionObserver(handleIntersection(timelineContentEl, labelEls), { threshold: 0.75 })
            document.querySelectorAll('[data-timeline-section]').forEach((element) => intersectionObserver.observe(element))
        }

        const initializeTimeline = () => {
            const modalArchiveEl = document.querySelector('#modal_archive')
            const timelineContentEl = document.querySelector('#timeline_content')
            const labelEls = Array.from(document.querySelectorAll('[data-label-for]'))

            labelEls.forEach((labelEl) => {
                labelEl.addEventListener('click', handleLabelClick(modalArchiveEl, labelEl))
            })

            setupIntersectionObserver(timelineContentEl, labelEls)
        }

        initializeTimeline()

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
