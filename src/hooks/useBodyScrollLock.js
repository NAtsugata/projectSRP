// src/hooks/useBodyScrollLock.js
// Hook pour verrouiller le scroll du body (iOS-safe)

import { useRef, useCallback } from 'react';

/**
 * Hook robuste pour verrouiller/déverrouiller le scroll du body
 * Compatible iOS Safari (évite les rebonds)
 *
 * @returns {{ lock: () => void, unlock: () => void, isLocked: () => boolean }}
 */
const useBodyScrollLock = () => {
  const savedYRef = useRef(0);
  const lockedRef = useRef(false);

  const lock = useCallback(() => {
    if (lockedRef.current) return;

    const y = window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;
    savedYRef.current = y;

    const body = document.body;
    body.dataset.__scrollLocked = '1';

    // Empêche les rebonds Safari
    body.style.overscrollBehavior = 'contain';

    // Lock position fixed
    body.style.position = 'fixed';
    body.style.top = `-${y}px`;
    body.style.left = '0';
    body.style.right = '0';
    body.style.width = '100%';
    body.style.overflow = 'hidden';

    lockedRef.current = true;
  }, []);

  const unlock = useCallback(() => {
    if (!lockedRef.current) return;

    const targetY = savedYRef.current || 0;
    const body = document.body;

    // Délock immédiat
    delete body.dataset.__scrollLocked;
    body.style.position = '';
    body.style.top = '';
    body.style.left = '';
    body.style.right = '';
    body.style.width = '';
    body.style.overflow = '';
    body.style.overscrollBehavior = '';

    // Restauration robuste multi-frames (iOS)
    const restore = () => {
      const scroller = document.scrollingElement || document.documentElement || document.body;
      scroller.scrollTop = targetY;
      window.scrollTo(0, targetY);
    };

    restore(); // immédiat
    requestAnimationFrame(() => {
      restore(); // frame suivante
      requestAnimationFrame(() => {
        restore(); // encore une frame (focus/relayout tardifs)
        setTimeout(restore, 60); // mini délai (toolbar/clavier)
      });
    });

    lockedRef.current = false;
  }, []);

  const isLocked = useCallback(() => lockedRef.current, []);

  return { lock, unlock, isLocked };
};

export default useBodyScrollLock;
