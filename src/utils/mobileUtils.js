/**
 * Mobile Utilities - Touch & Gesture Management
 * Utilitaires pour optimisation mobile et gestures
 */

/* ==================== FAST CLICK SETUP ==================== */

/**
 * Remove 300ms tap delay on mobile
 * Alternative to FastClick library (now deprecated)
 */
export const initFastClick = () => {
  // Modern browsers already don't have the delay with touch-action: manipulation
  // This is mainly for older browsers
  if ('ontouchstart' in window) {
    document.documentElement.style.touchAction = 'manipulation';
  }
};

/* ==================== TOUCH DETECTION ==================== */

/**
 * Detect if device supports touch
 */
export const isTouchDevice = () => {
  return (
    'ontouchstart' in window ||
    navigator.maxTouchPoints > 0 ||
    navigator.msMaxTouchPoints > 0
  );
};

/**
 * Detect if running on mobile
 */
export const isMobile = () => {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
};

/**
 * Detect if running on iOS
 */
export const isIOS = () => {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
};

/**
 * Detect if running on Android
 */
export const isAndroid = () => {
  return /Android/i.test(navigator.userAgent);
};

/* ==================== SWIPE GESTURES ==================== */

/**
 * Swipe gesture detector
 * @param {HTMLElement} element - Element to detect swipes on
 * @param {Object} callbacks - { onSwipeLeft, onSwipeRight, onSwipeUp, onSwipeDown }
 * @param {number} threshold - Minimum distance for swipe (default: 50px)
 */
export const initSwipeGestures = (element, callbacks = {}, threshold = 50) => {
  let touchStartX = 0;
  let touchStartY = 0;
  let touchEndX = 0;
  let touchEndY = 0;

  const handleTouchStart = (e) => {
    touchStartX = e.changedTouches[0].screenX;
    touchStartY = e.changedTouches[0].screenY;
  };

  const handleTouchEnd = (e) => {
    touchEndX = e.changedTouches[0].screenX;
    touchEndY = e.changedTouches[0].screenY;
    handleGesture();
  };

  const handleGesture = () => {
    const diffX = touchEndX - touchStartX;
    const diffY = touchEndY - touchStartY;

    // Horizontal swipe
    if (Math.abs(diffX) > Math.abs(diffY)) {
      if (Math.abs(diffX) > threshold) {
        if (diffX > 0) {
          callbacks.onSwipeRight?.();
        } else {
          callbacks.onSwipeLeft?.();
        }
      }
    }
    // Vertical swipe
    else {
      if (Math.abs(diffY) > threshold) {
        if (diffY > 0) {
          callbacks.onSwipeDown?.();
        } else {
          callbacks.onSwipeUp?.();
        }
      }
    }
  };

  element.addEventListener('touchstart', handleTouchStart, { passive: true });
  element.addEventListener('touchend', handleTouchEnd, { passive: true });

  // Cleanup function
  return () => {
    element.removeEventListener('touchstart', handleTouchStart);
    element.removeEventListener('touchend', handleTouchEnd);
  };
};

/* ==================== PULL TO REFRESH ==================== */

/**
 * Pull to refresh functionality
 * @param {HTMLElement} container - Scrollable container
 * @param {Function} onRefresh - Callback when refresh triggered
 * @param {number} threshold - Pull distance to trigger refresh (default: 80px)
 */
export const initPullToRefresh = (container, onRefresh, threshold = 80) => {
  let startY = 0;
  let currentY = 0;
  let pulling = false;

  const handleTouchStart = (e) => {
    if (container.scrollTop === 0) {
      startY = e.touches[0].clientY;
    }
  };

  const handleTouchMove = (e) => {
    if (container.scrollTop === 0) {
      currentY = e.touches[0].clientY;
      const pullDistance = currentY - startY;

      if (pullDistance > 0) {
        pulling = true;
        container.classList.add('pulling');
        e.preventDefault();

        // Visual feedback
        const indicator = container.querySelector('.pull-to-refresh-indicator');
        if (indicator) {
          const rotation = Math.min(pullDistance * 2, 360);
          indicator.style.transform = `translateX(-50%) rotate(${rotation}deg)`;
        }
      }
    }
  };

  const handleTouchEnd = () => {
    const pullDistance = currentY - startY;

    if (pulling && pullDistance > threshold) {
      onRefresh();
    }

    container.classList.remove('pulling');
    pulling = false;
    startY = 0;
    currentY = 0;

    const indicator = container.querySelector('.pull-to-refresh-indicator');
    if (indicator) {
      indicator.style.transform = 'translateX(-50%) rotate(0deg)';
    }
  };

  container.addEventListener('touchstart', handleTouchStart, { passive: true });
  container.addEventListener('touchmove', handleTouchMove, { passive: false });
  container.addEventListener('touchend', handleTouchEnd, { passive: true });

  return () => {
    container.removeEventListener('touchstart', handleTouchStart);
    container.removeEventListener('touchmove', handleTouchMove);
    container.removeEventListener('touchend', handleTouchEnd);
  };
};

/* ==================== HAPTIC FEEDBACK ==================== */

/**
 * Trigger haptic feedback (if supported)
 * @param {string} type - 'light', 'medium', 'heavy', 'success', 'warning', 'error'
 */
export const hapticFeedback = (type = 'light') => {
  // Vibration API
  if (navigator.vibrate) {
    const patterns = {
      light: 10,
      medium: 20,
      heavy: 30,
      success: [10, 50, 10],
      warning: [20, 100, 20],
      error: [30, 100, 30, 100, 30],
    };
    navigator.vibrate(patterns[type] || patterns.light);
  }

  // iOS Haptic Feedback (if available)
  if (window.webkit?.messageHandlers?.haptic) {
    window.webkit.messageHandlers.haptic.postMessage({ type });
  }
};

/* ==================== SAFE AREA INSETS ==================== */

/**
 * Get safe area insets for notched devices
 */
export const getSafeAreaInsets = () => {
  const style = getComputedStyle(document.documentElement);
  return {
    top: parseInt(style.getPropertyValue('env(safe-area-inset-top)') || 0),
    bottom: parseInt(style.getPropertyValue('env(safe-area-inset-bottom)') || 0),
    left: parseInt(style.getPropertyValue('env(safe-area-inset-left)') || 0),
    right: parseInt(style.getPropertyValue('env(safe-area-inset-right)') || 0),
  };
};

/* ==================== PREVENT ZOOM ON INPUT FOCUS ==================== */

/**
 * Prevent zoom on input focus (iOS)
 */
export const preventZoomOnInputFocus = () => {
  if (isIOS()) {
    const viewport = document.querySelector('meta[name=viewport]');
    if (viewport) {
      const content = viewport.getAttribute('content');
      viewport.setAttribute('content', `${content}, user-scalable=no`);
    }
  }
};

/* ==================== ORIENTATION CHANGE ==================== */

/**
 * Listen to orientation changes
 * @param {Function} callback - Called with 'portrait' or 'landscape'
 */
export const onOrientationChange = (callback) => {
  const handleOrientationChange = () => {
    const orientation =
      window.innerHeight > window.innerWidth ? 'portrait' : 'landscape';
    callback(orientation);
  };

  window.addEventListener('orientationchange', handleOrientationChange);
  window.addEventListener('resize', handleOrientationChange);

  // Initial call
  handleOrientationChange();

  return () => {
    window.removeEventListener('orientationchange', handleOrientationChange);
    window.removeEventListener('resize', handleOrientationChange);
  };
};

/* ==================== NETWORK STATUS ==================== */

/**
 * Check if device is online
 */
export const isOnline = () => {
  return navigator.onLine;
};

/**
 * Listen to network status changes
 * @param {Function} callback - Called with true/false
 */
export const onNetworkChange = (callback) => {
  const handleOnline = () => callback(true);
  const handleOffline = () => callback(false);

  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);

  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
  };
};

/* ==================== LONG PRESS DETECTION ==================== */

/**
 * Detect long press gesture
 * @param {HTMLElement} element - Element to detect long press on
 * @param {Function} callback - Called when long press detected
 * @param {number} duration - Long press duration in ms (default: 500)
 */
export const initLongPress = (element, callback, duration = 500) => {
  let timer;

  const handleStart = (e) => {
    timer = setTimeout(() => {
      hapticFeedback('medium');
      callback(e);
    }, duration);
  };

  const handleEnd = () => {
    clearTimeout(timer);
  };

  element.addEventListener('touchstart', handleStart, { passive: true });
  element.addEventListener('touchend', handleEnd, { passive: true });
  element.addEventListener('touchcancel', handleEnd, { passive: true });

  return () => {
    clearTimeout(timer);
    element.removeEventListener('touchstart', handleStart);
    element.removeEventListener('touchend', handleEnd);
    element.removeEventListener('touchcancel', handleEnd);
  };
};

/* ==================== PREVENT OVERSCROLL ==================== */

/**
 * Prevent overscroll/bounce on iOS
 * @param {HTMLElement} element - Element to prevent overscroll
 */
export const preventOverscroll = (element) => {
  let startY = 0;

  const handleTouchStart = (e) => {
    startY = e.touches[0].pageY;
  };

  const handleTouchMove = (e) => {
    const y = e.touches[0].pageY;
    const scrollTop = element.scrollTop;
    const scrollHeight = element.scrollHeight;
    const height = element.clientHeight;
    const isAtTop = scrollTop === 0;
    const isAtBottom = scrollTop + height >= scrollHeight;

    if ((isAtTop && y > startY) || (isAtBottom && y < startY)) {
      e.preventDefault();
    }
  };

  element.addEventListener('touchstart', handleTouchStart, { passive: true });
  element.addEventListener('touchmove', handleTouchMove, { passive: false });

  return () => {
    element.removeEventListener('touchstart', handleTouchStart);
    element.removeEventListener('touchmove', handleTouchMove);
  };
};

/* ==================== MOBILE KEYBOARD DETECTION ==================== */

/**
 * Detect when mobile keyboard is shown/hidden
 * @param {Function} onShow - Called when keyboard shown
 * @param {Function} onHide - Called when keyboard hidden
 */
export const onKeyboardChange = (onShow, onHide) => {
  const initialHeight = window.innerHeight;

  const handleResize = () => {
    const currentHeight = window.innerHeight;
    if (currentHeight < initialHeight) {
      onShow?.();
    } else {
      onHide?.();
    }
  };

  window.addEventListener('resize', handleResize);

  return () => {
    window.removeEventListener('resize', handleResize);
  };
};

/* ==================== DOUBLE TAP DETECTION ==================== */

/**
 * Detect double tap gesture
 * @param {HTMLElement} element - Element to detect double tap on
 * @param {Function} callback - Called when double tap detected
 * @param {number} delay - Max delay between taps in ms (default: 300)
 */
export const initDoubleTap = (element, callback, delay = 300) => {
  let lastTap = 0;

  const handleTouchEnd = (e) => {
    const currentTime = new Date().getTime();
    const tapLength = currentTime - lastTap;

    if (tapLength < delay && tapLength > 0) {
      hapticFeedback('light');
      callback(e);
      e.preventDefault();
    }

    lastTap = currentTime;
  };

  element.addEventListener('touchend', handleTouchEnd, { passive: false });

  return () => {
    element.removeEventListener('touchend', handleTouchEnd);
  };
};

/* ==================== INITIALIZE ALL MOBILE OPTIMIZATIONS ==================== */

/**
 * Initialize all mobile optimizations
 */
export const initMobileOptimizations = () => {
  // Fast click
  initFastClick();

  // Add mobile class to body
  if (isMobile()) {
    document.body.classList.add('is-mobile');
  }

  if (isTouchDevice()) {
    document.body.classList.add('is-touch');
  }

  if (isIOS()) {
    document.body.classList.add('is-ios');
  }

  if (isAndroid()) {
    document.body.classList.add('is-android');
  }

  // Log mobile environment
  console.log('📱 Mobile optimizations initialized', {
    isMobile: isMobile(),
    isTouch: isTouchDevice(),
    isIOS: isIOS(),
    isAndroid: isAndroid(),
    viewport: {
      width: window.innerWidth,
      height: window.innerHeight,
    },
  });
};

export default {
  initFastClick,
  isTouchDevice,
  isMobile,
  isIOS,
  isAndroid,
  initSwipeGestures,
  initPullToRefresh,
  hapticFeedback,
  getSafeAreaInsets,
  preventZoomOnInputFocus,
  onOrientationChange,
  isOnline,
  onNetworkChange,
  initLongPress,
  preventOverscroll,
  onKeyboardChange,
  initDoubleTap,
  initMobileOptimizations,
};
