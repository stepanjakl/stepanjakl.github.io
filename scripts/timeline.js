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

    connectedCallback() {
        console.log(this.labels)

        this.innerHTML = `
          <style>
            horizontal-timeline {
                display: flex;
                --var-name: 1;
            }

            #timeline_wrapper {
                overflow-x: scroll;
                overflow-y: hidden;
                scroll-snap-type: x mandatory;
                scroll-padding-left: 24px;
                -webkit-overflow-scrolling: touch;
                padding: 8px 24px 4px 48px;
                margin: 0 64px;
                border-radius: 9999px;
                background-color: rgba(255, 255, 255, 0.15);
                backdrop-filter: blur(6px);
                -webkit-backdrop-filter: blur(6px);
            }

            #timeline {
                column-gap: 16px;
            }

            #timeline span {
                background-color: rgba(255, 255, 255, 0.45);
                width: 1px;
                height: 7px;
                border-radius: 9999px;
            }

            #timeline span:nth-child(6n + 1), #timeline span:first-child {
                height: 14px;
            }

            #timeline span:last-child {
                opacity: 0;
            }

            #timeline_labels {
                display: grid;
                grid-auto-flow: column;
                grid-auto-columns: 1fr;
            }

            #timeline_labels button {
                scroll-snap-align: center;
                display: inline-flex;
                justify-self: start;
                transform: translate(-50%);
            }

            #timeline_labels button span {
                text-align: center;
                background-color: rgba(255, 255, 255, 0);
                border-radius: 9999px;
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

            #timeline_labels button:first-child span {
                background-color: rgba(255, 255, 255, 0.15);
            }
          </style>

          <div id="timeline_wrapper">
            <div class="inline-flex flex-col" style="row-gap: 8px;">
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
                    ${this.labels.map(label => `<button><span>${label}</span></button>`).join('')}
                </div>
            </div>
          </div>
          `
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
