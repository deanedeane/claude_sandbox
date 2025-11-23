/**
 * Navigation Module
 * Handles view switching and navigation state
 */

const Navigation = (() => {
  let navBtns;
  let views;
  let currentView = 'bodymap';

  /**
   * Initialize navigation
   */
  const init = () => {
    navBtns = document.querySelectorAll('.nav-btn');
    views = document.querySelectorAll('.view');

    // Navigation button handlers
    navBtns.forEach(btn => {
      btn.addEventListener('click', handleNavClick);
    });

    // Show default view
    showView('bodymap');
  };

  /**
   * Handle navigation button click
   */
  const handleNavClick = (event) => {
    const btn = event.currentTarget;
    const viewName = btn.dataset.view;
    showView(viewName);
  };

  /**
   * Show a specific view
   */
  const showView = (viewName) => {
    // Hide all views
    views.forEach(view => {
      view.style.display = 'none';
    });

    // Remove active class from all nav buttons
    navBtns.forEach(btn => {
      btn.classList.remove('active');
    });

    // Show requested view
    const targetView = document.getElementById(`view-${viewName}`);
    if (targetView) {
      targetView.style.display = 'block';
      currentView = viewName;

      // Update active nav button
      const activeBtn = document.querySelector(`.nav-btn[data-view="${viewName}"]`);
      if (activeBtn) {
        activeBtn.classList.add('active');
      }

      // Hide/show navigation based on view
      const nav = document.getElementById('nav');
      if (viewName === 'player' || viewName === 'feedback') {
        nav.style.display = 'none';
      } else {
        nav.style.display = 'flex';
      }

      // Trigger view-specific refresh actions
      onViewChange(viewName);
    }
  };

  /**
   * Handle view change events
   */
  const onViewChange = (viewName) => {
    switch (viewName) {
      case 'history':
        // Refresh history when viewing
        if (typeof History !== 'undefined') {
          History.refresh();
        }
        break;

      case 'bodymap':
        // Refresh body map display
        if (typeof BodyMap !== 'undefined') {
          BodyMap.init();
        }
        break;

      case 'checkin':
        // Load saved API key
        const apiKeyInput = document.getElementById('api-key');
        if (apiKeyInput && !apiKeyInput.value) {
          const savedKey = Storage.getApiKey();
          if (savedKey) {
            apiKeyInput.value = savedKey;
          }
        }
        break;
    }
  };

  /**
   * Get current view
   */
  const getCurrentView = () => {
    return currentView;
  };

  /**
   * Navigate back
   */
  const goBack = () => {
    // Simple back navigation logic
    if (currentView === 'player') {
      showView('checkin');
    } else if (currentView === 'feedback') {
      showView('history');
    } else {
      showView('bodymap');
    }
  };

  // Public API
  return {
    init,
    showView,
    getCurrentView,
    goBack
  };
})();

/**
 * History Module
 * Displays session history
 */
const History = (() => {
  let historyList;

  /**
   * Initialize history
   */
  const init = () => {
    historyList = document.getElementById('history-list');
    refresh();
  };

  /**
   * Refresh history display
   */
  const refresh = async () => {
    const sessions = await Storage.getAllSessions();

    if (sessions.length === 0) {
      historyList.innerHTML = '<div class="history-empty">No sessions yet. Complete a session to see it here.</div>';
      return;
    }

    // Build history HTML
    historyList.innerHTML = '';

    sessions.forEach(session => {
      const item = createHistoryItem(session);
      historyList.appendChild(item);
    });
  };

  /**
   * Create history item element
   */
  const createHistoryItem = (session) => {
    const div = document.createElement('div');
    div.className = 'history-item';

    const date = new Date(session.completedAt || session.date);
    const dateStr = date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    const duration = session.duration || session.metadata?.duration || 0;
    const durationStr = Math.floor(duration / 60);

    const exercises = session.exercises || session.routine?.routine?.length || 0;

    const feedback = session.feedback?.rating || 'Not rated';
    const feedbackEmoji = {
      'too-easy': '↓',
      'just-right': '👍',
      'too-hard': '↑'
    }[feedback] || '';

    div.innerHTML = `
      <div class="history-item-header">
        <span class="history-date">${dateStr}</span>
        <span class="history-duration">${durationStr} min</span>
      </div>
      <div class="history-details">
        ${exercises} exercises • ${feedbackEmoji} ${feedback}
        ${session.metadata?.userInput ? `<br><small>${session.metadata.userInput.substring(0, 60)}${session.metadata.userInput.length > 60 ? '...' : ''}</small>` : ''}
        ${session.feedback?.notes ? `<br><small>${session.feedback.notes.substring(0, 80)}${session.feedback.notes.length > 80 ? '...' : ''}</small>` : ''}
      </div>
    `;

    return div;
  };

  // Public API
  return {
    init,
    refresh
  };
})();
