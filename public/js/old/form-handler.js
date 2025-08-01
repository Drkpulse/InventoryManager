/**
 * Form Handler - Handles AJAX form submissions for POST, PUT, DELETE methods
 */
document.addEventListener('DOMContentLoaded', function() {
  // Find all forms that should be handled via AJAX
  document.addEventListener('submit', async function(event) {
    const form = event.target;

    console.log('Form intercepted:', form.action, 'Method:', form.method);
    console.log('Has data-no-ajax attribute:', form.hasAttribute('data-no-ajax'));

    // Skip forms that shouldn't be handled via AJAX
    if (form.hasAttribute('data-no-ajax') ||
        form.hasAttribute('target') ||
        form.id === 'loginForm' ||
        form.action.includes('/auth/login')) {
      console.log('Skipping AJAX handling for form:', form.action);
      return; // Let the default submission happen
    }

    // Add data-no-ajax for specific forms that should use regular submissions
    // This is a patch to ensure critical forms work properly
    if (form.action.includes('/items') ||
        form.action.includes('/employees') ||
        form.action.includes('/departments') ||
        form.action.includes('/references')) {
      console.log('Critical form detected, skipping AJAX handling for:', form.action);
      return; // Let the default submission happen
    }

    // For POST, PUT, DELETE forms, we need to handle them specially
    if (form.method.toLowerCase() === 'post' ||
        form.getAttribute('data-method') === 'put' ||
        form.getAttribute('data-method') === 'delete') {
      event.preventDefault();

      // Get the form action URL
      const url = form.action;

      try {
        // Show loading indicator
        if (window.showLoadingIndicator) {
          window.showLoadingIndicator();
        }

        // Prepare form data
        const formData = new FormData(form);

        // Set the HTTP method (default to POST if not specified)
        const method = form.getAttribute('data-method') || form.method;

        // Log what's being submitted for debugging
        console.log('Submitting form via AJAX to:', url);
        console.log('Form data:', Object.fromEntries(formData));

        // Send the form data
        const response = await fetch(url, {
          method: method.toUpperCase(),
          body: formData,
          headers: {
            'X-Requested-With': 'XMLHttpRequest'
          }
        });

        // Process the response
        if (response.redirected) {
          // If server redirected, follow the redirect
          if (window.loadContent) {
            window.loadContent(response.url);
          } else {
            window.location.href = response.url;
          }
        } else {
          const contentType = response.headers.get('Content-Type');

          if (contentType && contentType.includes('application/json')) {
            // Handle JSON response
            const data = await response.json();

            if (data.success) {
              // If successful, show success message and potentially redirect
              if (data.redirect) {
                if (window.loadContent) {
                  window.loadContent(data.redirect);
                } else {
                  window.location.href = data.redirect;
                }
              } else {
                // Show success message
                showMessage('success', data.message || 'Operation completed successfully');

                // If we have a reload flag, reload the current page
                if (data.reload) {
                  if (window.loadContent) {
                    window.loadContent(window.location.pathname);
                  } else {
                    window.location.reload();
                  }
                }
              }
            } else {
              // Show error message
              showMessage('danger', data.message || 'An error occurred');

              // If validation errors are provided, highlight them
              if (data.errors) {
                highlightFormErrors(form, data.errors);
              }
            }
          } else {
            // For non-JSON responses, just reload the current page
            if (window.loadContent) {
              window.loadContent(window.location.pathname);
            } else {
              window.location.reload();
            }
          }
        }
      } catch (error) {
        console.error('Form submission error:', error);
        showMessage('danger', 'Form submission failed. Please try again.');
      } finally {
        // Hide loading indicator
        if (window.hideLoadingIndicator) {
          window.hideLoadingIndicator();
        }
      }
    }
  });

  // Function to show messages
  function showMessage(type, message) {
    // Create alert element
    const alert = document.createElement('div');
    alert.className = `alert alert-${type}`;
    alert.innerHTML = message;

    // Find a good place to show the message
    const mainContent = document.querySelector('main');
    if (mainContent) {
      // Insert at the top of the main content
      mainContent.insertBefore(alert, mainContent.firstChild);
    } else {
      // Fallback - create a floating message
      alert.style.position = 'fixed';
      alert.style.top = '70px';
      alert.style.left = '50%';
      alert.style.transform = 'translateX(-50%)';
      alert.style.zIndex = '9999';
      alert.style.minWidth = '300px';
      document.body.appendChild(alert);
    }

    // Auto-hide after 5 seconds
    setTimeout(() => {
      alert.style.opacity = '0';
      alert.style.transition = 'opacity 0.5s ease';
      setTimeout(() => {
        if (alert.parentNode) {
          alert.parentNode.removeChild(alert);
        }
      }, 500);
    }, 5000);
  }

  // Function to highlight form errors
  function highlightFormErrors(form, errors) {
    // Reset previous errors
    form.querySelectorAll('.is-invalid').forEach(field => {
      field.classList.remove('is-invalid');
    });
    form.querySelectorAll('.invalid-feedback').forEach(message => {
      message.parentNode.removeChild(message);
    });

    // Highlight each field with an error
    Object.keys(errors).forEach(fieldName => {
      const field = form.querySelector(`[name="${fieldName}"]`);
      if (field) {
        // Add error class
        field.classList.add('is-invalid');

        // Add error message
        const errorMessage = document.createElement('div');
        errorMessage.className = 'invalid-feedback';
        errorMessage.textContent = errors[fieldName];
        field.parentNode.appendChild(errorMessage);
      }
    });
  }
});
