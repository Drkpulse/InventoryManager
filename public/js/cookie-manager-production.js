/**
 * Production-Ready Cookie Management System
 * This script ensures cookie popups work reliably in production
 */

(function() {
  'use strict';

  console.log('🍪 Initializing production cookie system...');

  let initAttempts = 0;
  const maxInitAttempts = 10;

  // Cookie management functions
  const CookieManager = {

    init() {
      console.log('🔄 CookieManager.init() called');
      this.attachEventListeners();
      this.checkConsentStatus();
    },

    attachEventListeners() {
      console.log('🔗 Attaching event listeners...');

      // Wait for DOM elements to be available
      const elements = {
        acceptBtn: 'acceptAllCookiesBtn',
        rejectBtn: 'rejectCookiesBtn',
        managerBtn: 'showCookieManagerBtn',
        closeBtn1: 'closeCookieManagerBtn',
        closeBtn2: 'closeCookieManagerBtn2',
        clearBtn: 'clearAllCookiesBtn',
        exportBtn: 'exportCookieDataBtn'
      };

      let attachedCount = 0;

      Object.entries(elements).forEach(([key, elementId]) => {
        const element = document.getElementById(elementId);
        if (element) {
          // Remove existing listeners
          const newElement = element.cloneNode(true);
          element.parentNode.replaceChild(newElement, element);

          // Attach new listener based on button type
          if (key === 'acceptBtn') {
            newElement.addEventListener('click', (e) => {
              e.preventDefault();
              e.stopPropagation();
              console.log('✅ Accept button clicked');
              this.acceptAllCookies();
            });
          } else if (key === 'rejectBtn') {
            newElement.addEventListener('click', (e) => {
              e.preventDefault();
              e.stopPropagation();
              console.log('❌ Reject button clicked');
              this.rejectCookies();
            });
          } else if (key === 'managerBtn') {
            newElement.addEventListener('click', (e) => {
              e.preventDefault();
              e.stopPropagation();
              console.log('⚙️ Manager button clicked');
              this.showCookieManager();
            });
          } else if (key.includes('closeBtn') || key === 'clearBtn' || key === 'exportBtn') {
            newElement.addEventListener('click', (e) => {
              e.preventDefault();
              e.stopPropagation();
              console.log(`🔘 ${key} clicked`);
              if (key.includes('closeBtn')) this.hideCookieManager();
              else if (key === 'clearBtn') this.clearAllCookies();
              else if (key === 'exportBtn') this.exportCookieData();
            });
          }

          attachedCount++;
          console.log(`✅ ${elementId} listener attached`);
        } else {
          console.warn(`⚠️ Element not found: ${elementId}`);
        }
      });

      console.log(`📊 Attached listeners to ${attachedCount}/${Object.keys(elements).length} elements`);
      return attachedCount > 0;
    },

    checkConsentStatus() {
      const consent = localStorage.getItem('cookieConsent');
      console.log('🔍 Checking consent status:', consent);

      if (!consent) {
        // No consent given, show popup
        setTimeout(() => this.showCookiePopup(), 1000);
      }
    },

    showCookiePopup() {
      console.log('👁️ Showing cookie popup...');
      const popup = document.getElementById('cookieConsentPopup');
      if (popup) {
        popup.classList.remove('hidden');
        popup.style.display = 'flex';
        console.log('✅ Cookie popup shown');
      } else {
        console.error('❌ Cookie popup element not found');
      }
    },

    hideCookiePopup() {
      console.log('🙈 Hiding cookie popup...');
      const popup = document.getElementById('cookieConsentPopup');
      if (popup) {
        popup.classList.add('hidden');
        popup.style.display = 'none';
        console.log('✅ Cookie popup hidden');
      }
    },

    acceptAllCookies() {
      console.log('✅ Accepting all cookies...');

      // Set localStorage
      localStorage.setItem('cookieConsent', 'true');

      // Set backend cookies
      document.cookie = "cookie_consent=accepted; path=/; max-age=31536000; SameSite=Lax";
      document.cookie = "analytics_consent=true; path=/; max-age=31536000; SameSite=Lax";
      document.cookie = "marketing_consent=true; path=/; max-age=31536000; SameSite=Lax";

      this.hideCookiePopup();
      console.log('✅ All cookies accepted and popup hidden');
    },

    rejectCookies() {
      console.log('❌ Rejecting non-essential cookies...');

      // Set localStorage
      localStorage.setItem('cookieConsent', 'true');

      // Set backend cookies
      document.cookie = "cookie_consent=rejected; path=/; max-age=31536000; SameSite=Lax";
      document.cookie = "analytics_consent=false; path=/; max-age=31536000; SameSite=Lax";
      document.cookie = "marketing_consent=false; path=/; max-age=31536000; SameSite=Lax";

      this.hideCookiePopup();
      console.log('✅ Cookies rejected and popup hidden');
    },

    showCookieManager() {
      console.log('⚙️ Showing cookie manager...');

      const popup = document.getElementById('cookieConsentPopup');
      const manager = document.getElementById('cookieManagerModal');

      if (popup) {
        popup.classList.add('hidden');
        popup.style.display = 'none';
      }

      if (manager) {
        manager.classList.remove('hidden');
        manager.style.display = 'flex';
        console.log('✅ Cookie manager shown');
      } else {
        console.error('❌ Cookie manager element not found');
      }
    },

    hideCookieManager() {
      console.log('🙈 Hiding cookie manager...');

      const manager = document.getElementById('cookieManagerModal');
      if (manager) {
        manager.classList.add('hidden');
        manager.style.display = 'none';
        console.log('✅ Cookie manager hidden');
      }

      // Don't show popup if consent already given
      const consent = localStorage.getItem('cookieConsent');
      if (!consent) {
        this.showCookiePopup();
      }
    },

    clearAllCookies() {
      console.log('🧹 Clearing all cookies...');

      // Clear localStorage
      localStorage.removeItem('cookieConsent');

      // Clear cookies
      document.cookie.split(";").forEach(function(c) {
        document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
      });

      setTimeout(() => location.reload(), 500);
    },

    exportCookieData() {
      console.log('📥 Exporting cookie data...');

      const cookieData = {
        timestamp: new Date().toISOString(),
        localStorage: {
          cookieConsent: localStorage.getItem('cookieConsent')
        },
        cookies: document.cookie.split(';').map(c => {
          const [name, value] = c.trim().split('=');
          return { name, value: value || '' };
        })
      };

      const dataStr = JSON.stringify(cookieData, null, 2);
      const dataBlob = new Blob([dataStr], {type:'application/json'});

      const link = document.createElement('a');
      link.href = URL.createObjectURL(dataBlob);
      link.download = `cookie-data-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      console.log('✅ Cookie data exported');
    }
  };

  // Global functions for backward compatibility
  window.acceptAllCookies = () => CookieManager.acceptAllCookies();
  window.rejectCookies = () => CookieManager.rejectCookies();
  window.showCookieManager = () => CookieManager.showCookieManager();
  window.hideCookieManager = () => CookieManager.hideCookieManager();
  window.clearAllCookies = () => CookieManager.clearAllCookies();
  window.exportCookieData = () => CookieManager.exportCookieData();

  // Debug functions
  window.debugCookieSystem = () => {
    console.log('🔍 Cookie System Debug Info:');
    console.log('Popup element:', document.getElementById('cookieConsentPopup'));
    console.log('Manager element:', document.getElementById('cookieManagerModal'));
    console.log('Accept button:', document.getElementById('acceptAllCookiesBtn'));
    console.log('Consent status:', localStorage.getItem('cookieConsent'));
    CookieManager.attachEventListeners();
  };

  window.testCookieSystem = () => {
    console.log('🧪 Testing cookie system...');
    localStorage.removeItem('cookieConsent');
    CookieManager.showCookiePopup();
  };

  // Initialize the system
  function initializeCookieManager() {
    initAttempts++;
    console.log(`🔄 Cookie initialization attempt ${initAttempts}/${maxInitAttempts}`);

    const popup = document.getElementById('cookieConsentPopup');
    if (popup) {
      console.log('✅ Cookie popup found, initializing...');
      CookieManager.init();
      return true;
    } else {
      console.log('⏳ Cookie popup not found yet, retrying...');
      if (initAttempts < maxInitAttempts) {
        setTimeout(initializeCookieManager, 500);
      } else {
        console.error('❌ Failed to initialize cookie system after max attempts');
      }
      return false;
    }
  }

  // Start initialization
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeCookieManager);
  } else {
    initializeCookieManager();
  }

  console.log('🍪 Production cookie system loaded');

})();
