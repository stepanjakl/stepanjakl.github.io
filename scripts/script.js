const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0 || navigator.msMaxTouchPoints > 0

const isAnimationFinished = (selector) => {
    const animations = document.querySelector(selector).getAnimations()
    return animations.length === 0 || animations[0].playState === 'finished'
}

class TextHighlighter {
    constructor() {
        this.originalText = ''
    }

    highlightAndCopyText(event, textElement, highlightElement, temporaryText) {
        if (this.isCopying(event.target)) {
            this.setTemporaryText(textElement, temporaryText)
            this.activateHighlight(highlightElement)
            this.scheduleDeactivation(event, textElement, highlightElement)
        }
    }

    isCopying(target) {
        return target.getAttribute('data-copying') !== ''
    }

    setTemporaryText(textElement, temporaryText) {
        this.originalText = textElement.innerText
        if (temporaryText) {
            textElement.innerText = temporaryText
        }
    }

    restoreOriginalText(event, textElement) {
        if (this.isCopying(event.target)) {
            event.target.removeAttribute('data-copying')
            textElement.innerText = this.originalText
        }
    }

    activateHighlight(highlightElement) {
        highlightElement.classList.add('highlight-text--active')
    }

    deactivateHighlight(highlightElement) {
        highlightElement.classList.remove('highlight-text--active')
    }

    scheduleDeactivation(event, textElement, highlightElement) {
        setTimeout(() => {
            this.restoreOriginalText(event, textElement)
            this.deactivateHighlight(highlightElement)
            /* setTimeout(() => {
                document.activeElement.blur()
            }, 200) */
        }, 1000)
    }
}


class KeyHandler {
    constructor() {
        this.tooltipSelectors = '#menu_link_profile, #menu_link_archive, #menu_button-wrapper'
        this.menuElementSelector = '#menu'
        this.menuDropdownSelector = '#menu_dropdown'
        this.menuButtonOpenSelector = '#menu_button--open'
        this.menuButtonCloseSelector = '#menu_button--close'

        document.addEventListener('keydown', this.handleKeydown.bind(this))
        document.addEventListener('keyup', this.handleKeyup.bind(this))

        window.addEventListener('blur', () => { this.toggleTooltipActiveClass('remove') })
        document.body.addEventListener('click', () => { this.toggleTooltipActiveClass('remove') })
    }

    handleKeydown(event) {
        if (isAnimationFinished('.animate-fade-in-cta-2 #menu-bg')) {
            switch (event.keyCode) {
                case 27: // Escape key
                    if (aria.getCurrentDialog()) {
                        closeDialog('#')
                    }
                    break
                case 80: // P key
                    this.toggleProfile(event)
                    break
                case 65: // A key
                    this.toggleArchive(event)
                    break
                case 77: // M key
                    this.toggleMenu(event)
                    break
                case 68: // D key
                    this.toggleDebug(event)
                    break
                default:
                    break
            }
        }

        requestAnimationFrame(() => {
            this.handleTooltipActiveClass(event)
        })
    }

    handleKeyup(event) {
        this.toggleTooltipActiveClass('remove')
    }

    toggleTooltipActiveClass(action) {
        document.querySelectorAll(this.tooltipSelectors).forEach(element => {
            element.classList[action]('tooltip-key--active')
        })
    }

    toggleProfile(event) {
        event.preventDefault()
        if (window.location.hash === '#profile') {
            closeDialog('#')
        }
        else {
            openDialog('modal_profile', 'menu_link_profile', null, 'profile')
        }
    }

    toggleArchive(event) {
        event.preventDefault()
        if (window.location.hash.includes('#archive')) {
            closeDialog('#')
        }
        else {
            openDialog('modal_archive', 'menu_link_archive', null, 'archive')
        }
    }

    toggleMenu(event) {
        event.preventDefault()
        if (window.location.hash === '#menu') {
            closeDialog('#')
        } else {
            openDialog('menu_button-wrapper', 'menu_button--open', 'menu_button--close', 'menu')
        }
    }

    toggleDebug(event) {
        event.preventDefault()
        const debugElement = document.getElementById('debug')
        debugElement.checked = !debugElement.checked
    }

    handleTooltipActiveClass(event) {
        if (window.location.hash.split('#')[1] !== ('' || undefined)) {
            this.toggleTooltipActiveClass('remove')
        } else if (event.ctrlKey || event.metaKey) {
            if (window.location.hash === '') {
                this.toggleTooltipActiveClass('add')
            }
        }
    }
}


class WheelHandler {
    constructor() {
        window.addEventListener('wheel', this.handleWheelEvent.bind(this))
    }

    handleWheelEvent(event) {
        if (isAnimationFinished('.animate-fade-in-cta-2 #menu-bg')) {
            const deltaX = Math.abs(event.deltaX)
            const deltaY = Math.abs(event.deltaY)

            if (deltaY > deltaX && deltaY > 5) {
                this.handleVerticalScroll(event.deltaY)
            } else if (deltaX > deltaY && deltaX > 5) {
                this.handleHorizontalScroll(event.deltaX)
            }
        }
    }

    handleVerticalScroll(deltaY) {
        const verticalScrollDirection = deltaY > 0 ? 'down' : 'up'
        const currentHash = window.location.hash.split('?')[0]

        if (currentHash === '#profile' || currentHash === '#archive') {
            this.handleModalVerticalScroll(verticalScrollDirection, currentHash)
        } else {
            this.handleVerticalPageScroll(verticalScrollDirection)
        }
    }

    handleModalVerticalScroll(verticalScrollDirection, currentHash) {
        const modalElement = document.querySelector(
            currentHash === '#profile' ? '#modal_profile' : '#modal_archive'
        )
        const scrollPositionTop = modalElement.scrollTop
        if (verticalScrollDirection === 'up' && scrollPositionTop === 0) {
            closeDialog('#')
        }
    }

    handleVerticalPageScroll(verticalScrollDirection) {
        const scrollPositionY = window.scrollY || window.pageYOffset
        const totalHeight = document.body.scrollHeight

        if (verticalScrollDirection === 'down' && scrollPositionY + window.innerHeight >= totalHeight) {
            if (window.location.hash === '') {
                openDialog('modal_profile', 'menu_link_profile', null, 'profile')
            }
        }
    }

    handleHorizontalScroll(deltaX) {
        const horizontalScrollDirection = deltaX > 0 ? 'right' : 'left'
        const scrollPositionX = window.scrollX || window.pageXOffset
        const totalWidth = document.body.scrollWidth

        if (horizontalScrollDirection === 'right' && scrollPositionX + window.innerWidth >= totalWidth) {
            if (window.location.hash === '') {
                openDialog('menu_button-wrapper', 'menu_button--open', 'menu_button--close', 'menu')
            }
        } else if (horizontalScrollDirection === 'left' && scrollPositionX === 0) {
            if (window.location.hash === '#menu') {
                closeDialog('#')
            }
        }
    }
}


class TouchHandler {
    constructor() {
        this.touchStartX = 0
        this.touchStartY = 0
        this.init()
    }

    init() {
        window.addEventListener('touchstart', this.handleTouchStart.bind(this))
        window.addEventListener('touchmove', this.handleTouchMove.bind(this))
    }

    handleTouchStart(event) {
        this.touchStartX = event.touches[0].clientX
        this.touchStartY = event.touches[0].clientY
    }

    handleTouchMove(event) {
        if (isAnimationFinished('.animate-fade-in-cta-2 #menu-bg')) {
            const touchEndX = event.touches[0].clientX
            const touchEndY = event.touches[0].clientY
            const deltaX = Math.abs(touchEndX - this.touchStartX)
            const deltaY = Math.abs(touchEndY - this.touchStartY)

            if (deltaY > deltaX && deltaY > 5) {
                this.handleVerticalScroll(touchEndY)
            } else if (deltaX > deltaY && deltaX > 5) {
                this.handleHorizontalScroll(touchEndX)
            }
        }
    }

    handleVerticalScroll(touchEndY) {
        const verticalScrollDirection = touchEndY < this.touchStartY ? 'down' : 'up'
        const currentHash = window.location.hash.split('?')[0]

        if (currentHash === '#profile' || currentHash === '#archive') {
            this.handleModalScroll(verticalScrollDirection, currentHash)
        } else {
            this.handleVerticalPageScroll(verticalScrollDirection)
        }
    }

    handleModalScroll(verticalScrollDirection, currentHash) {
        const modalElement = document.querySelector(currentHash === '#profile' ? '#modal_profile' : '#modal_archive')
        const scrollPositionTop = modalElement.scrollTop

        if (verticalScrollDirection === 'up' && scrollPositionTop === 0) {
            closeDialog('#')
        }
    }

    handleVerticalPageScroll(verticalScrollDirection) {
        const scrollPositionY = window.scrollY || window.pageYOffset
        const totalHeight = document.body.scrollHeight

        if (verticalScrollDirection === 'down' && scrollPositionY + window.innerHeight >= totalHeight) {
            if (window.location.hash === '') {
                openDialog('modal_profile', 'menu_link_profile', null, 'profile')
            }
        }
    }

    handleHorizontalScroll(touchEndX) {
        const horizontalScrollDirection = touchEndX > this.touchStartX ? 'right' : 'left'
        const scrollPositionX = window.scrollX
        const totalWidth = document.body.scrollWidth

        if (horizontalScrollDirection === 'right' && scrollPositionX + window.innerWidth >= totalWidth) {
            if (window.location.hash === '#menu') {
                closeDialog('#')
            }
        } else if (horizontalScrollDirection === 'left' && scrollPositionX === 0) {
            if (window.location.hash === '') {
                openDialog('menu_button-wrapper', 'menu_button--open', 'menu_button--close', 'menu')
            }
        }
    }
}


class HorizontalDragScroll {
    constructor(options = {}) {
        this.element = options.element
        this.options = options
        this.isMouseDown = false
        this.startX = 0
        this.scrollLeft = 0
        this.init()
    }

    init() {
        this.element.addEventListener('mousedown', this.onMouseDown.bind(this))
        this.element.addEventListener('mousemove', this.onMouseMove.bind(this))
        this.element.addEventListener('mouseup', this.completeDrag.bind(this))
        this.element.addEventListener('mouseleave', this.completeDrag.bind(this))
        this.element.addEventListener('mousecancel', this.completeDrag.bind(this))
    }

    onMouseDown(event) {
        this.isMouseDown = true
        this.startX = event.clientX
        this.scrollLeft = this.element.scrollLeft
        this.element.classList.add('x-drag-scroll--mouse-down')
    }

    onMouseMove(event) {
        if (!this.isMouseDown) return

        // event.preventDefault()
        /* this.element.setPointerCapture(event.pointerId) */
        this.element.classList.add('x-drag-scroll--dragging')
        const moveX = event.clientX - this.startX
        this.element.scrollLeft = this.scrollLeft - moveX
    }

    completeDrag(event) {
        if (this.isMouseDown) {

            this.isMouseDown = false

            this.element.classList.remove('x-drag-scroll--mouse-down')

            setTimeout(() => {
                this.element.classList.remove('x-drag-scroll--dragging')
                /* this.element.releasePointerCapture(event.pointerId) */
            }, 300)
        }
    }
}


class HorizontalEdgeScroller {
    constructor(options = {}) {
        this.options = options
        this.element = this.options.element
        this.maxSpeed = this.options.maxSpeed || 0.75
        this.scrollSpeed = 0
        this.isScrolling = false
        this.lastTimestamp = null
        this.isSnapped = true

        this.scrollStep = this.scrollStep.bind(this)
        this.handleMouseOut = this.handleMouseOut.bind(this)

        this.init()
    }

    init() {
        if (!isTouchDevice) {
            document.addEventListener('mousemove', this.handleMouseMove.bind(this))
            window.addEventListener('resize', this.onResize.bind(this))
            this.onResize()
        }
    }

    onResize() {
        this.edgeWidth = (this.options.edgeWidthRatio || 3) * parseFloat(getComputedStyle(document.body).fontSize)
        this.setPseudoElementsWidth()
    }

    setPseudoElementsWidth() {
        this.element.setAttribute('data-edge-scroll-id', this.options.id)

        const styleId = `horizontal-edge-scroll-style-${this.options.id}`
        let style = document.getElementById(styleId)

        if (!style) {
            style = document.createElement('style')
            style.id = styleId
            document.head.appendChild(style)
        }

        style.textContent = `
          [data-edge-scroll-id="${this.options.id}"]::before {
            content: '';
            position: absolute;
            z-index: 5;
            display: block;
            inset: 0 auto 0 0;
            width: ${this.edgeWidth}px;
            cursor: w-resize;
            user-select: none;
            -webkit-user-select: none;
          }

          [data-edge-scroll-id="${this.options.id}"]::after {
            content: '';
            position: absolute;
            z-index: 5;
            display: block;
            inset: 0 0 0 auto;
            width: ${this.edgeWidth}px;
            cursor: e-resize;
            user-select: none;
            -webkit-user-select: none;
          }
        `
    }

    handleMouseOut() {
        this.isSnapped = true

        if (this.options.activeSlide) {
            requestAnimationFrame(() => {
                this.element.scrollTo({
                    left: this.options.activeSlide.get().offsetLeft,
                    behavior: 'smooth'
                })
            })
        }

        setTimeout(() => {
            this.element.classList.remove('edge-x-scroll--scrolling')
        }, 300)
    }

    handleMouseMove(event) {
        if (window.matchMedia('(min-width: 45rem)').matches === false) return
        if (this.element.classList.contains('x-drag-scroll--dragging')) return

        const rect = this.element.getBoundingClientRect()
        const { clientX, clientY } = event

        const withinXBounds = clientX >= rect.left && clientX <= rect.right
        const withinYBounds = clientY >= rect.top && clientY <= rect.bottom
        const nearLeftEdge = clientX < rect.left + this.edgeWidth
        const nearRightEdge = clientX > rect.right - this.edgeWidth

        if (withinXBounds && withinYBounds) {
            if (nearLeftEdge) {
                this.scrollSpeed = this.calculateSpeed(clientX - rect.left, this.edgeWidth, 'left')
                this.startScroll()
            } else if (nearRightEdge) {
                this.scrollSpeed = this.calculateSpeed(rect.right - clientX, this.edgeWidth, 'right')
                this.startScroll()
            } else {
                if (this.isScrolling) {
                    this.stopScroll()
                }
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
        if (!this.isScrolling) {
            this.isScrolling = true
            this.isSnapped = false
            this.element.classList.add('edge-x-scroll--scrolling')
            requestAnimationFrame(this.scrollStep)
        }
    }

    scrollStep(timestamp) {
        if (this.lastTimestamp === null) {
            this.lastTimestamp = timestamp
        }
        const elapsed = timestamp - this.lastTimestamp
        this.lastTimestamp = timestamp

        const maxScrollLeft = this.element.scrollWidth - this.element.clientWidth
        const minScrollLeft = 0

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

    calculateSpeed(distance, edgeWidth, direction) {
        const speed = (this.maxSpeed * (edgeWidth - distance)) / edgeWidth
        return direction === 'left' ? -speed : speed
    }
}


class Popup {
    constructor() {
        this.widthRatio = 0.9
        this.heightRatio = 0.9
        this.fallbackContainer = null
        // Static property to track popup blocking across all instances
        if (typeof Popup.isPopupBlocked === 'undefined') {
            Popup.isPopupBlocked = false
        }
    }

    async open(element, event) {
        event.preventDefault()
        const { href } = element

        try {
            const isVideo = this.isVideo(href)
            const dimensions = isVideo ? await this.getVideoDimensions(href) : await this.getImageDimensions(href)

            if (!dimensions) return true

                        // Check if image is tall (width/height ratio less than 0.75)
            const aspectRatio = dimensions.width / dimensions.height
            if (!isVideo && aspectRatio < 0.75) {
                // Create HTML content for the new tab with 100% width image
                const html = `
                    <!DOCTYPE html>
                    <html>
                        <head>
                            <style>
                                body {
                                    margin: 0;
                                    padding: 0;
                                }
                                img {
                                    width: 100%;
                                    height: auto;
                                    display: block;
                                }
                            </style>
                        </head>
                        <body>
                            <img src="${href}" alt="" />
                        </body>
                    </html>
                `
                // Create blob URL from HTML content
                const blob = new Blob([html], { type: 'text/html' })
                const blobUrl = URL.createObjectURL(blob)

                // Open in new tab and cleanup blob URL after
                const newTab = window.open(blobUrl, '_blank')
                if (newTab) {
                    newTab.addEventListener('load', () => URL.revokeObjectURL(blobUrl), { once: true })
                }
                return false
            }

            if (Popup.isPopupBlocked) {
                console.log('Popups are blocked for this session. Using fallback view...')
                this.showFallbackView(href, isVideo, dimensions)
                return true
            }

            const { width, height, left, top } = this.calculateWindowSize(dimensions)

            /* const testPopup = window.open('', '_blank')
            if (testPopup && testPopup.closed) {
                testPopup.close()
            } */

            const popup = window.open(
                href,
                `popup_${Date.now()}`,
                `toolbar=no,location=no,status=no,menubar=no,scrollbars=yes,resizable=yes,width=${width},height=${height},top=${top},left=${left},popup=yes`
            )

            if (popup === null || popup.closed || typeof popup.closed === 'undefined') {
                console.log('Popup was blocked or opened in tab. Using fallback view for the rest of the session...')
                Popup.isPopupBlocked = true
                this.showFallbackView(href, isVideo, dimensions)
                return true
            }

            return false
        } catch (error) {
            console.error('Error opening popup:', error)
            return true
        }
    }

    showFallbackView(url, isVideo, dimensions) {
        if (!this.fallbackContainer) {
            this.fallbackContainer = document.createElement('div')
            this.fallbackContainer.className = 'media_fallback_overlay'
            this.fallbackContainer.innerHTML = `<div class="media_fallback-wrapper"><div class="media_fallback-content"></div></div>`

            if (!document.getElementById('media_fallback-styles')) {
                const styles = document.createElement('style')
                styles.id = 'media_fallback-styles'
                styles.textContent = `
                    .media_fallback_overlay {
                        position: fixed;
                        z-index: 300;
                        inset: 0;
                        background: rgba(0, 0, 0, 0.25);
                        backdrop-filter: blur(1rem);
                    }
                    .media_fallback-wrapper {
                        position: relative;
                        width: 100%;
                        height: 100%;
                        overflow: auto;
                        margin-inline: auto;
                    }
                    .media_fallback-content {
                        display: flex;
                        position: relative;
                        width: 100%;
                        height: auto;
                        min-height: 100%;
                    }
                    .media_fallback-content img,
                    .media_fallback-content video {
                        width: 100%;
                        height: auto;
                        object-fit: contain;
                    }
                    .media_fallback-close-overlay {
                        position: absolute;
                        inset: 0;
                        cursor: zoom-out;
                        z-index: 1;
                    }
                `
                document.head.appendChild(styles)
            }

            this.fallbackContainer.addEventListener('click', (e) => {
                if (e.target.classList.contains('media_fallback-close-overlay')) {
                    this.closeFallbackView()
                }
            })

            /* TODO make keyboard accessible */
            /* document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && this.fallbackContainer.parentElement) {
                    this.closeFallbackView()
                }
            }) */
        }

        // Clear previous content
        const wrapper = this.fallbackContainer.querySelector('.media_fallback-content')
        wrapper.innerHTML = '<div class="media_fallback-close-overlay" aria-label="Close" tabindex="0"></div>'

        // Add new media
        const mediaElement = isVideo ?
            document.createElement('video') :
            document.createElement('img')

        if (isVideo) {
            mediaElement.controls = true
            mediaElement.autoplay = true
        }

        mediaElement.src = url
        wrapper.appendChild(mediaElement)

        // Add to DOM if not already there
        if (!this.fallbackContainer.parentElement) {
            document.body.appendChild(this.fallbackContainer)
        }
    }

    closeFallbackView() {
        if (this.fallbackContainer && this.fallbackContainer.parentElement) {
            this.fallbackContainer.remove()
        }
    }

    isVideo(url) {
        return /\.(mp4|webm|ogg)$/i.test(url)
    }

    getImageDimensions(url) {
        return new Promise((resolve) => {
            const img = new Image()
            img.onload = () => {
                resolve({ width: img.width, height: img.height })
            }
            img.onerror = () => {
                resolve(null)
            }
            img.src = url
        })
    }

    getVideoDimensions(url) {
        return new Promise((resolve) => {
            const video = document.createElement('video')
            video.preload = 'metadata'
            video.onloadedmetadata = () => {
                resolve({ width: video.videoWidth, height: video.videoHeight })
            }
            video.onerror = () => {
                resolve(null)
            }
            video.src = url
        })
    }

    calculateWindowSize(dimensions) {
        const screenWidth = screen.availWidth * this.widthRatio
        const screenHeight = screen.availHeight * this.heightRatio
        const imageRatio = dimensions.width / dimensions.height

        console.log(screenWidth, screenHeight, dimensions.width, dimensions.height);


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

        console.log({
            width: Math.round(width),
            height: Math.round(height),
            left: Math.round(left),
            top: Math.round(top)
        });

        return {
            width: Math.round(width),
            height: Math.round(height),
            left: Math.round(left),
            top: Math.round(top)
        }
    }

}


class Carousel {
    constructor(options = {}) {
        this.options = options
        this.carouselEl = options.element
        this.slidesWrapperEl = this.carouselEl.querySelector('[data-carousel-slides]')
        this.slideEls = Array.from(this.carouselEl.querySelectorAll('[data-carousel-slides] figure'))
        this.navEl = this.carouselEl.querySelector('[data-carousel-nav]')
        this.dotEls = []
        this.prevButtonEl = this.carouselEl.querySelector('[data-carousel-arrows] li:first-child button')
        this.nextButtonEl = this.carouselEl.querySelector('[data-carousel-arrows] li:last-child button')
        this.activeSlide = {
            element: null,
            get: () => this.activeSlide.element,
            set: (el) => this.activeSlide.element = el
        }

        this.init()
    }

    init() {
        this.createNavigationDots()
        this.setupIntersectionObserver()
        this.setupPseudoElsEventListeners()
        this.setupDotEventListeners()
        this.setupButtonEventListeners()
    }

    createNavigationDots() {
        this.navEl.innerHTML = this.slideEls.map((_, index) => `<button data-label-for="${this.slideEls[index].getAttribute('data-value')}"><span class="sr-only">Slide ${index + 1}</span></button>`).join('')
        this.dotEls = Array.from(this.navEl.querySelectorAll('button'))
        this.dotEls[0].setAttribute('aria-current', 'true')
    }

    setupIntersectionObserver() {
        const observer = new IntersectionObserver(entries => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    this.activeSlide.set(entry.target)
                    entry.target.classList.add('active')

                    this.dotEls.forEach((dotEl, i) => {
                        const isCurrent = i === this.slideEls.indexOf(entry.target)
                        dotEl.toggleAttribute('aria-current', isCurrent)
                        /* if (isCurrent) {
                            dotEl.focus()
                        } */
                    })
                } else {
                    entry.target.classList.remove('active')
                }
            })
        }, {
            root: this.carouselEl,
            rootMargin: `0%`,
            threshold: 0.5
        })

        this.slideEls.forEach(itemEl => observer.observe(itemEl))
    }

    setupPseudoElsEventListeners() {
        this.slidesWrapperEl.addEventListener('click', event => {
            const slidesWrapperElRect = this.slidesWrapperEl.getBoundingClientRect()
            const x = event.clientX - slidesWrapperElRect.left

            if (x < slidesWrapperElRect.width * 0.25) {
                this.scrollToSlide(this.activeSlide.get()?.previousElementSibling)
            }
            else if (x > slidesWrapperElRect.width * 0.75) {
                this.scrollToSlide(this.activeSlide.get()?.nextElementSibling)
            }
        })
    }

    setupDotEventListeners() {
        this.dotEls.forEach(dotEl => {
            dotEl.addEventListener('click', event => {
                const targetValue = event.currentTarget.getAttribute('data-label-for')
                const targetSlide = this.carouselEl.querySelector(`figure[data-value="${targetValue}"]`)
                if (targetSlide) {
                    this.scrollToSlide(targetSlide)
                }
            })
        })
    }

    setupButtonEventListeners() {
        this.prevButtonEl.addEventListener('click', event => {
            this.navigateToSlide('prev')
        })

        this.nextButtonEl.addEventListener('click', event => {
            this.navigateToSlide('next')
        })
    }

    navigateToSlide(direction) {
        const currentSlide = this.activeSlide.get()
        if (!currentSlide) return

        const targetSlide = direction === 'prev'
            ? currentSlide.previousElementSibling
            : currentSlide.nextElementSibling

        if (targetSlide) {
            this.scrollToSlide(targetSlide)
        }
    }

    scrollToSlide(slide) {
        slide?.scrollIntoView({
            behavior: 'smooth',
            block: 'nearest',
            inline: 'start'
        })
    }
}

window.handleTouchButtonClick = (element, event, callback, focusAfterClick) => {
    event.preventDefault()

    if (!isTouchDevice) {
        callback()
        return
    }

    element.clickCount = (element.clickCount || 0) + 1

    if (!element.handleBlur) {
        element.handleBlur = (() => {
            const handleBlur = event => {
                if (event.target !== document.activeElement) {
                    element.clickCount = 0
                    delete element.handleBlur
                    event.target.removeAttribute('data-focus-after-click')
                    event.target.removeEventListener('blur', handleBlur)
                }
            }
            element.addEventListener('blur', handleBlur)
        })()
    }

    if (element.clickCount === 2 || element.getAttribute('data-focus-after-click') === 'true') {
        callback()

        if (focusAfterClick) {
            element.setAttribute('data-focus-after-click', 'true')
            element.focus()

            element.addEventListener('blur', () => { element.removeAttribute('data-focus-after-click') }, { once: true })
        }
    } else if (element.clickCount === 1) {
        element.focus()
    } else {
        callback()
    }
}

window.initializeTimeline = () => {
    window.timelineEl = document.createElement('horizontal-timeline')
    timelineEl.labels = ['2024/21', '2021/19', '2019/18', 'elsewhen']

    document.querySelector('#horizontal_timeline').appendChild(timelineEl)

    new HorizontalEdgeScroller({ id: 'timeline', element: document.querySelector('#timeline-content') })
    new HorizontalDragScroll({ element: document.querySelector('#timeline-content') })
}

function initializeDialogs() {
    // List all dialog IDs you want to initialize
    const dialogIds = ['modal_profile', 'modal_archive', 'menu_button-wrapper']
    dialogIds.forEach(dialogId => {
        const dialogEl = document.getElementById(dialogId)
        if (dialogEl) {
            // Ensure ARIA role is set
            if (!dialogEl.getAttribute('role')) {
                dialogEl.setAttribute('role', 'dialog')
            }
            // Ensure backdrop is initialized
            aria.addBackdrop(dialogId)
        }
    })
}

const applyNoAnimation = () => {
    document.querySelectorAll(
        `#square-2,
             #square-3,
             #square-4,
            .animate-fade-in-logo,
            .animate-fade-in-name,
            .animate-fade-in-name>div>p,
            .animate-fade-in-title,
            .animate-fade-in-title>p,
            .animate-fade-in-title .de-highlight-anim span,
            .animate-fade-in-title .de-highlight-anim-alt span,
            .animate-fade-in-cta-1,
            .animate-fade-in-cta-1 #availability_button-bg,
            .animate-fade-in-cta-1 a>div,
            .animate-fade-in-cta-2 #menu-bg,
            .animate-fade-in-cta-2 #menu_email_button-wrapper,
            .animate-fade-in-cta-2 #menu_link_profile,
            .animate-fade-in-cta-2 #menu_link_archive,
            .animate-fade-in-cta-2 #menu_button-wrapper`
    ).forEach(element => {
        element.classList.add('quick-animation')
    })
}

const openDialogOnLoad = () => {
    switch (window.location.hash.split('?')[0]) {
        case '#profile':
            openDialog('modal_profile', 'menu_link_profile', null, 'profile')
            break
        case '#archive':
            const yearParam = window.location.hash.split('?year=')[1]
            if (yearParam) {
                localStorage.setItem('archiveYear', yearParam)
            }
            openDialog('modal_archive', 'menu_link_archive', null, window.location.hash)
            break
        case '#menu':
            openDialog('menu_button-wrapper', 'menu_button--open', 'menu_button--close', 'menu')
            break
    }
}


const initializeModalFooterArt = () => {
    const footerArtWrapper = document.querySelector('.modal-footer-art-wrapper')
    const footerArt = document.querySelector('.modal-footer-art')
    const modalProfile = document.getElementById('modal_profile')
    if (!footerArtWrapper || !footerArt || !modalProfile) return

    function handleScroll() {
        const rect = footerArtWrapper.getBoundingClientRect()
        const modalRect = modalProfile.getBoundingClientRect()
        const inViewDistance = Math.min(Math.max((modalRect.height + rect.height) - rect.bottom, 0), rect.height)
        const progress = Math.min(Math.max(inViewDistance / rect.height, 0), 1)
        // footerArt.style.transform = `scaleY(${progress})`;
        // footerArt.style.transform = `rotateX(${(1 - progress) * 90}deg)`;
        // footerArt.style.transform = `rotateX(${(1 - progress) * 90}deg) scaleY(${progress})`;
        footerArt.style.transform = `rotateX(${progress * 30}deg)`
    }

    modalProfile.addEventListener('scroll', handleScroll, { passive: true })
    window.addEventListener('resize', handleScroll)
    handleScroll()
}


window.toggleFullscreen = () => {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen()
    } else if (document.exitFullscreen) {
        document.exitFullscreen()
    }
}

document.addEventListener('DOMContentLoaded', () => {

    document.body.addEventListener('click', () => {
        if (!isAnimationFinished('.animate-fade-in-cta-2 #menu-bg')) {
            applyNoAnimation()
        }
    }, { once: true })

    initializeDialogs()

    // Detect touch device
    if (isTouchDevice) {
        document.body.classList.add('touch-device')
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
    })
    window.addEventListener('hashchange', () => {
        document.body.classList.add('overflow-hidden')
        window.scroll(0, scrollTop)

        requestAnimationFrame(() => {
            document.body.classList.remove('overflow-hidden')
        })
    })

    // Initialize handlers
    new WheelHandler()
    new TouchHandler()
    new KeyHandler()

    // Initialize text highlighter
    window.textHighlighter = new TextHighlighter()

    // Initialize carousels
    document.querySelectorAll('[data-carousel]').forEach((carouselEl, index) => new Carousel({ id: `carousel-${index + 1}`, element: carouselEl }))

    // Initialize popups
    document.querySelectorAll('[data-carousel-slides] figure a, [data-timeline-section] nav ul li a, [data-timeline-section] picture a').forEach(element => {
        element.addEventListener('click', event => new Popup().open(element, event))
    })

    // Initialize modal footer art
    initializeModalFooterArt()

    // Initialize timeline
    aria.addBackdrop('modal_archive')
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
        })
    })
    initializeTimeline()
    timelineEl.startIntersectionObserver()
    const positionTimeline = event => {
        if (event && event.currentTarget !== event.target) return

        const archiveWrapperEl = document.querySelector('#modal_archive-wrapper')
        const archiveWrapperRect = archiveWrapperEl.getBoundingClientRect()
        const timelineContentSectionEl = document.querySelector('#modal_archive-wrapper [data-timeline-section]')
        const timelineContentSectionRect = timelineContentSectionEl.getBoundingClientRect()

        const timelineWrapperEl = document.querySelector('#horizontal_timeline')
        timelineWrapperEl.style.setProperty('left', `${timelineContentSectionRect.left - archiveWrapperRect.left}px`)
        timelineWrapperEl.style.setProperty('right', `${archiveWrapperRect.right - timelineContentSectionRect.right}px`)
    }
    positionTimeline()
    document.querySelector('#modal_archive .modal-content').addEventListener('transitionend', positionTimeline)
    window.addEventListener('resize', positionTimeline)

})
