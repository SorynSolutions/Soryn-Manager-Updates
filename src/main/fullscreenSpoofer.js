/**
 * Enhanced FullScreen Spoofer for Electron applications with BrowserViews
 * 
 * This script simulates the browser fullscreen and pointer lock APIs even when
 * the application is in windowed mode. It allows online games and HTML5 applications
 * to work properly in BrowserViews without needing to enter real fullscreen mode.
 */

// Script to inject into each BrowserView
const FullScreenSpooferScript = `
(function() {
  console.log('Initializing FullScreen Spoofer...');
  
  // Store fullscreen and pointer states
  var _fullscreenElement = null;
  var _pointerLockElement = null;
  var _originalWindowSize = { width: window.innerWidth, height: window.innerHeight };
  
  // ---- EARLY SIMULATION TO CAPTURE CHECKS ON LOAD ---- //
  
  // Immediately simulate that the document is in fullscreen mode
  // This helps with games that check the state on load
  _fullscreenElement = document.documentElement;
  
  // Simulate the state change event to trigger detections
  setTimeout(() => {
    const event = new Event('fullscreenchange');
    document.dispatchEvent(event);
    const webkitEvent = new Event('webkitfullscreenchange');
    document.dispatchEvent(webkitEvent);
  }, 0);
  
  // ---- INTERCEPT INITIAL TESTS ---- //
  
  // Common tests that games perform at startup
  const originalMatchMedia = window.matchMedia;
  window.matchMedia = function(query) {
    // Intercept fullscreen-related queries
    if (query.includes('fullscreen') || query.includes('max-width') || query.includes('max-height')) {
      console.log('Intercepted matchMedia query:', query);
      return {
        matches: query.includes('fullscreen'),
        addEventListener: function() {},
        removeEventListener: function() {},
        addListener: function() {},
        removeListener: function() {},
        media: query
      };
    }
    return originalMatchMedia.apply(this, arguments);
  };
  
  // ---- FULLSCREEN HANDLING ---- //
  
  // Helper function to create/dispatch events
  function dispatchCustomEvent(eventName, target) {
    const event = new Event(eventName);
    (target || document).dispatchEvent(event);
    
    // Try with the webkit prefix too
    if (eventName === 'fullscreenchange') {
      const webkitEvent = new Event('webkitfullscreenchange');
      (target || document).dispatchEvent(webkitEvent);
    }
    
    // Try visibilitychange events too
    if (eventName === 'fullscreenchange') {
      const visEvent = new Event('visibilitychange');
      document.dispatchEvent(visEvent);
    }
  }
  
  // Replace requestFullscreen and all its prefixed variants
  const requestFullscreenImplementation = function() {
    console.log('Simulating fullscreen for:', this);
    _fullscreenElement = this;
    
    // Simulate the event
    setTimeout(() => {
      dispatchCustomEvent('fullscreenchange');
    }, 10);
    
    return Promise.resolve();
  };
  
  Element.prototype.requestFullscreen = requestFullscreenImplementation;
  Element.prototype.webkitRequestFullscreen = requestFullscreenImplementation;
  Element.prototype.mozRequestFullScreen = requestFullscreenImplementation;
  Element.prototype.msRequestFullscreen = requestFullscreenImplementation;
  
  // Replace exitFullscreen and all its prefixed variants
  const exitFullscreenImplementation = function() {
    _fullscreenElement = null;
    
    // Simulate the event
    setTimeout(() => {
      dispatchCustomEvent('fullscreenchange');
    }, 10);
    
    return Promise.resolve();
  };
  
  Document.prototype.exitFullscreen = exitFullscreenImplementation;
  Document.prototype.webkitExitFullscreen = exitFullscreenImplementation;
  Document.prototype.mozCancelFullScreen = exitFullscreenImplementation;
  Document.prototype.msExitFullscreen = exitFullscreenImplementation;
  
  // Replace the fullscreenElement property and its variants
  Object.defineProperty(Document.prototype, 'fullscreenElement', {
    get: function() { return _fullscreenElement; },
    configurable: true
  });
  
  Object.defineProperty(Document.prototype, 'webkitFullscreenElement', {
    get: function() { return _fullscreenElement; },
    configurable: true
  });
  
  Object.defineProperty(Document.prototype, 'mozFullScreenElement', {
    get: function() { return _fullscreenElement; },
    configurable: true
  });
  
  Object.defineProperty(Document.prototype, 'msFullscreenElement', {
    get: function() { return _fullscreenElement; },
    configurable: true
  });
  
  // Fullscreen state
  Object.defineProperty(Document.prototype, 'fullscreenEnabled', {
    get: function() { return true; },
    configurable: true
  });
  
  Object.defineProperty(Document.prototype, 'webkitFullscreenEnabled', {
    get: function() { return true; },
    configurable: true
  });
  
  Object.defineProperty(Document.prototype, 'mozFullScreenEnabled', {
    get: function() { return true; },
    configurable: true
  });
  
  Object.defineProperty(Document.prototype, 'msFullscreenEnabled', {
    get: function() { return true; },
    configurable: true
  });
  
  // Support for webkitIsFullScreen
  Object.defineProperty(Document.prototype, 'webkitIsFullScreen', {
    get: function() { return _fullscreenElement !== null; },
    configurable: true
  });
  
  // Intercept the fullscreen property of the document
  // Some games check this property
  Object.defineProperty(document, 'fullscreen', {
    get: function() { return _fullscreenElement !== null; },
    configurable: true
  });
  
  // Intercept fullscreen detection based on window size
  Object.defineProperty(window, 'outerWidth', {
    get: function() { return window.screen.width; },
    configurable: true
  });
  
  Object.defineProperty(window, 'outerHeight', {
    get: function() { return window.screen.height; },
    configurable: true
  });
  
  // ---- POINTER LOCK HANDLING ---- //
  
  // Replace requestPointerLock
  Element.prototype.requestPointerLock = function() {
    console.log('Simulating pointer lock for:', this);
    _pointerLockElement = this;
    
    // Simulate the event
    setTimeout(() => {
      dispatchCustomEvent('pointerlockchange');
    }, 10);
  };
  
  Element.prototype.mozRequestPointerLock = Element.prototype.requestPointerLock;
  Element.prototype.webkitRequestPointerLock = Element.prototype.requestPointerLock;
  
  // Replace exitPointerLock
  Document.prototype.exitPointerLock = function() {
    _pointerLockElement = null;
    
    // Simulate the event
    setTimeout(() => {
      dispatchCustomEvent('pointerlockchange');
    }, 10);
  };
  
  Document.prototype.mozExitPointerLock = Document.prototype.exitPointerLock;
  Document.prototype.webkitExitPointerLock = Document.prototype.exitPointerLock;
  
  // Replace the pointerLockElement property
  Object.defineProperty(Document.prototype, 'pointerLockElement', {
    get: function() { return _pointerLockElement; },
    configurable: true
  });
  
  Object.defineProperty(Document.prototype, 'mozPointerLockElement', {
    get: function() { return _pointerLockElement; },
    configurable: true
  });
  
  Object.defineProperty(Document.prototype, 'webkitPointerLockElement', {
    get: function() { return _pointerLockElement; },
    configurable: true
  });
  
  // ---- VISIBILITY ENHANCEMENT ---- //
  
  // Force visible state to prevent games from pausing
  Object.defineProperty(Document.prototype, 'hidden', {
    get: function() { return false; },
    configurable: true
  });
  
  Object.defineProperty(Document.prototype, 'webkitHidden', {
    get: function() { return false; },
    configurable: true
  });
  
  // Force visibilityState
  Object.defineProperty(Document.prototype, 'visibilityState', {
    get: function() { return 'visible'; },
    configurable: true
  });
  
  Object.defineProperty(Document.prototype, 'webkitVisibilityState', {
    get: function() { return 'visible'; },
    configurable: true
  });
  
  // Prevent visibilitychange events
  document.addEventListener('visibilitychange', function(e) {
    e.stopPropagation();
    e.preventDefault();
  }, true);
  
  document.addEventListener('webkitvisibilitychange', function(e) {
    e.stopPropagation();
    e.preventDefault();
  }, true);
  
  // ---- FOCUS EMULATION ---- //
  
  // Keep focus even if the window is not active
  Object.defineProperty(document, 'hasFocus', {
    value: function() { return true; },
    configurable: true
  });
  
  // Simulate that the document is always active
  Object.defineProperty(document, 'activeElement', {
    get: function() {
      return _pointerLockElement || document.body || document.documentElement;
    },
    configurable: true
  });
  
  // Override blur/focus for elements
  const originalBlur = HTMLElement.prototype.blur;
  HTMLElement.prototype.blur = function() {
    console.log('Blur attempt intercepted');
    // Do not call the original function
  };
  
  const originalFocus = HTMLElement.prototype.focus;
  HTMLElement.prototype.focus = function() {
    console.log('Forced focus on:', this);
    originalFocus.apply(this, arguments);
  };
  
  // ---- FULLSCREEN SCREEN SIMULATION ---- //
  
  // Function to update all screen properties
  function updateScreenProperties() {
    // Simulate fullscreen dimensions for screen and window
    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;
    
    const screenProps = [
      'width', 'height', 'availWidth', 'availHeight',
      'availLeft', 'availTop'
    ];
    
    screenProps.forEach(prop => {
      Object.defineProperty(window.screen, prop, {
        get: function() { 
          return prop.includes('width') ? screenWidth : 
                 prop.includes('height') ? screenHeight : 0; 
        },
        configurable: true
      });
    });
    
    // Window properties
    Object.defineProperty(window, 'innerWidth', {
      get: function() { return screenWidth; },
      configurable: true
    });
    
    Object.defineProperty(window, 'innerHeight', {
      get: function() { return screenHeight; },
      configurable: true
    });
    
    // Simulate orientation changes for tablets/mobile
    window.orientation = 0;
    window.screen.orientation = {
      angle: 0,
      type: 'landscape-primary',
      onchange: null,
      addEventListener: function() {},
      removeEventListener: function() {},
      dispatchEvent: function() { return true; }
    };
  }
  
  // Update initial dimensions
  updateScreenProperties();
  
  // Update dimensions periodically
  setInterval(updateScreenProperties, 1000);
  
  // Update dimensions on window resize
  window.addEventListener('resize', updateScreenProperties);
  
  // Monitor fullscreen state changes
  document.addEventListener('fullscreenchange', updateScreenProperties);
  document.addEventListener('webkitfullscreenchange', updateScreenProperties);
  
  // ---- SUPPORT FOR GAMEPAD API ---- //
  
  // Ensure navigator.getGamepads() works even if the window is not focused
  if (navigator.getGamepads) {
    const originalGetGamepads = navigator.getGamepads;
    navigator.getGamepads = function() {
      try {
        return originalGetGamepads.apply(this, arguments);
      } catch (e) {
        console.warn('Gamepad access error, returning empty array', e);
        return [];
      }
    };
  }
  
  // ---- NOTIFICATION HANDLING ---- //
  
  // Simulate that notifications are always allowed
  if (window.Notification) {
    Object.defineProperty(window.Notification, 'permission', {
      get: function() { return 'granted'; },
      configurable: true
    });
    
    const originalRequestPermission = window.Notification.requestPermission;
    window.Notification.requestPermission = function() {
      if (typeof originalRequestPermission === 'function') {
        try {
          return Promise.resolve('granted');
        } catch (e) {
          return Promise.resolve('granted');
        }
      } else {
        return Promise.resolve('granted');
      }
    };
  }
  
  // ---- INITIAL STARTUP EVENTS ---- //
  
  // Force-trigger a focus event to help games that pause
  // when they detect a loss of focus
  window.addEventListener('load', function() {
    setTimeout(() => {
      console.log('Forcing initial focus...');
      const focusEvent = new FocusEvent('focus');
      window.dispatchEvent(focusEvent);
      document.dispatchEvent(focusEvent);
      if (document.body) document.body.dispatchEvent(focusEvent);
      
      // Trigger a fullscreenchange event to help detect some games
      const fullscreenEvent = new Event('fullscreenchange');
      document.dispatchEvent(fullscreenEvent);
      
      // Also trigger the resize event to force dimension update
      const resizeEvent = new Event('resize');
      window.dispatchEvent(resizeEvent);
    }, 200);
  });
  
  console.log('FullScreen Spoofer successfully enabled');
})();
`;

// Export the script for use in BrowserViews
module.exports = {
  FullScreenSpooferScript
}; 