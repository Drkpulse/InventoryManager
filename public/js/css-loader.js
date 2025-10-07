/**
 * CSS Loading System
 * Provides fallback mechanisms for CSS loading issues
 */

(function() {
    'use strict';

    const CSSLoader = {

        // Initialize CSS loading checks
        init: function() {
            this.checkCSSLoading();
            this.setupFallbacks();
        },

        // Check if main CSS files loaded properly
        checkCSSLoading: function() {
            // Wait longer for CSS to fully load and parse
            setTimeout(() => {
                this.verifyTailwindCSS();
                this.verifyFontAwesome();
            }, 1000);
        },

        // Verify Tailwind CSS loaded by testing a known class
        verifyTailwindCSS: function() {
            let attempts = 0;
            const maxAttempts = 5;
            const self = this; // Preserve context

            const testTailwind = () => {
                attempts++;

                // Create test element
                const testEl = document.createElement('div');
                testEl.className = 'bg-blue-500 text-white p-4 rounded hidden'; // Multiple Tailwind classes
                testEl.style.position = 'absolute';
                testEl.style.top = '-9999px';
                testEl.style.left = '-9999px';
                testEl.style.visibility = 'hidden';
                testEl.textContent = 'Tailwind Test';

                document.body.appendChild(testEl);

                // Force a reflow to ensure styles are computed
                testEl.offsetHeight;

                const computed = getComputedStyle(testEl);
                const bgColor = computed.backgroundColor;
                const textColor = computed.color;
                const padding = computed.padding;
                const borderRadius = computed.borderRadius;

                console.log(`🎨 Tailwind CSS test attempt ${attempts}/${maxAttempts}:`, {
                    backgroundColor: bgColor,
                    textColor: textColor,
                    padding: padding,
                    borderRadius: borderRadius,
                    display: computed.display
                });

                // Check if we got any Tailwind styles applied
                const hasBgColor = bgColor === 'rgb(59, 130, 246)' || bgColor === 'rgba(59, 130, 246, 1)';
                const hasTextColor = textColor === 'rgb(255, 255, 255)' || textColor === 'rgba(255, 255, 255, 1)';
                const hasPadding = padding !== '0px' && padding !== '';
                const hasBorderRadius = borderRadius !== '0px' && borderRadius !== '';

                console.log('🔍 Tailwind style checks:', {
                    bgColor: hasBgColor ? '✅' : '❌',
                    textColor: hasTextColor ? '✅' : '❌',
                    padding: hasPadding ? '✅' : '❌',
                    borderRadius: hasBorderRadius ? '✅' : '❌'
                });

                document.body.removeChild(testEl);

                // Consider Tailwind loaded if we have at least 2 matching styles
                const styleMatches = [hasBgColor, hasTextColor, hasPadding, hasBorderRadius].filter(Boolean).length;

                if (styleMatches >= 2) {
                    console.log('✅ Tailwind CSS loaded successfully (', styleMatches, 'style matches)');
                    return true;
                }

                // If not found and we have attempts left, try again
                if (attempts < maxAttempts) {
                    console.log(`🔄 Tailwind not ready, retrying in 800ms (attempt ${attempts}/${maxAttempts})`);
                    setTimeout(() => testTailwind(), 800);
                    return false;
                }

                // All attempts failed - check if CSS file exists at all
                console.warn('⚠️ Tailwind CSS not loaded properly after', maxAttempts, 'attempts');
                self.debugCSSLoading();
                self.applyFallbackCSS();
                return false;
            };

            testTailwind();
        },

        // Debug CSS loading issues
        debugCSSLoading: function() {
            console.group('🔍 CSS Loading Debug Information');

            // Check for CSS link elements
            const cssLinks = document.querySelectorAll('link[rel="stylesheet"]');
            console.log('📄 Found', cssLinks.length, 'CSS link elements:');

            cssLinks.forEach((link, index) => {
                console.log(`  ${index + 1}. ${link.href}`, {
                    loaded: !link.disabled,
                    media: link.media,
                    crossOrigin: link.crossOrigin
                });
            });

            // Check for style elements
            const styleElements = document.querySelectorAll('style');
            console.log('📝 Found', styleElements.length, 'inline style elements');

            // Check document readiness
            console.log('📋 Document state:', {
                readyState: document.readyState,
                styleSheets: document.styleSheets.length,
                timestamp: new Date().toISOString()
            });

            console.groupEnd();
        },

        // Verify Font Awesome loaded
        verifyFontAwesome: function() {
            const testEl = document.createElement('i');
            testEl.className = 'fas fa-check';
            testEl.style.position = 'absolute';
            testEl.style.top = '-9999px';
            document.body.appendChild(testEl);

            const computed = getComputedStyle(testEl);
            const fontFamily = computed.fontFamily;

            document.body.removeChild(testEl);

            if (!fontFamily.includes('Font Awesome')) {
                console.warn('⚠️ Font Awesome not loaded properly');
                this.loadFontAwesomeFallback();
            } else {
                console.log('✅ Font Awesome loaded successfully');
            }
        },

        // Apply emergency fallback CSS
        applyFallbackCSS: function() {
            const fallbackCSS = `
                /* Emergency Fallback Styles */
                body {
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    background: #f9fafb;
                    color: #111827;
                    margin: 0;
                    line-height: 1.6;
                }
                .container {
                    max-width: 1200px;
                    margin: 0 auto;
                    padding: 20px;
                }
                .btn {
                    display: inline-block;
                    padding: 8px 16px;
                    border-radius: 6px;
                    border: none;
                    cursor: pointer;
                    text-decoration: none;
                    transition: all 0.2s;
                }
                .btn-primary {
                    background: #3b82f6;
                    color: white;
                }
                .btn-primary:hover {
                    background: #2563eb;
                }
                .btn-danger {
                    background: #dc2626;
                    color: white;
                }
                .btn-danger:hover {
                    background: #b91c1c;
                }
                .card {
                    background: white;
                    border-radius: 8px;
                    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
                    padding: 20px;
                    margin: 10px 0;
                    border: 1px solid #e5e7eb;
                }
                .form-input {
                    width: 100%;
                    padding: 8px 12px;
                    border: 1px solid #d1d5db;
                    border-radius: 6px;
                    font-size: 14px;
                }
                .form-input:focus {
                    outline: none;
                    border-color: #3b82f6;
                    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
                }
                .text-red-600 { color: #dc2626; }
                .text-green-600 { color: #16a34a; }
                .text-yellow-600 { color: #ca8a04; }
                .text-blue-600 { color: #2563eb; }
                .bg-gray-50 { background: #f9fafb; }
                .bg-white { background: white; }
                .bg-blue-500 { background: #3b82f6; }
                .bg-red-500 { background: #ef4444; }
                .bg-green-500 { background: #10b981; }
                .shadow { box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
                .shadow-lg { box-shadow: 0 10px 15px rgba(0,0,0,0.1); }
                .rounded { border-radius: 6px; }
                .rounded-lg { border-radius: 8px; }
                .p-4 { padding: 16px; }
                .p-2 { padding: 8px; }
                .m-2 { margin: 8px; }
                .m-4 { margin: 16px; }
                .mb-4 { margin-bottom: 16px; }
                .mt-4 { margin-top: 16px; }
                .flex { display: flex; }
                .items-center { align-items: center; }
                .justify-between { justify-content: space-between; }
                .gap-2 { gap: 8px; }
                .gap-4 { gap: 16px; }
                .hidden { display: none !important; }
                .block { display: block; }
                .inline-block { display: inline-block; }
                .w-full { width: 100%; }
                .text-sm { font-size: 14px; }
                .text-lg { font-size: 18px; }
                .text-xl { font-size: 20px; }
                .font-bold { font-weight: bold; }
                .font-medium { font-weight: 500; }
                .text-center { text-align: center; }
                .text-left { text-align: left; }
                .text-right { text-align: right; }
                .cursor-pointer { cursor: pointer; }
                .transition { transition: all 0.15s ease-in-out; }

                /* Navigation styles */
                .sidebar {
                    background: #1f2937;
                    color: white;
                    width: 250px;
                    height: 100vh;
                    position: fixed;
                    left: 0;
                    top: 0;
                    overflow-y: auto;
                }
                .main-content {
                    margin-left: 250px;
                    min-height: 100vh;
                }

                /* Table styles */
                table {
                    width: 100%;
                    border-collapse: collapse;
                    background: white;
                    border-radius: 8px;
                    overflow: hidden;
                    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
                }
                th, td {
                    padding: 12px;
                    text-align: left;
                    border-bottom: 1px solid #e5e7eb;
                }
                th {
                    background: #f9fafb;
                    font-weight: 600;
                    color: #374151;
                }
                tr:hover {
                    background: #f9fafb;
                }

                /* Alert styles */
                .alert {
                    padding: 16px;
                    border-radius: 8px;
                    margin: 16px 0;
                    border: 1px solid transparent;
                }
                .alert-danger {
                    background: #fef2f2;
                    color: #991b1b;
                    border-color: #fecaca;
                }
                .alert-success {
                    background: #f0fdf4;
                    color: #166534;
                    border-color: #bbf7d0;
                }
                .alert-warning {
                    background: #fffbeb;
                    color: #92400e;
                    border-color: #fed7aa;
                }
                .alert-info {
                    background: #eff6ff;
                    color: #1e40af;
                    border-color: #bfdbfe;
                }
            `;

            const style = document.createElement('style');
            style.textContent = fallbackCSS;
            style.id = 'fallback-css';
            document.head.appendChild(style);

            // Add visual indicator that fallback is active
            this.showFallbackNotice();
        },

        // Load Font Awesome fallback
        loadFontAwesomeFallback: function() {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css';
            link.onload = () => console.log('✅ Font Awesome fallback loaded');
            link.onerror = () => console.error('❌ Font Awesome fallback failed');
            document.head.appendChild(link);
        },

        // Show notice that fallback CSS is active
        showFallbackNotice: function() {
            if (document.getElementById('css-fallback-notice')) return;

            const notice = document.createElement('div');
            notice.id = 'css-fallback-notice';
            notice.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                background: #fbbf24;
                color: #92400e;
                padding: 8px;
                text-align: center;
                font-size: 14px;
                z-index: 10000;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            `;
            notice.innerHTML = '⚠️ Using fallback styles - Some visual elements may appear different';

            document.body.insertBefore(notice, document.body.firstChild);

            // Auto-hide after 10 seconds
            setTimeout(() => {
                if (notice.parentNode) {
                    notice.remove();
                }
            }, 10000);
        },

        // Setup other fallback mechanisms
        setupFallbacks: function() {
            // Retry CSS loading if main stylesheet fails
            const mainCSS = document.querySelector('link[href*="tailwind.css"]');
            if (mainCSS) {
                mainCSS.onerror = () => {
                    console.warn('⚠️ Main CSS failed to load, trying fallback');
                    this.tryAlternativeCSS();
                };
            }
        },

        // Try alternative CSS sources
        tryAlternativeCSS: function() {
            const alternatives = ['/css/styles.css', '/css/style.min.css'];

            alternatives.forEach((href, index) => {
                setTimeout(() => {
                    const link = document.createElement('link');
                    link.rel = 'stylesheet';
                    link.href = href;
                    link.onload = () => console.log(`✅ Alternative CSS loaded: ${href}`);
                    document.head.appendChild(link);
                }, index * 1000);
            });
        }
    };

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => CSSLoader.init());
    } else {
        CSSLoader.init();
    }

    // Make available globally for debugging
    window.CSSLoader = CSSLoader;

})();
