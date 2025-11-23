/**
 * Session Player Module
 * Handles exercise session playback with timer, TTS, and wake lock
 */

const Player = (() => {
  let routine = null;
  let currentExerciseIndex = 0;
  let exerciseTimer = null;
  let sessionTimer = null;
  let wakeLock = null;
  let audioContext = null;
  let sessionStartTime = 0;
  let totalSessionTime = 0;
  let isPaused = false;

  // DOM elements
  let exerciseName;
  let exerciseTimerDisplay;
  let sessionTimeRemaining;
  let timerProgress;
  let cueList;
  let avoidTip;
  let currentExerciseNum;
  let totalExercises;
  let exitBtn;
  let stickmanSvg;

  /**
   * Initialize player
   */
  const init = () => {
    exerciseName = document.getElementById('exercise-name');
    exerciseTimerDisplay = document.getElementById('exercise-timer');
    sessionTimeRemaining = document.getElementById('session-time-remaining');
    timerProgress = document.getElementById('timer-progress');
    cueList = document.getElementById('cue-list');
    avoidTip = document.getElementById('avoid-tip');
    currentExerciseNum = document.getElementById('current-exercise-num');
    totalExercises = document.getElementById('total-exercises');
    exitBtn = document.getElementById('exit-session-btn');
    stickmanSvg = document.getElementById('stickman-svg');

    exitBtn.addEventListener('click', handleExit);

    // Initialize Web Audio API for chimes
    if (window.AudioContext || window.webkitAudioContext) {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
  };

  /**
   * Start a session
   */
  const startSession = async (routineData) => {
    routine = routineData;
    currentExerciseIndex = 0;
    sessionStartTime = Date.now();
    totalSessionTime = routine.totalDuration || routine.routine.reduce((sum, ex) => sum + ex.duration, 0);

    // Update UI
    totalExercises.textContent = routine.routine.length;

    // Request wake lock
    await requestWakeLock();

    // Start first exercise
    startExercise(0);

    // Start session timer
    startSessionTimer();
  };

  /**
   * Request wake lock to keep screen on
   */
  const requestWakeLock = async () => {
    try {
      if ('wakeLock' in navigator) {
        wakeLock = await navigator.wakeLock.request('screen');

        wakeLock.addEventListener('release', () => {
          console.log('Wake lock released');
        });

        console.log('Wake lock acquired');
      } else {
        console.warn('Wake Lock API not supported');
      }
    } catch (error) {
      console.error('Failed to acquire wake lock:', error);
    }
  };

  /**
   * Release wake lock
   */
  const releaseWakeLock = async () => {
    if (wakeLock) {
      try {
        await wakeLock.release();
        wakeLock = null;
      } catch (error) {
        console.error('Failed to release wake lock:', error);
      }
    }
  };

  /**
   * Start an exercise
   */
  const startExercise = (index) => {
    if (index >= routine.routine.length) {
      endSession();
      return;
    }

    currentExerciseIndex = index;
    const exercise = routine.routine[index];

    // Update UI
    exerciseName.textContent = exercise.name;
    currentExerciseNum.textContent = index + 1;

    // Update cues
    cueList.innerHTML = '';
    exercise.cues.forEach(cue => {
      const li = document.createElement('li');
      li.textContent = cue;
      cueList.appendChild(li);
    });

    avoidTip.textContent = exercise.avoid;

    // Update stickman
    Stickman.render(exercise.pose, stickmanSvg);

    // Announce exercise with TTS
    speak(exercise.name);

    // Play chime
    playChime();

    // Start exercise timer with voice cues
    startExerciseTimer(exercise.duration, exercise.cues);

    // Haptic feedback
    if (navigator.vibrate) {
      navigator.vibrate([50, 100, 50]);
    }
  };

  /**
   * Start exercise timer
   */
  const startExerciseTimer = (duration, cues = []) => {
    let timeRemaining = duration;
    const totalTime = duration;
    const circumference = 2 * Math.PI * 90; // Circle radius is 90

    // Schedule voice cues
    const cueTimings = [];
    if (cues && cues.length > 0) {
      // Speak first cue after 3 seconds
      if (duration > 5) {
        cueTimings.push({ time: totalTime - 3, cue: cues[0] });
      }
      // Speak second cue halfway through (if exercise is longer than 30 seconds)
      if (cues.length > 1 && duration > 30) {
        const halfwayTime = Math.floor(totalTime / 2);
        cueTimings.push({ time: halfwayTime, cue: cues[1] });
      }
    }

    const updateTimer = () => {
      if (isPaused) return;

      // Update display
      const minutes = Math.floor(timeRemaining / 60);
      const seconds = timeRemaining % 60;
      exerciseTimerDisplay.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;

      // Update progress circle
      const progress = (timeRemaining / totalTime);
      const offset = circumference * (1 - progress);
      timerProgress.style.strokeDashoffset = offset;

      // Check if we should speak a cue at this time
      const cueToSpeak = cueTimings.find(ct => ct.time === timeRemaining);
      if (cueToSpeak) {
        // Speak cue reminder
        speak(cueToSpeak.cue);
      }

      timeRemaining--;

      if (timeRemaining < 0) {
        clearInterval(exerciseTimer);
        startExercise(currentExerciseIndex + 1);
      }
    };

    // Initial update
    updateTimer();

    // Start interval
    exerciseTimer = setInterval(updateTimer, 1000);
  };

  /**
   * Start session timer
   */
  const startSessionTimer = () => {
    const updateSessionTimer = () => {
      if (isPaused) return;

      const elapsed = Math.floor((Date.now() - sessionStartTime) / 1000);
      const remaining = Math.max(0, totalSessionTime - elapsed);

      const minutes = Math.floor(remaining / 60);
      const seconds = remaining % 60;
      sessionTimeRemaining.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;

      if (remaining <= 0) {
        clearInterval(sessionTimer);
      }
    };

    // Initial update
    updateSessionTimer();

    // Start interval
    sessionTimer = setInterval(updateSessionTimer, 1000);
  };

  /**
   * End session
   */
  const endSession = async () => {
    // Clear timers
    if (exerciseTimer) clearInterval(exerciseTimer);
    if (sessionTimer) clearInterval(sessionTimer);

    // Release wake lock
    await releaseWakeLock();

    // Play completion chime
    playChime(880, 0.3); // Higher pitch for completion

    // Save session to history
    const metadata = JSON.parse(sessionStorage.getItem('routineMetadata') || '{}');
    const sessionData = {
      routine: routine,
      metadata: metadata,
      completedAt: Date.now(),
      duration: Math.floor((Date.now() - sessionStartTime) / 1000),
      exercises: routine.routine.length
    };

    await Storage.saveSession(sessionData);

    // Navigate to feedback
    Navigation.showView('feedback');
  };

  /**
   * Handle exit button
   */
  const handleExit = async () => {
    if (confirm('Are you sure you want to exit this session?')) {
      // Clear timers
      if (exerciseTimer) clearInterval(exerciseTimer);
      if (sessionTimer) clearInterval(sessionTimer);

      // Release wake lock
      await releaseWakeLock();

      // Navigate back to check-in
      Navigation.showView('checkin');
    }
  };

  /**
   * Play a chime sound using Web Audio API
   */
  const playChime = (frequency = 440, duration = 0.2) => {
    if (!audioContext) return;

    try {
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.value = frequency;
      oscillator.type = 'sine';

      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + duration);
    } catch (error) {
      console.error('Failed to play chime:', error);
    }
  };

  /**
   * Speak text using Web Speech API
   */
  const speak = (text) => {
    if ('speechSynthesis' in window) {
      // Cancel any ongoing speech
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.9;
      utterance.pitch = 1.0;
      utterance.volume = 0.8;

      // Use a calm voice if available
      const voices = window.speechSynthesis.getVoices();
      const preferredVoice = voices.find(voice =>
        voice.lang === 'en-US' && (voice.name.includes('Female') || voice.name.includes('Samantha'))
      );
      if (preferredVoice) {
        utterance.voice = preferredVoice;
      }

      window.speechSynthesis.speak(utterance);
    }
  };

  /**
   * Pause session
   */
  const pause = () => {
    isPaused = true;
  };

  /**
   * Resume session
   */
  const resume = () => {
    isPaused = false;
  };

  // Public API
  return {
    init,
    startSession,
    pause,
    resume
  };
})();
