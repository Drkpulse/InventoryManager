/**
 * Enhanced User Analytics Tracker
 * Comprehensive user behavior and performance tracking system
 */

class UserAnalyticsTracker {
  constructor() {
    this.sessionId = this.generateSessionId();
    this.startTime = Date.now();
    this.currentPage = {
      url: window.location.href,
      title: document.title,
      startTime: Date.now(),
      scrollDepth: 0,
      clicks: 0,
      interactions: []
    };
    this.performanceMetrics = {};
    this.clickHeatmap = [];
    this.isTracking = false;
    this.trackingInterval = null;
    
    // Check cookie consent before starting tracking
    this.init();
  }

  init() {
    // Wait for cookie consent decision
    this.waitForCookieConsent(() => {
      if (this.hasAnalyticsConsent()) {
        this.startTracking();
      }
    });
  }

  waitForCookieConsent(callback) {
    const checkConsent = () => {
      const consent = localStorage.getItem('cookieConsent');
      if (consent) {
        callback();
      } else {
        setTimeout(checkConsent, 1000);
      }
    };
    checkConsent();
  }

  hasAnalyticsConsent() {
    const analyticsConsent = document.cookie
      .split(';')
      .find(row => row.trim().startsWith('analytics_consent='))
      ?.split('=')[1];
    
    return analyticsConsent === 'true' || localStorage.getItem('allowPerformanceCookies') === 'true';
  }

  generateSessionId() {
    return 'session_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
  }

  startTracking() {
    if (this.isTracking) return;
    
    this.isTracking = true;
    console.log('📊 Starting enhanced user analytics tracking');

    // Track page load performance
    this.trackPagePerformance();
    
    // Track user interactions
    this.attachEventListeners();
    
    // Track page view
    this.trackEvent('page_view', {
      url: window.location.href,
      title: document.title,
      referrer: document.referrer
    });

    // Start periodic tracking
    this.trackingInterval = setInterval(() => {
      this.trackPageActivity();
    }, 10000); // Every 10 seconds

    // Track when user leaves page
    this.attachUnloadListeners();
  }

  trackPagePerformance() {
    try {
      if (!window.performance) return;

      const navigation = performance.getEntriesByType('navigation')[0];
      const paintEntries = performance.getEntriesByType('paint');
      
      let performanceData = {
        load_time_ms: Math.round(navigation?.loadEventEnd - navigation?.loadEventStart) || 0,
        dom_ready_time_ms: Math.round(navigation?.domContentLoadedEventEnd - navigation?.domContentLoadedEventStart) || 0,
        first_contentful_paint_ms: 0,
        largest_contentful_paint_ms: 0,
        connection_type: navigator.connection?.effectiveType || 'unknown',
        device_type: this.getDeviceType(),
        browser: this.getBrowserInfo().name,
        browser_version: this.getBrowserInfo().version,
        os: navigator.platform,
        screen_resolution: `${screen.width}x${screen.height}`,
        viewport_width: window.innerWidth,
        viewport_height: window.innerHeight
      };

      // Get paint metrics
      paintEntries.forEach(entry => {
        if (entry.name === 'first-contentful-paint') {
          performanceData.first_contentful_paint_ms = Math.round(entry.startTime);
        }
      });

      // Get LCP if available
      if (window.PerformanceObserver) {
        new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const lastEntry = entries[entries.length - 1];
          performanceData.largest_contentful_paint_ms = Math.round(lastEntry.startTime);
        }).observe({ entryTypes: ['largest-contentful-paint'] });
      }

      // Get memory usage if available
      if (performance.memory) {
        performanceData.memory_used_mb = Math.round(performance.memory.usedJSHeapSize / 1024 / 1024 * 100) / 100;
      }

      this.sendPerformanceData(performanceData);
    } catch (error) {
      console.warn('Error tracking performance metrics:', error);
    }
  }

  attachEventListeners() {
    // Click tracking
    document.addEventListener('click', (e) => {
      this.trackClick(e);
    }, { passive: true });

    // Scroll tracking
    let scrollTimeout;
    document.addEventListener('scroll', () => {
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        this.trackScroll();
      }, 150);
    }, { passive: true });

    // Form submissions
    document.addEventListener('submit', (e) => {
      this.trackFormSubmission(e);
    });

    // Input focus for engagement tracking
    document.addEventListener('focusin', (e) => {
      if (e.target.matches('input, textarea, select')) {
        this.trackEvent('input_focus', {
          element_id: e.target.id,
          element_name: e.target.name,
          element_type: e.target.type || e.target.tagName.toLowerCase()
        });
      }
    });

    // Page visibility changes
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.trackEvent('page_hidden');
      } else {
        this.trackEvent('page_visible');
      }
    });

    // Keyboard interactions
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        this.trackEvent('keyboard_interaction', {
          key: e.key,
          element_id: e.target.id,
          element_tag: e.target.tagName.toLowerCase()
        });
      }
    });
  }

  trackClick(event) {
    const element = event.target;
    const rect = element.getBoundingClientRect();
    
    const clickData = {
      element_id: element.id,
      element_class: element.className,
      element_text: element.textContent?.substring(0, 100),
      element_tag: element.tagName.toLowerCase(),
      click_x: Math.round(event.clientX),
      click_y: Math.round(event.clientY),
      viewport_width: window.innerWidth,
      viewport_height: window.innerHeight,
      element_x: Math.round(rect.left),
      element_y: Math.round(rect.top),
      element_width: Math.round(rect.width),
      element_height: Math.round(rect.height)
    };

    // Store for heatmap
    this.clickHeatmap.push({
      x: event.clientX,
      y: event.clientY,
      timestamp: Date.now()
    });

    this.currentPage.clicks++;
    this.trackEvent('click', clickData);

    // Track specific interactions
    if (element.matches('a[href]')) {
      this.trackEvent('link_click', {
        ...clickData,
        href: element.href,
        is_external: !element.href.startsWith(window.location.origin)
      });
    }

    if (element.matches('button, [role="button"]')) {
      this.trackEvent('button_click', clickData);
    }
  }

  trackScroll() {
    const scrollPercent = Math.round(
      (window.scrollY + window.innerHeight) / document.documentElement.scrollHeight * 100
    );
    
    if (scrollPercent > this.currentPage.scrollDepth) {
      this.currentPage.scrollDepth = scrollPercent;
      
      this.trackEvent('scroll', {
        scroll_depth: scrollPercent,
        scroll_y: window.scrollY,
        page_height: document.documentElement.scrollHeight,
        viewport_height: window.innerHeight
      });
    }
  }

  trackFormSubmission(event) {
    const form = event.target;
    const formData = new FormData(form);
    const fields = Array.from(formData.keys());

    this.trackEvent('form_submit', {
      form_id: form.id,
      form_action: form.action,
      form_method: form.method,
      field_count: fields.length,
      fields: fields.join(','),
      form_name: form.name
    });

    // Mark as conversion event
    this.trackEvent('conversion', {
      conversion_type: 'form_submission',
      form_id: form.id
    });
  }

  trackPageActivity() {
    const timeOnPage = Math.round((Date.now() - this.currentPage.startTime) / 1000);
    
    this.trackEvent('page_activity', {
      time_spent_seconds: timeOnPage,
      scroll_depth: this.currentPage.scrollDepth,
      clicks_count: this.currentPage.clicks,
      interactions_count: this.currentPage.interactions.length
    });
  }

  trackEvent(eventType, data = {}) {
    if (!this.hasAnalyticsConsent()) return;

    const eventData = {
      session_id: this.sessionId,
      event_type: eventType,
      page_url: window.location.href,
      page_title: document.title,
      timestamp: new Date().toISOString(),
      user_agent: navigator.userAgent,
      viewport_width: window.innerWidth,
      viewport_height: window.innerHeight,
      ...data
    };

    // Send to server
    this.sendEventData(eventData);
  }

  sendEventData(eventData) {
    // Use sendBeacon for reliable delivery
    if (navigator.sendBeacon) {
      const blob = new Blob([JSON.stringify(eventData)], { type: 'application/json' });
      navigator.sendBeacon('/api/analytics/event', blob);
    } else {
      // Fallback to fetch
      fetch('/api/analytics/event', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(eventData),
        keepalive: true
      }).catch(error => {
        console.warn('Failed to send analytics event:', error);
      });
    }
  }

  sendPerformanceData(performanceData) {
    if (!this.hasAnalyticsConsent()) return;

    const data = {
      session_id: this.sessionId,
      page_url: window.location.href,
      page_title: document.title,
      timestamp: new Date().toISOString(),
      ...performanceData
    };

    fetch('/api/analytics/performance', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data)
    }).catch(error => {
      console.warn('Failed to send performance data:', error);
    });
  }

  attachUnloadListeners() {
    const sendFinalData = () => {
      const sessionData = {
        session_id: this.sessionId,
        total_duration_seconds: Math.round((Date.now() - this.startTime) / 1000),
        pages_visited: 1, // Will be calculated server-side
        total_clicks: this.currentPage.clicks,
        final_scroll_depth: this.currentPage.scrollDepth,
        exit_page: window.location.href,
        click_heatmap: this.clickHeatmap.slice(-50) // Last 50 clicks
      };

      if (navigator.sendBeacon) {
        const blob = new Blob([JSON.stringify(sessionData)], { type: 'application/json' });
        navigator.sendBeacon('/api/analytics/session-end', blob);
      }
    };

    window.addEventListener('beforeunload', sendFinalData);
    window.addEventListener('pagehide', sendFinalData);
  }

  getDeviceType() {
    const userAgent = navigator.userAgent.toLowerCase();
    if (/tablet|ipad|playbook|silk/.test(userAgent)) return 'tablet';
    if (/mobile|iphone|ipod|android|blackberry|mini|windows\sce|palm/.test(userAgent)) return 'mobile';
    return 'desktop';
  }

  getBrowserInfo() {
    const userAgent = navigator.userAgent;
    let name = 'Unknown';
    let version = 'Unknown';

    if (userAgent.indexOf('Firefox') > -1) {
      name = 'Firefox';
      version = userAgent.match(/Firefox\/([0-9.]+)/)?.[1] || 'Unknown';
    } else if (userAgent.indexOf('Chrome') > -1) {
      name = 'Chrome';
      version = userAgent.match(/Chrome\/([0-9.]+)/)?.[1] || 'Unknown';
    } else if (userAgent.indexOf('Safari') > -1) {
      name = 'Safari';
      version = userAgent.match(/Safari\/([0-9.]+)/)?.[1] || 'Unknown';
    } else if (userAgent.indexOf('Edge') > -1) {
      name = 'Edge';
      version = userAgent.match(/Edge\/([0-9.]+)/)?.[1] || 'Unknown';
    }

    return { name, version };
  }

  // Cookie consent tracking
  trackCookieConsent(consentType, preferences = {}) {
    const consentData = {
      session_id: this.sessionId,
      consent_type: consentType,
      performance_cookies: preferences.performance || false,
      preference_cookies: preferences.preference || false,
      analytics_cookies: preferences.analytics || false,
      marketing_cookies: preferences.marketing || false,
      consent_method: 'popup',
      timestamp: new Date().toISOString()
    };

    fetch('/api/analytics/cookie-consent', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(consentData)
    }).catch(error => {
      console.warn('Failed to send cookie consent data:', error);
    });
  }

  // Public method to track custom events
  track(eventName, data = {}) {
    this.trackEvent(eventName, data);
  }

  // Get current session analytics summary
  getSessionSummary() {
    return {
      sessionId: this.sessionId,
      duration: Math.round((Date.now() - this.startTime) / 1000),
      currentPage: this.currentPage,
      clickHeatmap: this.clickHeatmap,
      deviceType: this.getDeviceType(),
      browser: this.getBrowserInfo()
    };
  }
}

// Global analytics instance
window.userAnalytics = new UserAnalyticsTracker();

// Enhanced cookie consent tracking integration
const originalAcceptAllCookies = window.acceptAllCookies;
window.acceptAllCookies = function() {
  if (originalAcceptAllCookies) originalAcceptAllCookies();
  
  if (window.userAnalytics) {
    window.userAnalytics.trackCookieConsent('accepted_all', {
      performance: true,
      preference: true,
      analytics: true,
      marketing: true
    });
    
    // Start tracking if not already started
    if (!window.userAnalytics.isTracking) {
      window.userAnalytics.startTracking();
    }
  }
};

const originalRejectCookies = window.rejectCookies;
window.rejectCookies = function() {
  if (originalRejectCookies) originalRejectCookies();
  
  if (window.userAnalytics) {
    window.userAnalytics.trackCookieConsent('rejected_all', {
      performance: false,
      preference: false,
      analytics: false,
      marketing: false
    });
  }
};

const originalUpdateCookiePreferences = window.updateCookiePreferences;
window.updateCookiePreferences = function() {
  if (originalUpdateCookiePreferences) originalUpdateCookiePreferences();
  
  if (window.userAnalytics) {
    const performance = document.getElementById('performanceCookies')?.checked || false;
    const preference = document.getElementById('preferenceCookies')?.checked || false;
    
    window.userAnalytics.trackCookieConsent('customized', {
      performance: performance,
      preference: preference,
      analytics: performance,
      marketing: false
    });
    
    // Start tracking if performance cookies are enabled
    if (performance && !window.userAnalytics.isTracking) {
      window.userAnalytics.startTracking();
    }
  }
};

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = UserAnalyticsTracker;
}

console.log('📊 Enhanced User Analytics Tracker loaded');
