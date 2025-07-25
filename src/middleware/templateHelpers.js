// Template helper middleware to provide common functions to all templates

function templateHelpers(req, res, next) {
  // Helper function to safely access formData
  res.locals.getFormValue = function(fieldName, defaultValue = '') {
    if (typeof formData !== 'undefined' && formData && formData[fieldName]) {
      return formData[fieldName];
    }
    if (typeof locals !== 'undefined' && locals.formData && locals.formData[fieldName]) {
      return locals.formData[fieldName];
    }
    return defaultValue;
  };

  // Helper function to check if form field is selected
  res.locals.isSelected = function(fieldName, value) {
    const formValue = res.locals.getFormValue(fieldName);
    return formValue == value;
  };

  // Helper function to check if checkbox should be checked
  res.locals.isChecked = function(fieldName, checkValue = true) {
    const formValue = res.locals.getFormValue(fieldName);
    if (checkValue === true) {
      return formValue === 'true' || formValue === true || formValue === 'on';
    }
    return formValue == checkValue;
  };

  // Helper function to safely get query parameters
  res.locals.getQueryValue = function(paramName, defaultValue = '') {
    if (typeof query !== 'undefined' && query && query[paramName]) {
      return query[paramName];
    }
    if (typeof locals !== 'undefined' && locals.query && locals.query[paramName]) {
      return locals.query[paramName];
    }
    return defaultValue;
  };

  // Helper function for translations with fallback
  res.locals.translate = function(key, params = {}) {
    if (typeof res.locals.t === 'function') {
      return res.locals.t(key, params);
    }
    return key; // Fallback to key if translation function not available
  };

  // Helper function to format currency
  res.locals.formatCurrency = function(amount, currency = '€') {
    if (!amount || isNaN(amount)) return `0.00 ${currency}`;
    return `${parseFloat(amount).toFixed(2)} ${currency}`;
  };

  // Helper function to format date
  res.locals.formatDate = function(date, format = 'short') {
    if (!date) return '';
    const d = new Date(date);
    if (isNaN(d.getTime())) return '';
    
    if (format === 'short') {
      return d.toLocaleDateString();
    } else if (format === 'long') {
      return d.toLocaleDateString(undefined, { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
    }
    return d.toISOString().split('T')[0]; // YYYY-MM-DD format
  };

  // Helper function to safely check if item exists in array
  res.locals.inArray = function(needle, haystack) {
    if (!Array.isArray(haystack)) return false;
    return haystack.includes(needle);
  };

  // Debug helper
  res.locals.debug = function(obj, label = 'Debug') {
    console.log(`🐛 ${label}:`, obj);
    return ''; // Return empty string so it doesn't show in template
  };

  next();
}

module.exports = templateHelpers;