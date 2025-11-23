/**
 * DownShift PWA - Main Application
 * Pre-sleep mobility companion
 */

(async () => {
  /**
   * Initialize the application
   */
  const initApp = async () => {
    try {
      // Initialize storage
      await Storage.initDB();
      console.log('Storage initialized');

      // Initialize modules
      Navigation.init();
      BodyMap.init();
      CheckIn.init();
      Player.init();
      Feedback.init();
      Assessment.init();
      History.init();

      console.log('All modules initialized');

      // Register service worker
      registerServiceWorker();

      // Set up install prompt
      setupInstallPrompt();

      // Load saved settings
      loadSettings();

      // Check for wake lock support
      checkWakeLockSupport();

      // Prevent default pull-to-refresh on mobile
      preventPullToRefresh();

    } catch (error) {
      console.error('Failed to initialize app:', error);
      alert('Failed to initialize app. Please reload the page.');
    }
  };

  /**
   * Register service worker
   */
  const registerServiceWorker = async () => {
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.register('/downshift/sw.js', {
          scope: '/downshift/'
        });

        console.log('Service Worker registered:', registration);

        // Check for updates
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          console.log('Service Worker update found');

          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // New service worker available
              if (confirm('A new version of DownShift is available. Reload to update?')) {
                window.location.reload();
              }
            }
          });
        });

      } catch (error) {
        console.error('Service Worker registration failed:', error);
      }
    }
  };

  /**
   * Setup install prompt
   */
  const setupInstallPrompt = () => {
    let deferredPrompt;

    window.addEventListener('beforeinstallprompt', (e) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      // Stash the event so it can be triggered later
      deferredPrompt = e;

      // Show install button/banner
      showInstallPromotion(deferredPrompt);
    });

    window.addEventListener('appinstalled', () => {
      console.log('DownShift PWA installed');
      deferredPrompt = null;
    });
  };

  /**
   * Show install promotion
   */
  const showInstallPromotion = (promptEvent) => {
    // Only show once per session
    if (sessionStorage.getItem('installPromptShown')) {
      return;
    }

    // Check if user has dismissed before
    if (localStorage.getItem('installPromptDismissed')) {
      return;
    }

    // Create install banner
    const banner = document.createElement('div');
    banner.style.cssText = `
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      background-color: var(--bg-elevated);
      padding: 1rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-top: 1px solid var(--accent-primary);
      z-index: 9999;
    `;

    banner.innerHTML = `
      <div style="flex: 1; color: var(--text-primary);">
        <strong>Install DownShift</strong><br>
        <small style="color: var(--text-secondary);">Add to home screen for the best experience</small>
      </div>
      <button id="install-btn" style="
        background-color: var(--accent-primary);
        color: var(--bg-primary);
        border: none;
        padding: 0.5rem 1rem;
        border-radius: 6px;
        font-weight: 600;
        cursor: pointer;
        margin-right: 0.5rem;
      ">Install</button>
      <button id="dismiss-btn" style="
        background: none;
        border: none;
        color: var(--text-secondary);
        cursor: pointer;
        font-size: 1.5rem;
      ">×</button>
    `;

    document.body.appendChild(banner);

    // Install button
    document.getElementById('install-btn').addEventListener('click', async () => {
      banner.remove();
      promptEvent.prompt();

      const { outcome } = await promptEvent.userChoice;
      console.log(`User response to install prompt: ${outcome}`);

      sessionStorage.setItem('installPromptShown', 'true');
    });

    // Dismiss button
    document.getElementById('dismiss-btn').addEventListener('click', () => {
      banner.remove();
      localStorage.setItem('installPromptDismissed', 'true');
      sessionStorage.setItem('installPromptShown', 'true');
    });

    sessionStorage.setItem('installPromptShown', 'true');
  };

  /**
   * Load saved settings
   */
  const loadSettings = () => {
    // Check if this is first launch
    const isFirstLaunch = !localStorage.getItem('launched_before');

    if (isFirstLaunch) {
      localStorage.setItem('launched_before', 'true');
      // Show welcome message or tutorial
      showWelcomeMessage();
    }
  };

  /**
   * Show welcome message
   */
  const showWelcomeMessage = () => {
    const welcome = document.createElement('div');
    welcome.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background-color: var(--bg-elevated);
      border: 2px solid var(--accent-primary);
      border-radius: 12px;
      padding: 2rem;
      max-width: 400px;
      z-index: 9999;
      text-align: center;
    `;

    welcome.innerHTML = `
      <h2 style="color: var(--accent-primary); margin-bottom: 1rem;">Welcome to DownShift</h2>
      <p style="color: var(--text-secondary); margin-bottom: 1.5rem;">
        Your pre-sleep mobility companion. Start by mapping your body state, then create a personalized routine.
      </p>
      <button id="welcome-btn" style="
        background-color: var(--accent-primary);
        color: var(--bg-primary);
        border: none;
        padding: 0.75rem 2rem;
        border-radius: 8px;
        font-weight: 600;
        cursor: pointer;
        font-size: 1rem;
      ">Get Started</button>
    `;

    document.body.appendChild(welcome);

    document.getElementById('welcome-btn').addEventListener('click', () => {
      welcome.remove();
    });
  };

  /**
   * Check wake lock support
   */
  const checkWakeLockSupport = () => {
    if (!('wakeLock' in navigator)) {
      console.warn('Wake Lock API not supported');
      // Could show a message to user
    } else {
      console.log('Wake Lock API supported');
    }
  };

  /**
   * Prevent pull-to-refresh on mobile
   */
  const preventPullToRefresh = () => {
    let startY = 0;

    document.addEventListener('touchstart', (e) => {
      startY = e.touches[0].pageY;
    }, { passive: true });

    document.addEventListener('touchmove', (e) => {
      const y = e.touches[0].pageY;
      // If scrolling down and at top of page, prevent default
      if (y > startY && window.scrollY === 0) {
        e.preventDefault();
      }
    }, { passive: false });
  };

  /**
   * Handle visibility change (for wake lock)
   */
  document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState === 'visible') {
      // Re-acquire wake lock if in player view
      const currentView = Navigation.getCurrentView();
      if (currentView === 'player') {
        console.log('Page visible - wake lock may need reacquisition');
      }
    }
  });

  /**
   * Handle online/offline status
   */
  window.addEventListener('online', () => {
    console.log('Back online');
  });

  window.addEventListener('offline', () => {
    console.log('Offline - some features may be limited');
  });

  // Initialize the app when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
  } else {
    initApp();
  }

})();
