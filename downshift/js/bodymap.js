/**
 * Body Map Module
 * Handles the interactive body map with tap-to-toggle status functionality
 */

const BodyMap = (() => {
  const STATUSES = ['normal', 'tight', 'pain'];
  let bodyParts = [];

  /**
   * Initialize body map
   */
  const init = async () => {
    bodyParts = document.querySelectorAll('.body-part');

    // Load saved states from storage
    await loadBodyStates();

    // Add click handlers
    bodyParts.forEach(part => {
      part.addEventListener('click', handleBodyPartClick);
    });
  };

  /**
   * Load body states from storage
   */
  const loadBodyStates = async () => {
    const states = await Storage.getAllBodyStates();

    bodyParts.forEach(part => {
      const area = part.dataset.area;
      const state = states.find(s => s.area === area);

      if (state) {
        setBodyPartStatus(part, state.status);
      } else {
        setBodyPartStatus(part, 'normal');
      }
    });
  };

  /**
   * Handle body part click
   */
  const handleBodyPartClick = async (event) => {
    const part = event.currentTarget;
    const area = part.dataset.area;

    // Get current status
    const currentStatus = getBodyPartStatus(part);

    // Cycle to next status
    const currentIndex = STATUSES.indexOf(currentStatus);
    const nextIndex = (currentIndex + 1) % STATUSES.length;
    const nextStatus = STATUSES[nextIndex];

    // Update UI
    setBodyPartStatus(part, nextStatus);

    // Save to storage
    await Storage.updateBodyState(area, nextStatus);

    // Provide haptic feedback if available
    if (navigator.vibrate) {
      navigator.vibrate(10);
    }
  };

  /**
   * Get current status of a body part
   */
  const getBodyPartStatus = (part) => {
    for (const status of STATUSES) {
      if (part.classList.contains(`status-${status}`)) {
        return status;
      }
    }
    return 'normal';
  };

  /**
   * Set status of a body part
   */
  const setBodyPartStatus = (part, status) => {
    // Remove all status classes
    STATUSES.forEach(s => {
      part.classList.remove(`status-${s}`);
    });

    // Add new status class
    part.classList.add(`status-${status}`);
  };

  /**
   * Get all body states as array
   */
  const getAllStates = async () => {
    return await Storage.getAllBodyStates();
  };

  /**
   * Reset all body parts to normal
   */
  const resetAll = async () => {
    for (const part of bodyParts) {
      const area = part.dataset.area;
      setBodyPartStatus(part, 'normal');
      await Storage.updateBodyState(area, 'normal');
    }
  };

  /**
   * Get areas by status
   */
  const getAreasByStatus = async (status) => {
    const states = await Storage.getAllBodyStates();
    return states
      .filter(s => s.status === status)
      .map(s => s.area);
  };

  /**
   * Export body state as text summary
   */
  const exportSummary = async () => {
    const states = await Storage.getAllBodyStates();
    const tight = states.filter(s => s.status === 'tight').map(s => s.area);
    const pain = states.filter(s => s.status === 'pain').map(s => s.area);

    let summary = '';
    if (tight.length > 0) {
      summary += `Tight areas: ${tight.join(', ')}. `;
    }
    if (pain.length > 0) {
      summary += `Pain areas: ${pain.join(', ')}. `;
    }
    if (tight.length === 0 && pain.length === 0) {
      summary = 'All areas feeling normal.';
    }

    return summary;
  };

  // Public API
  return {
    init,
    getAllStates,
    resetAll,
    getAreasByStatus,
    exportSummary
  };
})();
