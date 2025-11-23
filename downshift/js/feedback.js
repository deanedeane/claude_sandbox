/**
 * Feedback Module
 * Handles post-session feedback and body state adjustments
 */

const Feedback = (() => {
  let feedbackBtns;
  let feedbackNotes;
  let submitBtn;
  let selectedFeedback = null;

  /**
   * Initialize feedback module
   */
  const init = () => {
    feedbackBtns = document.querySelectorAll('.feedback-btn');
    feedbackNotes = document.getElementById('feedback-notes');
    submitBtn = document.getElementById('submit-feedback-btn');

    // Feedback button handlers
    feedbackBtns.forEach(btn => {
      btn.addEventListener('click', handleFeedbackSelect);
    });

    // Submit button handler
    submitBtn.addEventListener('click', handleSubmit);
  };

  /**
   * Handle feedback button selection
   */
  const handleFeedbackSelect = (event) => {
    const btn = event.currentTarget;
    selectedFeedback = btn.dataset.feedback;

    // Update UI
    feedbackBtns.forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');

    // Haptic feedback
    if (navigator.vibrate) {
      navigator.vibrate(10);
    }
  };

  /**
   * Handle submit button
   */
  const handleSubmit = async () => {
    if (!selectedFeedback) {
      alert('Please select how the session felt');
      return;
    }

    // Get last session
    const sessions = await Storage.getAllSessions();
    const lastSession = sessions[0]; // Most recent

    if (!lastSession) {
      console.error('No session found to attach feedback');
      return;
    }

    // Update session with feedback
    const feedbackData = {
      rating: selectedFeedback,
      notes: feedbackNotes.value.trim(),
      timestamp: Date.now()
    };

    lastSession.feedback = feedbackData;

    // Adjust body state based on feedback
    await adjustBodyState(lastSession, selectedFeedback);

    // Show completion message
    showCompletionMessage();

    // Reset form
    resetForm();

    // Navigate to history after a delay
    setTimeout(() => {
      Navigation.showView('history');
      History.refresh();
    }, 2000);
  };

  /**
   * Adjust body state based on feedback
   */
  const adjustBodyState = async (session, feedback) => {
    if (feedback === 'too-hard') {
      // If session was too hard, potentially mark areas as needing gentler approach
      // We can track this by looking at which areas were targeted

      const routine = session.routine;
      if (routine && routine.routine) {
        // For now, we'll just log this
        // In a more advanced version, we could parse which body areas were targeted
        // and adjust their "intensity" or "sensitivity" levels
        console.log('Session marked as too hard - future routines should be gentler');
      }
    } else if (feedback === 'too-easy') {
      // If too easy, we could mark the user as ready for more challenge
      console.log('Session marked as too easy - future routines can be more intense');
    }

    // This is where you could implement more sophisticated adjustments
    // For example, storing intensity preferences per body area
  };

  /**
   * Show completion message
   */
  const showCompletionMessage = () => {
    const message = document.createElement('div');
    message.className = 'completion-message';
    message.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background-color: var(--accent-primary);
      color: var(--bg-primary);
      padding: 2rem;
      border-radius: 12px;
      font-size: 1.5rem;
      font-weight: 600;
      z-index: 9999;
      text-align: center;
    `;
    message.textContent = 'Session Logged ✓';

    document.body.appendChild(message);

    setTimeout(() => {
      message.remove();
    }, 1800);
  };

  /**
   * Reset form
   */
  const resetForm = () => {
    selectedFeedback = null;
    feedbackBtns.forEach(btn => btn.classList.remove('selected'));
    feedbackNotes.value = '';
  };

  // Public API
  return {
    init,
    resetForm
  };
})();
