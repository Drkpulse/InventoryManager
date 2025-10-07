/**
 * Universal Confirmation System - CSP Compliant
 * Replaces all inline onsubmit="return confirm(...)" and onclick="confirmDelete(...)" handlers
 */

document.addEventListener('DOMContentLoaded', function() {
    console.log('🔒 Loading CSP-compliant confirmation system...');

    // Find all forms with data-confirm attribute and attach listeners
    function attachFormConfirmationHandlers() {
        const forms = document.querySelectorAll('form[data-confirm]');
        console.log(`📝 Found ${forms.length} forms requiring confirmation`);

        forms.forEach(form => {
            // Remove any existing listeners first
            form.removeEventListener('submit', handleFormSubmit);
            form.addEventListener('submit', handleFormSubmit);
        });

        console.log(`✅ Attached form confirmation handlers to ${forms.length} forms`);
    }

    function handleFormSubmit(e) {
        const message = e.target.getAttribute('data-confirm');
        if (message && !confirm(message)) {
            e.preventDefault();
            return false;
        }
        return true;
    }

    // Find all buttons with data-confirm-delete and attach click listeners
    function attachDeleteConfirmationHandlers() {
        const deleteButtons = document.querySelectorAll('[data-confirm-delete]');
        console.log(`🗑️ Found ${deleteButtons.length} delete buttons requiring confirmation`);

        deleteButtons.forEach(button => {
            // Remove any existing listeners first
            button.removeEventListener('click', handleDeleteClick);
            button.addEventListener('click', handleDeleteClick);
        });

        console.log(`✅ Attached delete confirmation handlers to ${deleteButtons.length} buttons`);
    }

    function handleDeleteClick(e) {
        const button = e.target.closest('[data-confirm-delete]');
        if (!button) return;

        const message = button.getAttribute('data-confirm-delete');
        const defaultMessage = 'Are you sure you want to delete this item? This action cannot be undone.';

        if (!confirm(message || defaultMessage)) {
            e.preventDefault();
            return false;
        }

        // If button is in a form, submit it
        const form = button.closest('form');
        if (form) {
            form.submit();
            return false;
        }

        // If button has data-action, navigate to it
        const action = button.getAttribute('data-action');
        if (action) {
            window.location.href = action;
            return false;
        }

        return true;
    }

    // Global confirmDelete function for backwards compatibility
    window.confirmDelete = function(...args) {
        let message = 'Are you sure you want to delete this item? This action cannot be undone.';

        if (args.length > 0) {
            // Try to construct a meaningful message from arguments
            if (typeof args[0] === 'string' && typeof args[1] === 'string') {
                message = `Are you sure you want to delete "${args[1]}" (${args[0]})? This action cannot be undone.`;
            } else if (typeof args[0] === 'string') {
                message = `Are you sure you want to delete "${args[0]}"? This action cannot be undone.`;
            } else if (typeof args[1] === 'string') {
                message = `Are you sure you want to delete "${args[1]}"? This action cannot be undone.`;
            }
        }

        return confirm(message);
    };

    // Also handle any forms/buttons that might be added dynamically
    function handleDynamicContent() {
        const observer = new MutationObserver(function(mutations) {
            mutations.forEach(function(mutation) {
                mutation.addedNodes.forEach(function(node) {
                    if (node.nodeType === 1) { // Element node
                        const newForms = node.querySelectorAll ? node.querySelectorAll('form[data-confirm]') : [];
                        const newButtons = node.querySelectorAll ? node.querySelectorAll('[data-confirm-delete]') : [];

                        if (newForms.length > 0 || newButtons.length > 0) {
                            console.log(`🔄 Found ${newForms.length} new forms and ${newButtons.length} new buttons, attaching handlers...`);
                            attachFormConfirmationHandlers();
                            attachDeleteConfirmationHandlers();
                        }
                    }
                });
            });
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    // Initialize
    attachFormConfirmationHandlers();
    attachDeleteConfirmationHandlers();
    handleDynamicContent();

    console.log('🛡️ CSP-compliant confirmation system loaded');
});
