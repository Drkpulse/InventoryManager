/**
 * Central Event Handler System
 * Handles common UI interactions to replace inline event handlers
 * Helps maintain Content Security Policy compliance
 */

(function() {
    'use strict';

    // Global event delegation system
    const EventSystem = {

        // Initialize all event listeners when DOM is ready
        init: function() {
            document.addEventListener('DOMContentLoaded', this.setupEventListeners.bind(this));
        },

        setupEventListeners: function() {
            // Use event delegation for common patterns
            document.addEventListener('click', this.handleClick.bind(this));
            document.addEventListener('change', this.handleChange.bind(this));
            document.addEventListener('submit', this.handleSubmit.bind(this));
        },

        handleClick: function(event) {
            const target = event.target;
            const action = target.getAttribute('data-action');
            const closestButton = target.closest('button[data-action]');
            const closestLink = target.closest('a[data-action]');

            // Handle button clicks
            if (closestButton && closestButton.getAttribute('data-action')) {
                this.executeAction(closestButton, closestButton.getAttribute('data-action'), event);
            }
            // Handle link clicks
            else if (closestLink && closestLink.getAttribute('data-action')) {
                event.preventDefault();
                this.executeAction(closestLink, closestLink.getAttribute('data-action'), event);
            }
            // Handle direct data-action
            else if (action) {
                this.executeAction(target, action, event);
            }
        },

        handleChange: function(event) {
            const target = event.target;
            const action = target.getAttribute('data-change-action');

            if (action) {
                this.executeAction(target, action, event);
            }
        },

        handleSubmit: function(event) {
            const form = event.target;
            const action = form.getAttribute('data-submit-action');

            if (action) {
                return this.executeAction(form, action, event);
            }
        },

        executeAction: function(element, action, event) {
            const params = this.getActionParams(element);

            switch(action) {
                case 'confirm-delete':
                    return this.confirmDelete(params, event);

                case 'toggle-password':
                    return this.togglePassword(params);

                case 'close-modal':
                    return this.closeModal(params);

                case 'filter-table':
                    return this.filterTable(params, event);

                case 'export-data':
                    return this.exportData(params);

                case 'print-page':
                    return this.printPage();

                case 'go-back':
                    return this.goBack();

                case 'reload-page':
                    return this.reloadPage();

                case 'remove-element':
                    return this.removeElement(element);

                case 'show-modal':
                    return this.showModal(params);

                default:
                    console.warn('Unknown action:', action);
                    return true;
            }
        },

        getActionParams: function(element) {
            const params = {};

            // Extract data attributes as parameters
            Array.from(element.attributes).forEach(attr => {
                if (attr.name.startsWith('data-param-')) {
                    const paramName = attr.name.replace('data-param-', '');
                    params[paramName] = attr.value;
                }
            });

            return params;
        },

        // Common action implementations
        confirmDelete: function(params, event) {
            const name = params.name || 'this item';
            const message = params.message || `Are you sure you want to delete ${name}? This action cannot be undone.`;

            if (!confirm(message)) {
                event.preventDefault();
                return false;
            }
            return true;
        },

        togglePassword: function(params) {
            const targetId = params.target || 'password';
            const iconId = params.icon || 'passwordToggleIcon';

            const passwordInput = document.getElementById(targetId);
            const toggleIcon = document.getElementById(iconId);

            if (passwordInput && toggleIcon) {
                if (passwordInput.type === 'password') {
                    passwordInput.type = 'text';
                    toggleIcon.className = 'fas fa-eye-slash';
                } else {
                    passwordInput.type = 'password';
                    toggleIcon.className = 'fas fa-eye';
                }
            }
        },

        closeModal: function(params) {
            const modalId = params.modal;
            if (modalId) {
                const modal = document.getElementById(modalId);
                if (modal) {
                    modal.style.display = 'none';
                    modal.classList.add('hidden');
                }
            }
        },

        filterTable: function(params, event) {
            const filterType = params.type;
            const filterValue = event.target.value;
            const targetFunction = params.function;

            // Call the specific filter function if it exists
            if (window[targetFunction] && typeof window[targetFunction] === 'function') {
                window[targetFunction](filterType, filterValue);
            }
        },

        exportData: function(params) {
            const exportType = params.type;
            const targetFunction = params.function;

            if (window[targetFunction] && typeof window[targetFunction] === 'function') {
                window[targetFunction](exportType);
            }
        },

        printPage: function() {
            window.print();
        },

        goBack: function() {
            history.back();
        },

        reloadPage: function() {
            window.location.reload();
        },

        removeElement: function(element) {
            const target = element.closest(element.getAttribute('data-param-target') || element.tagName);
            if (target && target.parentElement) {
                target.parentElement.removeChild(target);
            }
        },

        showModal: function(params) {
            const modalId = params.modal;
            const targetFunction = params.function;

            if (modalId) {
                const modal = document.getElementById(modalId);
                if (modal) {
                    modal.style.display = 'block';
                    modal.classList.remove('hidden');
                }
            }

            if (targetFunction && window[targetFunction] && typeof window[targetFunction] === 'function') {
                window[targetFunction](params);
            }
        }
    };

    // Initialize the event system
    EventSystem.init();

    // Make EventSystem globally available for custom extensions
    window.EventSystem = EventSystem;

})();
