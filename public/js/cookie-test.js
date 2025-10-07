/**
 * Cookie Popup Test Script
 * Run this in browser console to test cookie functionality
 */

// Test function to verify cookie popup functionality
function testCookiePopup() {
  console.log('=== Cookie Popup Test ===');

  // Check if elements exist
  const banner = document.getElementById('cookieConsentPopup');
  const manager = document.getElementById('cookieManagerModal');

  console.log('1. Element Check:');
  console.log('   Banner exists:', !!banner);
  console.log('   Manager exists:', !!manager);

  if (!banner) {
    console.error('❌ Cookie banner not found!');
    return;
  }

  // Check current state
  console.log('2. Current State:');
  console.log('   Banner visible:', !banner.classList.contains('hidden') && banner.style.display !== 'none');
  console.log('   Manager visible:', manager && !manager.classList.contains('hidden') && manager.style.display !== 'none');
  console.log('   LocalStorage consent:', localStorage.getItem('cookieConsent'));

  // Clear previous consent for testing
  localStorage.removeItem('cookieConsent');
  console.log('3. Cleared previous consent');

  // Show banner
  banner.classList.remove('hidden');
  banner.style.display = 'flex';
  console.log('4. Showed cookie banner');

  // Test functions
  console.log('5. Testing functions:');

  // Test accept function
  setTimeout(() => {
    console.log('   Testing acceptAllCookies()...');
    if (typeof window.acceptAllCookies === 'function') {
      window.acceptAllCookies();
      console.log('   ✅ acceptAllCookies() executed');
      console.log('   Banner visible after accept:', !banner.classList.contains('hidden') && banner.style.display !== 'none');
      console.log('   LocalStorage after accept:', localStorage.getItem('cookieConsent'));
    } else {
      console.error('   ❌ acceptAllCookies function not found');
    }
  }, 1000);
}

// Test function to simulate user interaction
function simulateUserAccept() {
  console.log('=== Simulating User Accept ===');

  // Find and click accept button
  const acceptBtn = document.querySelector('[onclick*="acceptAllCookies"]');
  if (acceptBtn) {
    console.log('Found accept button, clicking...');
    acceptBtn.click();

    setTimeout(() => {
      const banner = document.getElementById('cookieConsentPopup');
      console.log('Banner visible after click:', banner && !banner.classList.contains('hidden') && banner.style.display !== 'none');
      console.log('LocalStorage after click:', localStorage.getItem('cookieConsent'));
    }, 100);
  } else {
    console.error('Accept button not found');
  }
}

// Test function to simulate user reject
function simulateUserReject() {
  console.log('=== Simulating User Reject ===');

  // Clear consent first
  localStorage.removeItem('cookieConsent');

  // Show banner
  const banner = document.getElementById('cookieConsentPopup');
  if (banner) {
    banner.classList.remove('hidden');
    banner.style.display = 'flex';
  }

  // Find and click reject button
  const rejectBtn = document.querySelector('[onclick*="rejectCookies"]');
  if (rejectBtn) {
    console.log('Found reject button, clicking...');
    rejectBtn.click();

    setTimeout(() => {
      console.log('Banner visible after reject:', banner && !banner.classList.contains('hidden') && banner.style.display !== 'none');
      console.log('LocalStorage after reject:', localStorage.getItem('cookieConsent'));
    }, 100);
  } else {
    console.error('Reject button not found');
  }
}

// Export test functions to global scope
window.testCookiePopup = testCookiePopup;
window.simulateUserAccept = simulateUserAccept;
window.simulateUserReject = simulateUserReject;

console.log('Cookie test functions loaded. Use:');
console.log('- testCookiePopup() - Basic functionality test');
console.log('- simulateUserAccept() - Simulate clicking Accept');
console.log('- simulateUserReject() - Simulate clicking Reject');
console.log('- debugCookiePopup() - Debug current state');
