// Confirm delete operations
document.addEventListener('DOMContentLoaded', function() {
  const deleteButtons = document.querySelectorAll('.delete-btn');

  deleteButtons.forEach(button => {
    button.addEventListener('click', function(e) {
      if (!confirm('Are you sure you want to delete this item?')) {
        e.preventDefault();
      }
    });
  });

  // Auto-hide alerts after 5 seconds
  const alerts = document.querySelectorAll('.alert');

  if (alerts.length > 0) {
    setTimeout(() => {
      alerts.forEach(alert => {
        alert.style.opacity = '0';
        alert.style.transition = 'opacity 0.5s ease';

        setTimeout(() => {
          alert.style.display = 'none';
        }, 500);
      });
    }, 5000);
  }
});
