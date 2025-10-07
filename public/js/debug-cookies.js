// Cookie Popup Debug Script
// Paste this into browser console to debug cookie issues

console.log('=== Cookie Popup Debug Script ===');

// 1. Check if elements exist
console.log('1. Checking DOM elements...');
const popup = document.getElementById('cookieConsentPopup');
const manager = document.getElementById('cookieManagerModal');
const acceptBtn = document.getElementById('acceptAllCookiesBtn');
const rejectBtn = document.getElementById('rejectCookiesBtn');
const managerBtn = document.getElementById('showCookieManagerBtn');

console.log('Cookie popup element:', popup);
console.log('Cookie manager element:', manager);
console.log('Accept button:', acceptBtn);
console.log('Reject button:', rejectBtn);
console.log('Manager button:', managerBtn);

// 2. Check if functions are loaded
console.log('2. Checking functions...');
console.log('acceptAllCookies function:', typeof window.acceptAllCookies);
console.log('rejectCookies function:', typeof window.rejectCookies);
console.log('showCookieManager function:', typeof window.showCookieManager);
console.log('hideCookieManager function:', typeof window.hideCookieManager);

// 3. Check current state
console.log('3. Current state...');
console.log('localStorage.cookieConsent:', localStorage.getItem('cookieConsent'));
if (popup) {
    console.log('Popup classes:', popup.className);
    console.log('Popup display style:', popup.style.display);
    console.log('Popup computed display:', window.getComputedStyle(popup).display);
    console.log('Popup visible:', !popup.classList.contains('hidden') && popup.style.display !== 'none');
}

// 4. Test functions manually
console.log('4. Available test commands:');
console.log('- testAcceptCookies() - Test accept function');
console.log('- testRejectCookies() - Test reject function');
console.log('- testShowManager() - Test show manager');
console.log('- showCookiePopup() - Force show popup');
console.log('- clearConsentAndShowPopup() - Reset and show popup');

window.testAcceptCookies = function() {
    console.log('Testing accept cookies...');
    if (typeof window.acceptAllCookies === 'function') {
        window.acceptAllCookies();
    } else {
        console.error('acceptAllCookies function not available');
    }
};

window.testRejectCookies = function() {
    console.log('Testing reject cookies...');
    if (typeof window.rejectCookies === 'function') {
        window.rejectCookies();
    } else {
        console.error('rejectCookies function not available');
    }
};

window.testShowManager = function() {
    console.log('Testing show manager...');
    if (typeof window.showCookieManager === 'function') {
        window.showCookieManager();
    } else {
        console.error('showCookieManager function not available');
    }
};

window.showCookiePopup = function() {
    console.log('Forcing cookie popup to show...');
    const popup = document.getElementById('cookieConsentPopup');
    if (popup) {
        popup.classList.remove('hidden');
        popup.style.display = 'flex';
        console.log('Popup should now be visible');
    } else {
        console.error('Popup element not found');
    }
};

window.clearConsentAndShowPopup = function() {
    console.log('Clearing consent and showing popup...');
    localStorage.removeItem('cookieConsent');
    window.showCookiePopup();
};

// 5. Check event listeners
console.log('5. Checking event listeners...');
if (acceptBtn) {
    console.log('Accept button has listeners:', acceptBtn.onclick !== null || acceptBtn.addEventListener.length > 0);
}
if (rejectBtn) {
    console.log('Reject button has listeners:', rejectBtn.onclick !== null || rejectBtn.addEventListener.length > 0);
}
if (managerBtn) {
    console.log('Manager button has listeners:', managerBtn.onclick !== null || managerBtn.addEventListener.length > 0);
}

console.log('=== Debug script ready! ===');
console.log('Try: clearConsentAndShowPopup() then testAcceptCookies()');
