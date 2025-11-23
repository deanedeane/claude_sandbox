/**
 * Check-In Module
 * Handles user input, voice recognition, and routine generation
 */

const CheckIn = (() => {
  let statusInput;
  let voiceBtn;
  let durationSlider;
  let durationValue;
  let apiKeyInput;
  let generateBtn;
  let loadingState;
  let recognition = null;

  /**
   * Initialize check-in module
   */
  const init = () => {
    statusInput = document.getElementById('status-input');
    voiceBtn = document.getElementById('voice-btn');
    durationSlider = document.getElementById('duration-slider');
    durationValue = document.getElementById('duration-value');
    apiKeyInput = document.getElementById('api-key');
    generateBtn = document.getElementById('generate-routine-btn');
    loadingState = document.getElementById('loading-state');

    // Load saved API key
    const savedApiKey = Storage.getApiKey();
    if (savedApiKey) {
      apiKeyInput.value = savedApiKey;
    }

    // Duration slider handler
    durationSlider.addEventListener('input', (e) => {
      durationValue.textContent = e.target.value;
    });

    // API key handler
    apiKeyInput.addEventListener('change', (e) => {
      Storage.setApiKey(e.target.value);
    });

    // Voice button handler
    voiceBtn.addEventListener('click', toggleVoiceInput);

    // Generate routine button
    generateBtn.addEventListener('click', handleGenerateRoutine);

    // Initialize speech recognition if available
    initSpeechRecognition();
  };

  /**
   * Initialize speech recognition
   */
  const initSpeechRecognition = () => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        statusInput.value += (statusInput.value ? ' ' : '') + transcript;
        stopVoiceInput();
      };

      recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        stopVoiceInput();
        alert('Voice input error: ' + event.error);
      };

      recognition.onend = () => {
        stopVoiceInput();
      };
    } else {
      // Hide voice button if not supported
      voiceBtn.style.display = 'none';
    }
  };

  /**
   * Toggle voice input
   */
  const toggleVoiceInput = () => {
    if (!recognition) {
      alert('Voice input is not supported in this browser');
      return;
    }

    if (voiceBtn.classList.contains('listening')) {
      stopVoiceInput();
    } else {
      startVoiceInput();
    }
  };

  /**
   * Start voice input
   */
  const startVoiceInput = () => {
    try {
      recognition.start();
      voiceBtn.classList.add('listening');
      statusInput.placeholder = 'Listening...';

      // Haptic feedback
      if (navigator.vibrate) {
        navigator.vibrate(20);
      }
    } catch (error) {
      console.error('Failed to start voice recognition:', error);
    }
  };

  /**
   * Stop voice input
   */
  const stopVoiceInput = () => {
    if (recognition) {
      try {
        recognition.stop();
      } catch (error) {
        // Ignore errors when stopping
      }
    }
    voiceBtn.classList.remove('listening');
    statusInput.placeholder = 'e.g., Did heavy squats today, low back feels compressed...';
  };

  /**
   * Handle generate routine button
   */
  const handleGenerateRoutine = async () => {
    // Validate API key
    const apiKey = Storage.getApiKey();
    if (!apiKey || apiKey.trim().length < 10) {
      alert('Please enter your LLM API key to generate routines.');
      apiKeyInput.focus();
      return;
    }

    // Get form values
    const userInput = statusInput.value.trim();
    const duration = parseInt(durationSlider.value);
    const focus = document.querySelector('input[name="focus"]:checked').value;

    // Show loading state
    generateBtn.disabled = true;
    loadingState.style.display = 'block';

    try {
      // Get body states
      const bodyStates = await Storage.getAllBodyStates();

      // Generate routine using LLM
      const routine = await LLM.generateRoutine(bodyStates, userInput, duration, focus);

      // Hide loading
      loadingState.style.display = 'none';
      generateBtn.disabled = false;

      // Store routine for player
      sessionStorage.setItem('currentRoutine', JSON.stringify(routine));
      sessionStorage.setItem('routineMetadata', JSON.stringify({
        userInput,
        duration,
        focus,
        timestamp: Date.now()
      }));

      // Switch to player view
      Navigation.showView('player');

      // Start the session
      Player.startSession(routine);

    } catch (error) {
      console.error('Routine generation failed:', error);

      // Hide loading
      loadingState.style.display = 'none';
      generateBtn.disabled = false;

      // Ask user if they want to use fallback
      if (confirm(`Failed to generate routine: ${error.message}\n\nWould you like to use a default routine instead?`)) {
        const fallbackRoutine = LLM.getFallbackRoutine(duration);

        sessionStorage.setItem('currentRoutine', JSON.stringify(fallbackRoutine));
        sessionStorage.setItem('routineMetadata', JSON.stringify({
          userInput: userInput || 'Fallback routine',
          duration,
          focus,
          timestamp: Date.now()
        }));

        Navigation.showView('player');
        Player.startSession(fallbackRoutine);
      }
    }
  };

  /**
   * Reset form
   */
  const resetForm = () => {
    statusInput.value = '';
    durationSlider.value = 15;
    durationValue.textContent = '15';
    document.querySelector('input[name="focus"][value="sleep"]').checked = true;
  };

  // Public API
  return {
    init,
    resetForm
  };
})();
