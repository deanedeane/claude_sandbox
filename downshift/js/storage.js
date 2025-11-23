/**
 * Storage Module
 * Handles all local data persistence using IndexedDB and localStorage
 */

const Storage = (() => {
  const DB_NAME = 'DownShiftDB';
  const DB_VERSION = 1;
  const STORES = {
    BODY_STATE: 'bodyState',
    SESSIONS: 'sessions',
    SETTINGS: 'settings'
  };

  let db = null;

  /**
   * Initialize IndexedDB
   */
  const initDB = () => {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        db = request.result;
        resolve(db);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // Body State Store
        if (!db.objectStoreNames.contains(STORES.BODY_STATE)) {
          const bodyStateStore = db.createObjectStore(STORES.BODY_STATE, { keyPath: 'area' });
          bodyStateStore.createIndex('status', 'status', { unique: false });
          bodyStateStore.createIndex('lastUpdated', 'lastUpdated', { unique: false });
        }

        // Sessions Store
        if (!db.objectStoreNames.contains(STORES.SESSIONS)) {
          const sessionsStore = db.createObjectStore(STORES.SESSIONS, { keyPath: 'id', autoIncrement: true });
          sessionsStore.createIndex('date', 'date', { unique: false });
          sessionsStore.createIndex('duration', 'duration', { unique: false });
        }

        // Settings Store
        if (!db.objectStoreNames.contains(STORES.SETTINGS)) {
          db.createObjectStore(STORES.SETTINGS, { keyPath: 'key' });
        }
      };
    });
  };

  /**
   * Get body state for a specific area
   */
  const getBodyState = (area) => {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORES.BODY_STATE], 'readonly');
      const store = transaction.objectStore(STORES.BODY_STATE);
      const request = store.get(area);

      request.onsuccess = () => resolve(request.result || { area, status: 'normal', lastUpdated: Date.now() });
      request.onerror = () => reject(request.error);
    });
  };

  /**
   * Get all body states
   */
  const getAllBodyStates = () => {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORES.BODY_STATE], 'readonly');
      const store = transaction.objectStore(STORES.BODY_STATE);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  };

  /**
   * Update body state for a specific area
   */
  const updateBodyState = (area, status) => {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORES.BODY_STATE], 'readwrite');
      const store = transaction.objectStore(STORES.BODY_STATE);
      const request = store.put({
        area,
        status,
        lastUpdated: Date.now()
      });

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  };

  /**
   * Save a completed session
   */
  const saveSession = (sessionData) => {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORES.SESSIONS], 'readwrite');
      const store = transaction.objectStore(STORES.SESSIONS);
      const request = store.add({
        ...sessionData,
        date: Date.now()
      });

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  };

  /**
   * Get all sessions
   */
  const getAllSessions = () => {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORES.SESSIONS], 'readonly');
      const store = transaction.objectStore(STORES.SESSIONS);
      const index = store.index('date');
      const request = index.getAll();

      request.onsuccess = () => {
        const sessions = request.result.sort((a, b) => b.date - a.date);
        resolve(sessions);
      };
      request.onerror = () => reject(request.error);
    });
  };

  /**
   * Get a specific session
   */
  const getSession = (id) => {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORES.SESSIONS], 'readonly');
      const store = transaction.objectStore(STORES.SESSIONS);
      const request = store.get(id);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  };

  /**
   * Get or set settings (uses localStorage for simpler access)
   */
  const getSetting = (key, defaultValue = null) => {
    const value = localStorage.getItem(`downshift_${key}`);
    return value !== null ? JSON.parse(value) : defaultValue;
  };

  const setSetting = (key, value) => {
    localStorage.setItem(`downshift_${key}`, JSON.stringify(value));
  };

  /**
   * Get API key
   */
  const getApiKey = () => {
    return getSetting('api_key', '');
  };

  /**
   * Set API key
   */
  const setApiKey = (key) => {
    setSetting('api_key', key);
  };

  /**
   * Get LLM provider
   */
  const getLLMProvider = () => {
    return getSetting('llm_provider', 'openai');
  };

  /**
   * Set LLM provider
   */
  const setLLMProvider = (provider) => {
    setSetting('llm_provider', provider);
  };

  /**
   * Clear all data (for testing/reset)
   */
  const clearAll = () => {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORES.BODY_STATE, STORES.SESSIONS], 'readwrite');

      transaction.objectStore(STORES.BODY_STATE).clear();
      transaction.objectStore(STORES.SESSIONS).clear();

      transaction.oncomplete = () => {
        localStorage.clear();
        resolve();
      };
      transaction.onerror = () => reject(transaction.error);
    });
  };

  /**
   * Export all data (for backup)
   */
  const exportData = async () => {
    const bodyStates = await getAllBodyStates();
    const sessions = await getAllSessions();
    const settings = {
      llm_provider: getLLMProvider()
      // Note: We don't export API key for security
    };

    return {
      bodyStates,
      sessions,
      settings,
      exportDate: Date.now()
    };
  };

  /**
   * Import data (for restore)
   */
  const importData = async (data) => {
    // Import body states
    if (data.bodyStates) {
      const transaction = db.transaction([STORES.BODY_STATE], 'readwrite');
      const store = transaction.objectStore(STORES.BODY_STATE);
      data.bodyStates.forEach(state => store.put(state));
    }

    // Import sessions
    if (data.sessions) {
      const transaction = db.transaction([STORES.SESSIONS], 'readwrite');
      const store = transaction.objectStore(STORES.SESSIONS);
      data.sessions.forEach(session => store.add(session));
    }

    // Import settings
    if (data.settings) {
      if (data.settings.llm_provider) {
        setLLMProvider(data.settings.llm_provider);
      }
    }
  };

  // Public API
  return {
    initDB,
    getBodyState,
    getAllBodyStates,
    updateBodyState,
    saveSession,
    getAllSessions,
    getSession,
    getSetting,
    setSetting,
    getApiKey,
    setApiKey,
    getLLMProvider,
    setLLMProvider,
    clearAll,
    exportData,
    importData
  };
})();
