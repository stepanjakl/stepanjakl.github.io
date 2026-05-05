/*!
 * Personal website of Štěpán Jákl
 * https://stepanjakl.com
 *
 * Copyright © 2025 Štěpán Jákl
 * Released under the MIT license
 * https://github.com/stepanjakl/stepanjakl.github.io/blob/main/LICENSE
 */

// ============================================================================
// Audio Manager
// ============================================================================

/**
 * Sophisticated Cinematic Ambient Music Generator
 *
 * This module procedurally generates an infinite, non-looping ambient soundtrack
 * using the Web Audio API. It creates a mature, contemplative atmosphere that is
 * both uplifting and serious, combining heroic intervals with sophisticated
 * jazz-influenced harmony (Maj7, Maj9) to establish a unique sonic identity
 * for the website.
 *
 * Musical Character:
 * - Warm sine wave tones for a pure, acoustic feel
 * - Deliberate phrasing with restrained melodic movement
 * - Rich harmonic palette including 7ths and 9ths for sophistication
 * - Grounded foundation with occasional depth (notes below root)
 * - Natural exponential envelopes mimicking acoustic instruments
 *
 * Architecture:
 * - Uses the Module Pattern (IIFE) to encapsulate state and expose a public API
 * - Generates audio in real-time using Oscillators (sound sources) and GainNodes (volume control)
 * - Implements a "stateless" scheduling system where each note schedules the next,
 *   allowing for infinite variation without memory leaks
 */
window.App = window.App || {};

App.audio = (function () {
	// ============================================================================
	// Private State
	// ============================================================================

	/**
	 * The AudioContext is the primary interface for the Web Audio API.
	 * It represents an audio-processing graph built from audio modules linked together.
	 * We initialise it lazily (on first user interaction) to comply with browser autoplay policies.
	 * @type {AudioContext|null}
	 */
	let ctx = null;

	/**
	 * The Master Gain Node acts as the main volume control for the entire application.
	 * All sound sources connect to this node before going to the destination (speakers).
	 * This allows us to fade all audio in/out simultaneously.
	 * @type {GainNode|null}
	 */
	let masterGainNode = null;

	/**
	 * Timer ID for the stop sequence.
	 * Used to cancel a pending stop if the user restarts audio quickly.
	 * @type {number|null}
	 */
	let stopTimer = null;

	/**
	 * Timer IDs for the generative loops.
	 * Used to cancel scheduled iterations when stopping audio.
	 * @type {number|null}
	 */
	let padTimerId = null;
	let melodyTimerId = null;

	// ============================================================================
	// Configuration
	// ============================================================================

	/**
	 * Centralised configuration object.
	 * Defines the musical rules, timing, and sound characteristics.
	 * Frozen to prevent accidental runtime modifications.
	 */
	const CONFIG = Object.freeze({
		masterVolume: 0.25,
		rootFrequency: 220, // A3 - The tonal centre of our piece

		rhythm: [0, 0.6, 1.3, 2.1, 3.0, 3.7, 4.3], // Slower, more deliberate 5-second phrase
		waveform: 'sine', // Warm, pure tone for sophistication

		// Background pad settings
		pad: {
			chordTriad: [0, 4, 7], // Major triad (Root, Major 3rd, Perfect 5th)
			fadeIn: 1.5, // Seconds to fade in
			sustain: 3.0, // Seconds to hold full volume
			fadeOut: 1.5, // Seconds to fade out
			repeatInterval: 6000, // Slower, more spacious
			randomDelay: 200 // Subtle organic variation
		},

		// Melody settings
		melody: {
			volume: 0.28, // Slightly quieter for subtlety
			attackTime: 0.05, // Gentler attack for maturity
			decayTime: 0.35, // Longer decay for richness
			releaseTime: 0.4, // Extended release for smoothness
			noteLength: 1.2, // Longer notes for gravity
			repeatInterval: 5000, // Matches rhythm duration
			panAmount: 0.15 // Subtle panning for focus
		},

		// UI Sound Effects
		sfx: {
			hover: {
				frequency: 1200,
				type: 'sine',
				duration: 0.05,
				volume: 0.1,
				pitchEndRatio: 0.5 // Pitch drops to 50% (chirp effect)
			},
			click: {
				frequency: 600,
				type: 'triangle',
				duration: 0.3,
				volume: 0.175,
				pitchEndRatio: 0.1 // Pitch drops drastically (thud effect)
			}
		}
	});

	const INTERACTIVE_SELECTOR = 'a, button, input, label, [tabindex], summary';

	// ============================================================================
	// Helper Functions
	// ============================================================================

	/**
	 * Calculates the frequency (in Hz) for a given musical interval from the root note.
	 * Uses the 12-tone equal temperament formula: f = f0 * (2)^(n/12)
	 *
	 * @param {number} semitones - The number of semitones from the root frequency.
	 * @returns {number} The calculated frequency in Hertz.
	 */
	function getFrequency(semitones) {
		return CONFIG.rootFrequency * Math.pow(2, semitones / 12);
	}

	/**
	 * Determines the specific note for a step in the melody sequence.
	 * Implements compositional logic to create a sophisticated 7-beat phrase
	 * with restrained movement and serious character.
	 *
	 * @param {number} stepIndex - The current step index in the rhythm pattern.
	 * @returns {number} The selected semitone interval.
	 */
	function getNoteForStep(stepIndex) {
		// Compositional Logic (7-beat mature phrase):
		// 1. Foundation: Start grounded (Root or lower P4)
		// 2. Establish: Build foundation (Root, P4, or P5)
		// 3. Develop: Gradual upward movement (P5 or Maj6)
		// 4. Peak: Subtle high point (Maj6, Maj7, or Maj9 - no childish octaves)
		// 5. Reflect: Contemplative descent (P5 or Maj6)
		// 6. Resolve: Return to stability (Root or P5)
		// 7. Close: Final grounded statement (Root or P4)

		if (stepIndex === 0) {
			// Beat 1: Foundation - Grounded start
			const r = Math.random();
			if (r > 0.7) return -5; // P4 below for depth
			return r > 0.3 ? 0 : 5; // Root or P4
		} else if (stepIndex === 1) {
			// Beat 2: Establish - Build foundation
			return Math.random() > 0.5 ? 0 : 7;
		} else if (stepIndex === 2) {
			// Beat 3: Develop - Gradual rise
			return Math.random() > 0.4 ? 7 : 9;
		} else if (stepIndex === 3) {
			// Beat 4: Peak - Sophisticated high point (no octave jumps)
			const r = Math.random();
			if (r > 0.8) return 14; // Maj9 for rare sparkle
			if (r > 0.5) return 11; // Maj7 for sophistication
			return 9; // Maj6 for heroic warmth
		} else if (stepIndex === 4) {
			// Beat 5: Reflect - Thoughtful descent
			return Math.random() > 0.5 ? 9 : 7;
		} else if (stepIndex === 5) {
			// Beat 6: Resolve - Return home
			return Math.random() > 0.4 ? 0 : 7;
		} else {
			// Beat 7: Close - Grounded conclusion
			const r = Math.random();
			if (r > 0.7) return 3; // m3 for subtle melancholy
			if (r > 0.4) return 5; // P4 for strength
			return 0; // Root for finality
		}
	}

	function isInteractiveElement(element) {
		return element.matches?.(INTERACTIVE_SELECTOR) && element.getAttribute('tabindex') !== '-1';
	}

	function getSavedAmbienceState() {
		try {
			return localStorage.getItem('audio-ambience');
		} catch (error) {
			console.warn('Failed to load audio preference:', error);
			return null;
		}
	}

	function saveAmbienceState(isEnabled) {
		try {
			localStorage.setItem('audio-ambience', isEnabled);
		} catch (error) {
			console.warn('Failed to save audio preference:', error);
		}
	}

	// ============================================================================
	// Audio Generation
	// ============================================================================

	/**
	 * Creates a lush, sustaining background pad using a chord triad.
	 *
	 * Technical Details:
	 * - Creates 3 oscillators (one for each note in the triad).
	 * - Uses an ADSR (Attack, Decay, Sustain, Release) envelope to shape the volume.
	 * - Schedules the *next* pad iteration recursively via setTimeout.
	 */
	function createPad() {
		if (!ctx || !masterGainNode || padTimerId === null) return;

		const now = ctx.currentTime;
		const out = ctx.createGain();
		out.gain.value = CONFIG.masterVolume;
		out.connect(masterGainNode);

		const totalDuration = CONFIG.pad.fadeIn + CONFIG.pad.sustain + CONFIG.pad.fadeOut;

		CONFIG.pad.chordTriad.forEach((interval) => {
			const osc = ctx.createOscillator();
			const gain = ctx.createGain();

			// Sine waves provide a pure, fundamental tone ideal for pads
			osc.type = 'sine';
			osc.frequency.value = getFrequency(interval);

			// ADSR Envelope Implementation
			// 1. Start at 0 volume
			gain.gain.setValueAtTime(0, now);
			// 2. Attack: Ramp up to full volume
			gain.gain.linearRampToValueAtTime(
				0.25, // Target volume
				now + CONFIG.pad.fadeIn
			);
			// 3. Sustain: Slightly dip volume to create movement
			gain.gain.linearRampToValueAtTime(
				0.25 * 0.33,
				now + CONFIG.pad.fadeIn + CONFIG.pad.sustain
			);
			// 4. Release: Fade out to 0
			gain.gain.linearRampToValueAtTime(0, now + totalDuration);

			osc.connect(gain);
			gain.connect(out);

			osc.start(now);
			// Stop oscillator slightly after fade out to ensure silence
			osc.stop(now + totalDuration + 0.2);
		});

		// Schedule next pad iteration
		// Adding randomness creates an organic, non-mechanical feel
		const nextDelay = CONFIG.pad.repeatInterval + Math.random() * CONFIG.pad.randomDelay;
		padTimerId = setTimeout(createPad, nextDelay);
	}

	/**
	 * Generates a melodic phrase based on the defined rhythm pattern.
	 *
	 * Technical Details:
	 * - Iterates through the rhythm array to schedule notes in the future.
	 * - Uses a StereoPannerNode to add spatial width.
	 */
	function createMelody() {
		if (!ctx || !masterGainNode || melodyTimerId === null) return;

		const now = ctx.currentTime;
		const out = ctx.createGain();
		out.gain.value = CONFIG.masterVolume;
		out.connect(masterGainNode);

		CONFIG.rhythm.forEach((timeOffset, index) => {
			const t = now + timeOffset;
			const semitones = getNoteForStep(index);
			const freq = getFrequency(semitones);

			const osc = ctx.createOscillator();
			const gain = ctx.createGain();
			const pan = ctx.createStereoPanner();

			osc.type = CONFIG.waveform;
			osc.frequency.setValueAtTime(freq, t);

			// Volume Envelope (ADSR) - Exponential for natural sound
			gain.gain.setValueAtTime(0.001, t);
			// Attack - Exponential rise for organic feel
			gain.gain.exponentialRampToValueAtTime(
				CONFIG.melody.volume,
				t + CONFIG.melody.attackTime
			);
			// Decay - Gentle decline to sustain level
			gain.gain.exponentialRampToValueAtTime(
				CONFIG.melody.volume * 0.65,
				t + CONFIG.melody.attackTime + CONFIG.melody.decayTime
			);
			// Release - Natural fade out
			gain.gain.exponentialRampToValueAtTime(0.001, t + CONFIG.melody.noteLength);

			// Spatialisation: Randomly pan slightly left or right
			pan.pan.value = (Math.random() * 2 - 1) * CONFIG.melody.panAmount;

			osc.connect(gain);
			gain.connect(pan);
			pan.connect(out);

			osc.start(t);
			osc.stop(t + CONFIG.melody.noteLength);
		});

		// Schedule next melody loop
		melodyTimerId = setTimeout(createMelody, CONFIG.melody.repeatInterval);
	}

	/**
	 * Plays a synthesized sound effect (SFX).
	 * Used for UI interactions like hovering and clicking.
	 *
	 * @param {string} type - The type of SFX to play ('hover' or 'click').
	 */
	function playSFX(type) {
		// Only play if audio context is running (user has interacted)
		if (!ctx || ctx.state !== 'running' || !masterGainNode) return;

		const sfxConfig = CONFIG.sfx[type];
		if (!sfxConfig) return;

		const now = ctx.currentTime;
		const osc = ctx.createOscillator();
		const gain = ctx.createGain();

		osc.type = sfxConfig.type;
		osc.frequency.setValueAtTime(sfxConfig.frequency, now);

		// Pitch Envelope: Rapidly drop pitch to create a "chirp" or "thud"
		if (sfxConfig.pitchEndRatio) {
			osc.frequency.exponentialRampToValueAtTime(
				sfxConfig.frequency * sfxConfig.pitchEndRatio,
				now + sfxConfig.duration
			);
		}

		// Volume Envelope: Quick fade out
		gain.gain.setValueAtTime(sfxConfig.volume, now);
		gain.gain.exponentialRampToValueAtTime(0.001, now + sfxConfig.duration);

		osc.connect(gain);
		gain.connect(masterGainNode);

		osc.start(now);
		osc.stop(now + sfxConfig.duration);
	}

	// ============================================================================
	// Public API
	// ============================================================================

	/**
	 * Starts the audio engine.
	 * Initialises the AudioContext if necessary and begins the generative loops.
	 */
	function start() {
		// Cancel any pending stop sequence
		if (stopTimer) {
			clearTimeout(stopTimer);
			stopTimer = null;
		}

		if (!ctx) {
			try {
				// Create new AudioContext (standard or webkit prefix for Safari)
				ctx = new (window.AudioContext || window.webkitAudioContext)();
				masterGainNode = ctx.createGain();
				masterGainNode.connect(ctx.destination);

				// Fade In: Avoid popping by ramping volume up
				masterGainNode.gain.value = 0;
				masterGainNode.gain.setTargetAtTime(1, ctx.currentTime, 1);

				// Begin generative loops (only if not already running)
				if (padTimerId === null) {
					padTimerId = 0; // Set to non-null to indicate running
					createPad();
				}
				if (melodyTimerId === null) {
					melodyTimerId = 0; // Set to non-null to indicate running
					createMelody();
				}
			} catch (e) {
				console.error('Audio start failed:', e);
			}
		} else {
			// Resume context if it was suspended by the browser
			if (ctx.state === 'suspended') {
				ctx.resume();
			}

			// Fade back in if we were fading out
			if (masterGainNode) {
				masterGainNode.gain.cancelScheduledValues(ctx.currentTime);
				masterGainNode.gain.setTargetAtTime(1, ctx.currentTime, 1);
			}

			// Restart loops if they were stopped
			if (padTimerId === null) {
				padTimerId = 0; // Set to non-null to indicate running
				createPad();
			}
			if (melodyTimerId === null) {
				melodyTimerId = 0; // Set to non-null to indicate running
				createMelody();
			}
		}
	}

	/**
	 * Stops the audio engine.
	 * Fades out volume and closes the AudioContext to save resources.
	 */
	function stop() {
		if (ctx && masterGainNode) {
			// Stop the generative loops by canceling scheduled timeouts
			if (padTimerId !== null) {
				clearTimeout(padTimerId);
				padTimerId = null;
			}
			if (melodyTimerId !== null) {
				clearTimeout(melodyTimerId);
				melodyTimerId = null;
			}

			// Fade Out: Smooth silence
			masterGainNode.gain.cancelScheduledValues(ctx.currentTime);
			masterGainNode.gain.setTargetAtTime(0, ctx.currentTime, 0.5);

			// Close context after fade out completes
			// This releases system audio hardware resources
			stopTimer = setTimeout(() => {
				if (ctx) {
					ctx.close();
					ctx = null;
					masterGainNode = null;
				}
			}, 2500);
		}
	}

	/**
	 * Initialises the audio module.
	 * Sets up event listeners for UI controls and user interactions.
	 */
	function init() {
		const ambienceCheckbox = document.getElementById('ambience');
		if (!ambienceCheckbox) return;

		// Restore user preference from localStorage
		const savedState = getSavedAmbienceState();
		if (savedState === 'true') {
			ambienceCheckbox.checked = true;
			// Attempt to start. Note: Browsers may block this until user interaction.
			start();
		} else {
			ambienceCheckbox.checked = false;
		}

		// Toggle audio on checkbox change
		ambienceCheckbox.addEventListener('change', () => {
			saveAmbienceState(ambienceCheckbox.checked);
			if (ambienceCheckbox.checked) {
				start();
			} else {
				stop();
			}
		});

		// Global Event Delegation for SFX
		// We use delegation to handle dynamically added elements efficiently

		// Hover Sounds (mouseenter)
		// Use capture phase (true) to detect entry into children of the document
		document.addEventListener(
			'mouseenter',
			(e) => {
				if (isInteractiveElement(e.target)) {
					playSFX('hover');
				}
			},
			true
		);

		// Focus Sounds (Keyboard Navigation)
		document.addEventListener(
			'focus',
			(e) => {
				if (isInteractiveElement(e.target)) {
					playSFX('hover');
				}
			},
			true
		);

		// Click Sounds
		document.addEventListener('click', (e) => {
			if (e.target.closest(INTERACTIVE_SELECTOR)) {
				playSFX('click');
			}
		});
	}

	// Auto-initialise when DOM is ready
	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', init);
	} else {
		init();
	}

	// Expose public methods
	return {
		start,
		stop
	};
})();
