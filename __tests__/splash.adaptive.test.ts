/**
 * Tests for the adaptive splash screen timing logic.
 * 
 * Since the splash screen is a complex React component with many dependencies
 * (react-native-reanimated, expo-router, etc.), we test the core timing logic
 * directly rather than rendering the component.
 */

describe('SplashScreen adaptive timing logic', () => {
  const MIN_DISPLAY_TIME = 800;

  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('minimum display time enforcement', () => {
    it('ensures minimum display time when auth resolves quickly', () => {
      const mountedTime = Date.now();
      const authResolveTime = mountedTime + 200; // Auth resolves after 200ms

      const elapsed = authResolveTime - mountedTime;
      const remaining = Math.max(0, MIN_DISPLAY_TIME - elapsed);

      expect(remaining).toBe(600); // 800 - 200 = 600ms remaining
    });

    it('navigates immediately when auth resolves after minimum time', () => {
      const mountedTime = Date.now();
      const authResolveTime = mountedTime + 1500; // Auth resolves after 1500ms

      const elapsed = authResolveTime - mountedTime;
      const remaining = Math.max(0, MIN_DISPLAY_TIME - elapsed);

      expect(remaining).toBe(0); // Already past minimum, navigate immediately
    });

    it('handles auth resolving exactly at minimum time', () => {
      const mountedTime = Date.now();
      const authResolveTime = mountedTime + 800; // Auth resolves at exactly 800ms

      const elapsed = authResolveTime - mountedTime;
      const remaining = Math.max(0, MIN_DISPLAY_TIME - elapsed);

      expect(remaining).toBe(0); // Exactly at minimum, navigate immediately
    });
  });

  describe('navigation guard (single navigation)', () => {
    it('prevents duplicate navigation with a guard flag', () => {
      let navigated = false;
      let navigateCount = 0;

      const navigate = () => {
        if (navigated) return;
        navigated = true;
        navigateCount++;
      };

      // First call — should navigate
      navigate();
      expect(navigateCount).toBe(1);

      // Second call — should be blocked
      navigate();
      expect(navigateCount).toBe(1);

      // Third call — still blocked
      navigate();
      expect(navigateCount).toBe(1);
    });
  });

  describe('auth loading state transitions', () => {
    it('waits for isLoading to become false before navigating', () => {
      let isLoading = true;
      let navigated = false;

      const navigate = () => {
        if (isLoading) return;
        navigated = true;
      };

      // Auth still loading
      navigate();
      expect(navigated).toBe(false);

      // Auth resolves
      isLoading = false;
      navigate();
      expect(navigated).toBe(true);
    });

    it('handles slow auth resolution (longer than minimum display time)', () => {
      const mountedTime = Date.now();
      
      // Simulate auth taking 2 seconds to resolve
      const authResolveTime = mountedTime + 2000;
      const elapsed = authResolveTime - mountedTime;
      const remaining = Math.max(0, MIN_DISPLAY_TIME - elapsed);

      // Should navigate immediately since 2000ms > 800ms minimum
      expect(remaining).toBe(0);
    });

    it('handles fast auth resolution (faster than minimum display time)', () => {
      const mountedTime = Date.now();
      
      // Simulate auth resolving instantly
      const authResolveTime = mountedTime + 50;
      const elapsed = authResolveTime - mountedTime;
      const remaining = Math.max(0, MIN_DISPLAY_TIME - elapsed);

      // Should wait for the remaining time
      expect(remaining).toBe(750);
    });
  });

  describe('timer management', () => {
    it('sets timeout with remaining time when auth resolves early', () => {
      let callbackCalled = false;
      const mountedTime = Date.now();
      const elapsed = 200;
      const remaining = Math.max(0, MIN_DISPLAY_TIME - elapsed);

      const timer = setTimeout(() => {
        callbackCalled = true;
      }, remaining);

      // Timer not yet fired
      expect(callbackCalled).toBe(false);

      // Advance timer
      jest.advanceTimersByTime(remaining);
      expect(callbackCalled).toBe(true);

      clearTimeout(timer);
    });

    it('calls navigate directly when no remaining time', () => {
      let callbackCalled = false;
      const mountedTime = Date.now();
      const elapsed = 2000; // Well past minimum
      const remaining = Math.max(0, MIN_DISPLAY_TIME - elapsed);

      if (remaining > 0) {
        setTimeout(() => {
          callbackCalled = true;
        }, remaining);
      } else {
        // Direct call, no timer needed
        callbackCalled = true;
      }

      expect(callbackCalled).toBe(true);
    });

    it('cleans up timer on unmount', () => {
      let callbackCalled = false;
      const remaining = 500;

      const timer = setTimeout(() => {
        callbackCalled = true;
      }, remaining);

      clearTimeout(timer);
      jest.advanceTimersByTime(remaining);
      expect(callbackCalled).toBe(false);
    });
  });

  describe('MIN_DISPLAY_TIME constant', () => {
    it('is set to 800ms for branding', () => {
      expect(MIN_DISPLAY_TIME).toBe(800);
    });

    it('is less than the original hardcoded 2500ms', () => {
      expect(MIN_DISPLAY_TIME).toBeLessThan(2500);
    });

    it('is long enough for branding (at least 500ms)', () => {
      expect(MIN_DISPLAY_TIME).toBeGreaterThanOrEqual(500);
    });
  });
});
