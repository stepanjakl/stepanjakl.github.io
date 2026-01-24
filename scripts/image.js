/*!
 * Personal website of Štěpán Jákl
 * https://stepanjakl.com
 *
 * Copyright © 2025 Štěpán Jákl
 * Released under the MIT license
 * https://github.com/stepanjakl/stepanjakl.github.io/blob/main/LICENSE
 */
/* global afterPaint */

/**
 * Pixelated Image Placeholder System
 *
 * Generates animated pixelated placeholders for lazy-loaded images using Canvas API.
 * Creates a progressive reveal effect that transitions from coarse pixels to full resolution.
 * Respects accessibility preferences (prefers-reduced-motion, prefers-reduced-transparency, etc.)
 *
 * @class PixelatedImageLoader
 */

class PixelatedImageLoader {
	/**
	 * Initialize the image loader with configuration options
	 * @param {Object} options - Configuration options
	 * @param {number[]} options.pixelSizes - Array of pixel size ratios for progressive reveal
	 * @param {number} options.animationInterval - Milliseconds between reveal phases
	 * @param {number} options.animationPlaceholderInterval - Milliseconds between placeholder updates
	 * @param {number} options.placeholderMinOpacity - Minimum opacity for placeholder pixels
	 * @param {number} options.placeholderMaxOpacity - Maximum opacity for placeholder pixels
	 * @param {number} options.placeholderOpacityStep - Step size for opacity randomization
	 * @param {number} options.viewportThreshold - IntersectionObserver threshold (0-1)
	 * @param {number} options.revealDelay - Delay before starting reveal animation
	 * @param {number} options.startImageOpacity - Initial opacity during reveal
	 * @param {number} options.endImageOpacity - Final opacity after reveal
	 * @param {number} options.whiteBlendFactor - Amount of white blending (0-1)
	 */
	constructor(options = {}) {
		this.config = {
			pixelSizes: options.pixelSizes || [0.25, 0.15, 0.08, 0.04, 0.02, 0.01, 0.005],
			animationInterval: options.animationInterval ?? 100,
			animationPlaceholderInterval: options.animationPlaceholderInterval ?? 100,
			placeholderMinOpacity: options.placeholderMinOpacity ?? 0.05,
			placeholderMaxOpacity: options.placeholderMaxOpacity ?? 0.25,
			placeholderOpacityStep: options.placeholderOpacityStep ?? 0.05,
			viewportThreshold: options.viewportThreshold ?? 0.5,
			revealDelay: options.revealDelay ?? 1000,
			startImageOpacity: options.startImageOpacity ?? 0.25,
			endImageOpacity: options.endImageOpacity ?? 1.0,
			whiteBlendFactor: options.whiteBlendFactor ?? 0.6
		};

		this.images = [];
		this.init();
	}

	/**
	 * Initialize the loader and set up all lazy-loaded images
	 * Skips canvas effects if user has accessibility preferences enabled
	 */
	init() {
		if (this.shouldDisableCanvasEffect()) {
			return;
		}

		const lazyImages = document.querySelectorAll('img[loading="lazy"]');
		lazyImages.forEach((img) => this.setupImage(img));
	}

	/**
	 * Check if canvas effects should be disabled based on user accessibility preferences
	 * Respects prefers-reduced-motion, prefers-reduced-transparency, prefers-contrast, and forced-colors
	 * @returns {boolean} True if effects should be disabled
	 */
	shouldDisableCanvasEffect() {
		return (
			window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
			window.matchMedia('(prefers-reduced-transparency: reduce)').matches ||
			window.matchMedia('(prefers-contrast: more)').matches ||
			window.matchMedia('(forced-colors: active)').matches
		);
	}

	/**
	 * Set up canvas placeholder for a single image
	 * Creates canvas overlay, initializes animation state, and starts placeholder animation
	 * @param {HTMLImageElement} img - The image element to enhance
	 */
	setupImage(img) {
		const wrapper = img.parentNode;
		wrapper.style.position = 'relative';
		const canvas = this.createCanvas(img, wrapper);

		const imageData = {
			img,
			wrapper,
			canvas,
			ctx: canvas.getContext('2d'),
			loaded: false,
			revealing: false,
			animationId: null,
			opacities: [],
			sourceCanvas: null,
			gridCache: new Map() // Cache grid dimensions per phase
		};

		this.images.push(imageData);

		img.style.opacity = '0';
		img.style.transition = 'none';

		const initCanvas = () => {
			const rect = wrapper.getBoundingClientRect();
			canvas.width = rect.width;
			canvas.height = rect.height;

			if (canvas.width > 0 && canvas.height > 0) {
				this.initOpacityMap(imageData);
				this.startAnimation(imageData);
				this.observeImage(imageData);
			} else {
				requestAnimationFrame(initCanvas);
			}
		};

		if (img.complete && img.naturalWidth > 0) {
			initCanvas();
		} else {
			img.addEventListener('load', initCanvas);
		}
	}

	/**
	 * Create canvas overlay for image placeholder
	 * Positions canvas to match image's object-position for proper visual alignment
	 * @param {HTMLImageElement} img - The image element
	 * @param {HTMLElement} wrapper - The parent wrapper element
	 * @returns {HTMLCanvasElement} The created canvas element
	 */
	createCanvas(img, wrapper) {
		const canvas = document.createElement('canvas');
		const aspect =
			img && img.style && img.style.aspectRatio
				? `aspect-ratio: ${img.style.aspectRatio};`
				: 'width: 100%;';

		const positionValues = this.getPositionFromObjectPosition(img);

		canvas.style.cssText = `
	  position: absolute;
	  top: ${positionValues.top};
	  left: ${positionValues.left};
	  bottom: ${positionValues.bottom};
	  right: ${positionValues.right};
	  filter: brightness(0.8);
	  ${aspect};
	  height: 100%;
	  ${positionValues.transform ? `transform: ${positionValues.transform};` : ''}
	`;

		wrapper.appendChild(canvas);

		return canvas;
	}

	/**
	 * Calculate canvas positioning to match image's object-position
	 * Ensures placeholder aligns with the actual image content area
	 * @param {HTMLImageElement} img - The image element
	 * @returns {Object} Position values (top, left, bottom, right, transform)
	 */
	getPositionFromObjectPosition(img) {
		const computedStyle = window.getComputedStyle(img);
		const objectPosition = computedStyle.objectPosition || 'left';

		// Check if object-position is explicitly set via CSS
		// Look for variant classes in parent hierarchy (e.g., hover-cards--variant-*)
		let hasObjectPositionCSSRule = img.style.objectPosition !== '';

		if (!hasObjectPositionCSSRule) {
			let parent = img.parentElement;
			while (parent && !hasObjectPositionCSSRule) {
				const classList = parent.getAttribute('class') || '';
				if (classList.includes('hover-cards--variant')) {
					hasObjectPositionCSSRule = true;
				}
				parent = parent.parentElement;
			}
		}

		// Only apply center transform if explicitly set to 'center' keyword
		const isCenterKeyword =
			hasObjectPositionCSSRule &&
			(objectPosition === 'center' || objectPosition === '50% 50%');

		const [horizontalPos, verticalPos = 'center'] = objectPosition.split(' ');

		let top = '0';
		let left = '0';
		let bottom = '0';
		let right = '0';
		let transform = '';

		// Horizontal alignment
		if (isCenterKeyword) {
			left = '50%';
			transform = 'translateX(-50%)';
		} else if (horizontalPos.includes('%')) {
			const xPercent = parseFloat(horizontalPos);
			if (xPercent > 50) {
				right = '0';
				left = 'auto';
			} else if (xPercent < 50) {
				left = '0';
				right = 'auto';
			} else {
				left = '0';
				right = '0';
			}
		} else if (horizontalPos === 'right') {
			right = '0';
			left = 'auto';
		} else {
			left = '0';
			right = 'auto';
		}

		// Vertical alignment
		if (verticalPos.includes('%')) {
			const yPercent = parseFloat(verticalPos);
			if (yPercent > 50) {
				bottom = '0';
				top = 'auto';
			} else if (yPercent < 50) {
				top = '0';
				bottom = 'auto';
			} else {
				top = '0';
				bottom = '0';
			}
		} else if (verticalPos === 'bottom') {
			bottom = '0';
			top = 'auto';
		} else if (verticalPos === 'center') {
			top = '0';
			bottom = '0';
		} else {
			top = '0';
			bottom = 'auto';
		}

		return { top, left, bottom, right, transform };
	}

	initOpacityMap(imageData) {
		const { canvas } = imageData;
		const { rows, cols } = this.getGridDimensions(canvas, 0);

		imageData.opacities = Array.from({ length: rows * cols }, () => this.getRandomOpacity());
	}

	/**
	 * Calculate grid dimensions for a given phase
	 * Cached per imageData to avoid redundant calculations
	 * @param {HTMLCanvasElement} canvas - The canvas element
	 * @param {number} phaseIndex - Current animation phase index
	 * @param {Object} imageData - Image data object with cache
	 * @returns {Object} Grid dimensions (cellWidth, cellHeight, cols, rows)
	 */
	getGridDimensions(canvas, phaseIndex, imageData = null) {
		// Use cache if available
		if (imageData?.gridCache?.has(phaseIndex)) {
			return imageData.gridCache.get(phaseIndex);
		}

		const pixelSize = this.config.pixelSizes[phaseIndex];
		const cellWidth = Math.max(1, Math.floor(canvas.width * pixelSize));
		const cellHeight = Math.max(1, Math.floor(canvas.height * pixelSize));
		const cols = Math.ceil(canvas.width / cellWidth);
		const rows = Math.ceil(canvas.height / cellHeight);

		const dimensions = { cellWidth, cellHeight, cols, rows };

		// Cache for future use
		if (imageData?.gridCache) {
			imageData.gridCache.set(phaseIndex, dimensions);
		}

		return dimensions;
	}

	getRandomOpacity() {
		const { placeholderMinOpacity, placeholderMaxOpacity, placeholderOpacityStep } =
			this.config;
		const steps =
			Math.round((placeholderMaxOpacity - placeholderMinOpacity) / placeholderOpacityStep) +
			1;
		const randomStep = Math.floor(Math.random() * steps);
		return placeholderMinOpacity + randomStep * placeholderOpacityStep;
	}

	startAnimation(imageData) {
		const animate = () => {
			if (imageData.revealing) return;

			// Keep updating placeholder until image starts revealing
			this.drawInitialPlaceholder(imageData);
			this.updateOpacities(imageData);

			imageData.animationId = setTimeout(animate, this.config.animationPlaceholderInterval);
		};

		animate();
	}

	updateOpacities(imageData) {
		for (let i = 0; i < imageData.opacities.length; i++) {
			imageData.opacities[i] = this.getRandomOpacity();
		}
	}

	/**
	 * Draw animated placeholder with randomized opacity pixels
	 * Creates a subtle shimmer effect while image loads
	 * @param {Object} imageData - Image data object
	 */
	drawInitialPlaceholder(imageData) {
		const { canvas, ctx, opacities } = imageData;
		const { cellWidth, cellHeight, cols, rows } = this.getGridDimensions(canvas, 0, imageData);

		ctx.clearRect(0, 0, canvas.width, canvas.height);

		for (let row = 0; row < rows; row++) {
			for (let col = 0; col < cols; col++) {
				const x = col * cellWidth;
				const y = row * cellHeight;
				const idx = row * cols + col;
				const opacity = opacities[idx];

				ctx.fillStyle = `rgba(255, 255, 255, ${opacity})`;
				ctx.fillRect(x, y, cellWidth, cellHeight);
			}
		}
	}

	observeImage(imageData) {
		const observer = new IntersectionObserver(
			(entries) => {
				entries.forEach((entry) => {
					if (entry.isIntersecting && !imageData.loaded) {
						this.triggerReveal(imageData);
					}
				});
			},
			{ threshold: this.config.viewportThreshold }
		);

		observer.observe(imageData.wrapper);
	}

	/**
	 * Trigger the reveal animation when image enters viewport
	 * Waits for image to load, then transitions from placeholder to full image
	 * @param {Object} imageData - Image data object
	 */
	async triggerReveal(imageData) {
		imageData.loaded = true;

		const { img } = imageData;
		if (!img.complete) {
			await new Promise((resolve) => {
				img.addEventListener('load', resolve, { once: true });
			});
		}

		await new Promise((resolve) => setTimeout(resolve, this.config.revealDelay));

		imageData.revealing = true;
		clearTimeout(imageData.animationId);

		try {
			this.prepareSourceCanvas(imageData);
			await this.animateReveal(imageData);
			this.finishReveal(imageData);
		} catch {
			// Cleanup on error
			if (imageData.sourceCanvas) {
				imageData.sourceCanvas = null;
			}
			if (imageData.canvas) {
				imageData.canvas.remove();
			}
			img.style.opacity = '1';
		}
	}

	prepareSourceCanvas(imageData) {
		const { img, canvas } = imageData;

		imageData.sourceCanvas = document.createElement('canvas');
		imageData.sourceCanvas.width = canvas.width;
		imageData.sourceCanvas.height = canvas.height;

		const sourceCtx = imageData.sourceCanvas.getContext('2d');
		sourceCtx.drawImage(img, 0, 0, canvas.width, canvas.height);
	}

	async animateReveal(imageData) {
		for (let phase = 0; phase < this.config.pixelSizes.length; phase++) {
			this.drawBlendedReveal(imageData, phase);
			await new Promise((resolve) => setTimeout(resolve, this.config.animationInterval));
		}
	}

	/**
	 * Draw blended reveal animation combining placeholder and image
	 * Progressively transitions from coarse pixelated placeholder to full resolution image
	 * @param {Object} imageData - Image data object
	 * @param {number} phaseIndex - Current animation phase
	 */
	drawBlendedReveal(imageData, phaseIndex) {
		const { canvas, ctx, sourceCanvas, opacities } = imageData;
		const sourceCtx = sourceCanvas.getContext('2d');
		const {
			cellWidth: placeholderCellWidth,
			cellHeight: placeholderCellHeight,
			cols: placeholderCols,
			rows: _placeholderRows
		} = this.getGridDimensions(canvas, 0, imageData);
		const {
			cellWidth: imageCellWidth,
			cellHeight: imageCellHeight,
			cols: imageCols,
			rows: imageRows
		} = this.getGridDimensions(canvas, phaseIndex, imageData);

		ctx.clearRect(0, 0, canvas.width, canvas.height);

		const totalPhases = this.config.pixelSizes.length;
		const phaseProgress = phaseIndex / (totalPhases - 1);
		const blendWeight = phaseProgress;

		// Calculate blending values inline (replaces getPhaseBlending)
		const { startImageOpacity, endImageOpacity, whiteBlendFactor } = this.config;
		const imageOpacity =
			startImageOpacity + phaseProgress * (endImageOpacity - startImageOpacity);
		const whiteMix = (1 - phaseProgress) * whiteBlendFactor;

		this.updateOpacities(imageData);

		// Placeholder subdivides progressively as reveal advances
		const placeholderPhaseIndex = Math.floor(blendWeight * (totalPhases - 1));
		const {
			cellWidth: currentCellWidth,
			cellHeight: currentCellHeight,
			cols: currentCols,
			rows: currentRows
		} = this.getGridDimensions(canvas, placeholderPhaseIndex, imageData);

		// Draw placeholder base with progressively finer grid
		for (let row = 0; row < currentRows; row++) {
			for (let col = 0; col < currentCols; col++) {
				const x = col * currentCellWidth;
				const y = row * currentCellHeight;

				// Map to original placeholder grid for opacity values
				const placeholderColIndex = Math.floor(x / placeholderCellWidth);
				const placeholderRowIndex = Math.floor(y / placeholderCellHeight);
				const placeholderIdx = placeholderRowIndex * placeholderCols + placeholderColIndex;
				const placeholderOpacity =
					placeholderIdx < opacities.length ? opacities[placeholderIdx] : 0;

				// Sample pixel at cell center
				const sampleX = Math.min(x + currentCellWidth / 2, canvas.width - 1);
				const sampleY = Math.min(y + currentCellHeight / 2, canvas.height - 1);
				const pixel = sourceCtx.getImageData(sampleX, sampleY, 1, 1).data;

				// Apply white blending for softer appearance
				const r = pixel[0] * (1 - whiteMix) + 255 * whiteMix;
				const g = pixel[1] * (1 - whiteMix) + 255 * whiteMix;
				const b = pixel[2] * (1 - whiteMix) + 255 * whiteMix;

				// Blend from white to image color
				const finalR = (1 - blendWeight) * 255 + blendWeight * r;
				const finalG = (1 - blendWeight) * 255 + blendWeight * g;
				const finalB = (1 - blendWeight) * 255 + blendWeight * b;

				// Fade out placeholder opacity near end of animation
				const baseOpacity = Math.max(
					0,
					(1 - Math.max(0, blendWeight - 0.7) * 3.33) * placeholderOpacity
				);

				ctx.fillStyle = `rgba(${finalR}, ${finalG}, ${finalB}, ${baseOpacity})`;
				ctx.fillRect(x, y, currentCellWidth, currentCellHeight);
			}
		}

		// Overlay progressively finer image detail
		for (let row = 0; row < imageRows; row++) {
			for (let col = 0; col < imageCols; col++) {
				const x = col * imageCellWidth;
				const y = row * imageCellHeight;

				if (x >= canvas.width || y >= canvas.height) {
					continue;
				}

				const sampleX = Math.min(x + imageCellWidth / 2, canvas.width - 1);
				const sampleY = Math.min(y + imageCellHeight / 2, canvas.height - 1);
				const pixel = sourceCtx.getImageData(sampleX, sampleY, 1, 1).data;

				const r = pixel[0] * (1 - whiteMix) + 255 * whiteMix;
				const g = pixel[1] * (1 - whiteMix) + 255 * whiteMix;
				const b = pixel[2] * (1 - whiteMix) + 255 * whiteMix;

				// Image fades in smoothly
				const finalOpacity = Math.min(
					1,
					Math.max(0, (blendWeight - 0.1) * 1.2) * imageOpacity
				);

				ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${finalOpacity})`;
				ctx.fillRect(x, y, imageCellWidth, imageCellHeight);
			}
		}
	}

	/**
	 * Complete the reveal animation and clean up
	 * Removes canvas overlay and restores image to normal state
	 * @param {Object} imageData - Image data object
	 */
	finishReveal(imageData) {
		const { canvas, img } = imageData;

		img.style.opacity = '1';
		canvas.remove();
		imageData.sourceCanvas = null;
		imageData.gridCache?.clear();

		// Use global afterPaint helper (defined in script.js)
		if (typeof afterPaint === 'function') {
			afterPaint(() => {
				img.style.removeProperty('transition');
			});
		} else {
			// Fallback if afterPaint not available
			requestAnimationFrame(() => {
				requestAnimationFrame(() => {
					img.style.removeProperty('transition');
				});
			});
		}
	}
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', initializeImageLoader);
} else {
	initializeImageLoader();
}

function initializeImageLoader() {
	new PixelatedImageLoader({
		pixelSizes: [0.08, 0.06, 0.03, 0.015, 0.0075, 0.00375],
		animationPlaceholderInterval: 500,
		animationInterval: 50,
		placeholderMinOpacity: 0.15,
		placeholderMaxOpacity: 0.45,
		placeholderOpacityStep: 0.15,
		viewportThreshold: 0.25,
		revealDelay: 0,
		startImageOpacity: 0.45,
		endImageOpacity: 1.0,
		whiteBlendFactor: 0.75
	});
}
