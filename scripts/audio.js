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
 * Epic Cinematic Ambient Music Generator
 *
 * This module procedurally generates an infinite, non-looping ambient soundtrack
 * using the Web Audio API. It blends "heroic" intervals (inspired by Star Trek)
 * with rhythmic tension (inspired by Mission Impossible) to create a unique
 * sonic identity for the website.
 *
 * Architecture:
 * - Uses the Module Pattern (IIFE) to encapsulate state and expose a public API.
 * - Generates audio in real-time using Oscillators (sound sources) and GainNodes (volume control).
 * - Implements a "stateless" scheduling system where each note schedules the next,
 *   allowing for infinite variation without memory leaks.
 */
window.App = window.App || {}

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
    let ctx = null

    /**
     * The Master Gain Node acts as the main volume control for the entire application.
     * All sound sources connect to this node before going to the destination (speakers).
     * This allows us to fade all audio in/out simultaneously.
     * @type {GainNode|null}
     */
    let masterGainNode = null

    /**
     * Timer ID for the stop sequence.
     * Used to cancel a pending stop if the user restarts audio quickly.
     * @type {number|null}
     */
    let stopTimer = null

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
        currentTheme: 'mission', // Options: 'original', 'mission'

        // Shared settings across themes
        shared: {
            chordTriad: [0, 4, 7], // Major triad (Root, Major 3rd, Perfect 5th) for the background pad
            padFadeIn: 1.5,        // Seconds to fade in
            padSustain: 3.0,       // Seconds to hold full volume
            padFadeOut: 1.5        // Seconds to fade out
        },

        // Theme-specific configurations
        themes: {
            original: {
                scale: [0, 2, 4, 7, 9], // Major Pentatonic Scale
                rhythm: [0, 0.75, 1.5, 2.25, 3.4], // Syncopated rhythm
                waveform: 'triangle',   // Softer, flute-like sound
                filter: false,
                pad: {
                    repeatInterval: 5000,
                    randomDelay: 500    // Adds organic irregularity
                },
                melody: {
                    volume: 0.3,
                    attackTime: 0.08,
                    decayTime: 0.37,
                    releaseTime: 0.35,
                    noteLength: 0.85,
                    repeatInterval: 3600,
                    panAmount: 0.2
                },
                choices: [
                    { scaleIndex: 0, weight: 0.30 }, // Root
                    { scaleIndex: 2, weight: 0.25 }, // Maj 3rd
                    { scaleIndex: 4, weight: 0.25 }, // Maj 6th
                    { scaleIndex: 3, weight: 0.20 }  // P5
                ]
            },
            mission: {
                // Hybrid Scale: Root, m3, P4, Tritone, P5, Maj6, Octave
                // Blends minor spy tension with heroic major intervals
                scale: [0, 3, 5, 6, 7, 9, 12],
                rhythm: [0, 1.1, 2.2, 2.8, 3.2], // 5/4-ish "Mission" feel
                waveform: 'sawtooth',   // Brighter, brassier sound
                filter: true,           // Lowpass filter for "analog synth" feel
                pad: {
                    repeatInterval: 4000, // Locked to melody loop for tightness
                    randomDelay: 0        // Strict timing
                },
                melody: {
                    volume: 0.35,
                    attackTime: 0.02,     // Sharp attack for punchiness
                    decayTime: 0.15,      // Quick decay for percussive feel
                    releaseTime: 0.2,
                    noteLength: 0.8,
                    repeatInterval: 4000,
                    panAmount: 0.2
                },
                choices: [
                    { scaleIndex: 0, weight: 0.25 }, // Root
                    { scaleIndex: 1, weight: 0.10 }, // m3 (Tension)
                    { scaleIndex: 3, weight: 0.10 }, // Tritone (Spy feel)
                    { scaleIndex: 4, weight: 0.30 }, // P5 (Heroic)
                    { scaleIndex: 5, weight: 0.20 }, // Maj6 (Heroic/Hopeful)
                    { scaleIndex: 6, weight: 0.05 }  // Octave
                ]
            }
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
    })

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
        return CONFIG.rootFrequency * Math.pow(2, semitones / 12)
    }

    /**
     * Selects a note based on the current theme's weighted probabilities.
     * This creates a "controlled random" melody that adheres to the theme's character.
     *
     * @param {Object} theme - The theme configuration object.
     * @returns {number} The selected semitone interval.
     */
    function selectNote(theme) {
        const rand = Math.random()
        let cumulative = 0
        const choices = theme.choices
        const scale = theme.scale

        for (const choice of choices) {
            cumulative += choice.weight
            if (rand < cumulative) {
                return scale[choice.scaleIndex]
            }
        }

        return scale[0] // Fallback to root if something goes wrong
    }

    /**
     * Determines the specific note for a step in the melody sequence.
     * Encapsulates the compositional logic (e.g., "start stable, rise up, end with tension").
     *
     * @param {string} themeName - The name of the current theme.
     * @param {Object} themeConfig - The configuration object for the theme.
     * @param {number} stepIndex - The current step index in the rhythm pattern.
     * @returns {number} The selected semitone interval.
     */
    function getNoteForStep(themeName, themeConfig, stepIndex) {
        if (themeName === 'mission') {
            // Compositional Logic for "Mission" Theme:
            // 1. Anchor: Start on a stable note (Root or P5).
            // 2. Rise: Jump up to a heroic interval (P5, Maj6, Octave).
            // 3. Sustain: Hold the high note or move to a related stable tone.
            // 4/5. Tension: Resolve or add spy-like tension (m3, Tritone).

            if (stepIndex === 0) {
                // Beat 1: Anchor
                return Math.random() > 0.4 ? 0 : 7
            } else if (stepIndex === 1) {
                // Beat 2: Rise!
                const riseOptions = [7, 9, 12]
                return riseOptions[Math.floor(Math.random() * riseOptions.length)]
            } else if (stepIndex === 2) {
                // Beat 3: Sustain
                return Math.random() > 0.5 ? 9 : 7
            } else {
                // Beats 4, 5: Tension/Resolution
                return selectNote(themeConfig)
            }
        }

        // Default random logic for other themes
        return selectNote(themeConfig)
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
        if (!ctx || !masterGainNode) return

        const currentTheme = CONFIG.themes[CONFIG.currentTheme] || CONFIG.themes.mission
        const padConfig = currentTheme.pad
        const now = ctx.currentTime
        const out = ctx.createGain()
        out.gain.value = CONFIG.masterVolume
        out.connect(masterGainNode)

        const totalDuration = CONFIG.shared.padFadeIn + CONFIG.shared.padSustain + CONFIG.shared.padFadeOut

        CONFIG.shared.chordTriad.forEach(interval => {
            const osc = ctx.createOscillator()
            const gain = ctx.createGain()

            // Sine waves provide a pure, fundamental tone ideal for pads
            osc.type = "sine"
            osc.frequency.value = getFrequency(interval)

            // ADSR Envelope Implementation
            // 1. Start at 0 volume
            gain.gain.setValueAtTime(0, now)
            // 2. Attack: Ramp up to full volume
            gain.gain.linearRampToValueAtTime(
                0.25, // Target volume
                now + CONFIG.shared.padFadeIn
            )
            // 3. Sustain: Slightly dip volume to create movement
            gain.gain.linearRampToValueAtTime(
                0.25 * 0.33,
                now + CONFIG.shared.padFadeIn + CONFIG.shared.padSustain
            )
            // 4. Release: Fade out to 0
            gain.gain.linearRampToValueAtTime(
                0,
                now + totalDuration
            )

            osc.connect(gain)
            gain.connect(out)

            osc.start(now)
            // Stop oscillator slightly after fade out to ensure silence
            osc.stop(now + totalDuration + 0.2)
        })

        // Schedule next pad iteration
        // Adding randomness creates an organic, non-mechanical feel
        const nextDelay = padConfig.repeatInterval + Math.random() * padConfig.randomDelay
        setTimeout(createPad, nextDelay)
    }

    /**
     * Generates a melodic phrase based on the defined rhythm pattern.
     *
     * Technical Details:
     * - Iterates through the rhythm array to schedule notes in the future.
     * - Uses a BiquadFilterNode (Lowpass) for the "Mission" theme to soften the sawtooth wave.
     * - Uses a StereoPannerNode to add spatial width.
     */
    function createMelody() {
        if (!ctx || !masterGainNode) return

        const themeName = CONFIG.currentTheme
        const currentTheme = CONFIG.themes[themeName] || CONFIG.themes.mission
        const melodyConfig = currentTheme.melody
        const now = ctx.currentTime
        const out = ctx.createGain()
        out.gain.value = CONFIG.masterVolume
        out.connect(masterGainNode)

        currentTheme.rhythm.forEach((timeOffset, index) => {
            const t = now + timeOffset
            const semitones = getNoteForStep(themeName, currentTheme, index)
            const freq = getFrequency(semitones)

            const osc = ctx.createOscillator()
            const gain = ctx.createGain()
            const pan = ctx.createStereoPanner()

            osc.type = currentTheme.waveform
            osc.frequency.setValueAtTime(freq, t)

            // Signal Chain: Oscillator -> [Filter] -> Gain -> Pan -> Master
            let source = osc

            // Apply Lowpass Filter (if enabled)
            // This mimics an analog synthesizer where the filter opens and closes
            if (currentTheme.filter) {
                const filter = ctx.createBiquadFilter()
                filter.type = "lowpass"
                // Filter Envelope: "Wow" effect (opens up then closes)
                filter.frequency.setValueAtTime(800, t)
                filter.frequency.exponentialRampToValueAtTime(200, t + melodyConfig.noteLength)
                osc.connect(filter)
                source = filter
            }

            // Volume Envelope (ADSR)
            gain.gain.setValueAtTime(0, t)
            // Attack
            gain.gain.linearRampToValueAtTime(
                melodyConfig.volume,
                t + melodyConfig.attackTime
            )
            // Decay
            gain.gain.linearRampToValueAtTime(
                melodyConfig.volume * 0.6,
                t + melodyConfig.attackTime + melodyConfig.decayTime
            )
            // Release
            gain.gain.linearRampToValueAtTime(
                0,
                t + melodyConfig.noteLength
            )

            // Spatialisation: Randomly pan slightly left or right
            pan.pan.value = (Math.random() * 2 - 1) * melodyConfig.panAmount

            source.connect(gain)
            gain.connect(pan)
            pan.connect(out)

            osc.start(t)
            osc.stop(t + melodyConfig.noteLength)
        })

        // Schedule next melody loop
        setTimeout(createMelody, melodyConfig.repeatInterval)
    }

    /**
     * Plays a synthesized sound effect (SFX).
     * Used for UI interactions like hovering and clicking.
     *
     * @param {string} type - The type of SFX to play ('hover' or 'click').
     */
    function playSFX(type) {
        // Only play if audio context is running (user has interacted)
        if (!ctx || ctx.state !== 'running' || !masterGainNode) return

        const sfxConfig = CONFIG.sfx[type]
        if (!sfxConfig) return

        const now = ctx.currentTime
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()

        osc.type = sfxConfig.type
        osc.frequency.setValueAtTime(sfxConfig.frequency, now)

        // Pitch Envelope: Rapidly drop pitch to create a "chirp" or "thud"
        if (sfxConfig.pitchEndRatio) {
            osc.frequency.exponentialRampToValueAtTime(
                sfxConfig.frequency * sfxConfig.pitchEndRatio,
                now + sfxConfig.duration
            )
        }

        // Volume Envelope: Quick fade out
        gain.gain.setValueAtTime(sfxConfig.volume, now)
        gain.gain.exponentialRampToValueAtTime(0.001, now + sfxConfig.duration)

        osc.connect(gain)
        gain.connect(masterGainNode)

        osc.start(now)
        osc.stop(now + sfxConfig.duration)
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
            clearTimeout(stopTimer)
            stopTimer = null
        }

        if (!ctx) {
            try {
                // Create new AudioContext (standard or webkit prefix for Safari)
                ctx = new (window.AudioContext || window.webkitAudioContext)()
                masterGainNode = ctx.createGain()
                masterGainNode.connect(ctx.destination)

                // Fade In: Avoid popping by ramping volume up
                masterGainNode.gain.value = 0
                masterGainNode.gain.setTargetAtTime(1, ctx.currentTime, 1)

                // Begin generative loops
                createPad()
                createMelody()
            } catch (e) {
                console.error('Audio start failed:', e)
            }
        } else {
            // Resume context if it was suspended by the browser
            if (ctx.state === 'suspended') {
                ctx.resume()
            }

            // Fade back in if we were fading out
            if (masterGainNode) {
                masterGainNode.gain.cancelScheduledValues(ctx.currentTime)
                masterGainNode.gain.setTargetAtTime(1, ctx.currentTime, 1)
            }
        }
    }

    /**
     * Stops the audio engine.
     * Fades out volume and closes the AudioContext to save resources.
     */
    function stop() {
        if (ctx && masterGainNode) {
            // Fade Out: Smooth silence
            masterGainNode.gain.cancelScheduledValues(ctx.currentTime)
            masterGainNode.gain.setTargetAtTime(0, ctx.currentTime, 0.5)

            // Close context after fade out completes
            // This releases system audio hardware resources
            stopTimer = setTimeout(() => {
                if (ctx) {
                    ctx.close()
                    ctx = null
                    masterGainNode = null
                }
            }, 2500)
        }
    }

    /**
     * Initialises the audio module.
     * Sets up event listeners for UI controls and user interactions.
     */
    function init() {
        const ambienceCheckbox = document.getElementById('ambience')
        if (!ambienceCheckbox) return

        // Restore user preference from localStorage
        const savedState = localStorage.getItem('audio-ambience')
        if (savedState === 'true') {
            ambienceCheckbox.checked = true
            // Attempt to start. Note: Browsers may block this until user interaction.
            start()
        } else {
            ambienceCheckbox.checked = false
        }

        // Toggle audio on checkbox change
        ambienceCheckbox.addEventListener('change', () => {
            localStorage.setItem('audio-ambience', ambienceCheckbox.checked)
            if (ambienceCheckbox.checked) {
                start()
            } else {
                stop()
            }
        })

        // Global Event Delegation for SFX
        // We use delegation to handle dynamically added elements efficiently

        // Hover Sounds (mouseenter)
        // Use capture phase (true) to detect entry into children of the document
        document.addEventListener('mouseenter', (e) => {
            if (e.target.matches && e.target.matches('a, button, input, label, [tabindex], summary')) {
                playSFX('hover')
            }
        }, true)

        // Focus Sounds (Keyboard Navigation)
        document.addEventListener('focus', (e) => {
            if (e.target.matches && e.target.matches('a, button, input, label, [tabindex], summary')) {
                playSFX('hover')
            }
        }, true)

        // Click Sounds
        document.addEventListener('click', (e) => {
            if (e.target.closest('a, button, input, label, [tabindex], summary')) {
                playSFX('click')
            }
        })
    }

    // Auto-initialise when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init)
    } else {
        init()
    }

    // Expose public methods
    return {
        start,
        stop
    }
})()
