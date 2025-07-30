class NotificationManager {
  constructor() {
    this.notifications = [];
    this.settings = {};
    this.pollingInterval = null;
    this.isPolling = false;
  }

  async init() {
    // Only initialize if notification elements exist
    const notificationCount = document.getElementById('notificationCount');
    const notificationToggle = document.getElementById('notificationToggle');

    if (notificationCount && notificationToggle) {
      console.log('Initializing notification manager...');
      await this.loadNotifications();
      await this.loadSettings();
      this.setupEventListeners();
      this.startPolling();
    } else {
      console.log('Notification elements not found, skipping initialization');
    }
  }

  async loadNotifications() {
    try {
      console.log('Loading notifications...');
      const response = await fetch('/notifications');

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (data.success) {
        this.notifications = data.notifications || [];
        console.log('Loaded notifications:', this.notifications.length);
        this.updateUI();
      } else {
        throw new Error(data.error || 'Failed to load notifications');
      }
    } catch (error) {
      console.error('Error loading notifications:', error);
      // Show empty state instead of error
      this.notifications = [];
      this.updateUI();
    }
  }

  async loadUnreadCount() {
    try {
      const response = await fetch('/notifications/unread-count');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      if (data.success) {
        return data.count;
      }
      return 0;
    } catch (error) {
      console.error('Error loading unread count:', error);
      return 0;
    }
  }

  async loadSettings() {
    try {
      const response = await fetch('/notifications/settings');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      if (data.success) {
        this.settings = data.settings || [];
      }
    } catch (error) {
      console.error('Error loading notification settings:', error);
      this.settings = [];
    }
  }

  updateUI() {
    const unreadCount = this.notifications.filter(n => !n.is_read).length;
    const countBadge = document.getElementById('notificationCount');
    const notificationList = document.getElementById('notificationList');
    const notificationLoading = document.getElementById('notificationLoading');

    // Update badge
    if (countBadge) {
      countBadge.textContent = unreadCount;
      countBadge.style.display = unreadCount > 0 ? 'flex' : 'none';
    }

    // Hide loading indicator
    if (notificationLoading) {
      notificationLoading.style.display = 'none';
    }

    // Update notification list
    if (notificationList) {
      if (this.notifications.length === 0) {
        notificationList.innerHTML = `
          <div class="px-5 py-8 text-center text-gray-500 dark:text-gray-400">
            <i class="fas fa-bell-slash text-2xl mb-2"></i>
            <p>No notifications</p>
          </div>
        `;
      } else {
        notificationList.innerHTML = this.notifications.slice(0, 10).map(notification =>
          this.renderNotification(notification)
        ).join('');
      }
    }
  }

  renderNotification(notification) {
    const isUnread = !notification.is_read;
    const timeAgo = this.timeAgo(new Date(notification.created_at));
    const bgClass = isUnread ? 'bg-blue-50 dark:bg-blue-900/30 border-l-4 border-blue-500 dark:border-blue-400' : 'hover:bg-gray-50 dark:hover:bg-gray-700/50';
    const iconColor = isUnread ? 'text-blue-500 dark:text-blue-300' : 'text-gray-400 dark:text-gray-500';

    return `
      <div class="notification-item ${bgClass} ${isUnread ? 'unread' : ''} cursor-pointer transition-colors duration-200"
           data-notification-id="${notification.id}"
           ${notification.url ? `onclick="window.location.href='${notification.url}'"` : ''}>
        <div class="flex items-start gap-3 px-5 py-4">
          <div class="flex-shrink-0 ${iconColor} mt-0.5">
            <i class="${notification.icon || 'fas fa-bell'} text-lg"></i>
          </div>
          <div class="flex-1 min-w-0">
            <div class="text-sm font-medium text-gray-900 dark:text-white mb-1 line-clamp-2">
              ${notification.title || notification.message}
            </div>
            ${notification.title && notification.message && notification.title !== notification.message ?
              `<div class="text-xs text-gray-600 dark:text-gray-300 mb-2 line-clamp-2">${notification.message}</div>` : ''
            }
            <div class="flex items-center gap-2">
              <span class="text-xs text-gray-500 dark:text-gray-400">${timeAgo}</span>
              ${isUnread ? '<span class="w-2 h-2 bg-blue-500 rounded-full"></span>' : ''}
            </div>
          </div>
        </div>
      </div>
    `;
  }

  async markAsRead(notificationId) {
    try {
      const response = await fetch(`/notifications/${notificationId}/read`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      if (data.success) {
        // Update local state
        const notification = this.notifications.find(n => n.id === notificationId);
        if (notification) {
          notification.is_read = true;
          this.updateUI();
        }
      }
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  }

  async markAllAsRead() {
    try {
      const response = await fetch('/notifications/mark-all-read', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      if (data.success) {
        // Update local state
        this.notifications.forEach(n => n.is_read = true);
        this.updateUI();
      }
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  }

  setupEventListeners() {
    const notificationToggle = document.getElementById('notificationToggle');
    const notificationMenu = document.getElementById('notificationMenu');

    // Toggle notification menu
    if (notificationToggle && notificationMenu) {
      notificationToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        notificationMenu.classList.toggle('hidden');

        // Refresh notifications when opening
        if (!notificationMenu.classList.contains('hidden')) {
          this.loadNotifications();
        }
      });

      // Close menu when clicking outside
      document.addEventListener('click', (e) => {
        if (!notificationMenu.contains(e.target) && !notificationToggle.contains(e.target)) {
          notificationMenu.classList.add('hidden');
        }
      });
    }

    // Mark all as read
    const markAllReadBtn = document.getElementById('markAllRead');
    if (markAllReadBtn) {
      markAllReadBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.markAllAsRead();
      });
    }

    // Mark individual notifications as read when clicked
    document.addEventListener('click', (e) => {
      const notificationItem = e.target.closest('.notification-item');
      if (notificationItem && notificationItem.classList.contains('unread')) {
        const notificationId = parseInt(notificationItem.dataset.notificationId);
        if (notificationId) {
          this.markAsRead(notificationId);

          // Close dropdown after clicking a notification
          const notificationMenu = document.getElementById('notificationMenu');
          if (notificationMenu) {
            notificationMenu.classList.add('hidden');
          }
        }
      }
    });
  }

  startPolling() {
    // Poll for new notifications every 30 seconds
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
    }

    this.pollingInterval = setInterval(() => {
      if (!this.isPolling) {
        this.isPolling = true;
        this.loadNotifications().finally(() => {
          this.isPolling = false;
        });
      }
    }, 30000);
  }

  timeAgo(date) {
    const now = new Date();
    const diffInSeconds = Math.floor((now - date) / 1000);

    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
    return new Date(date).toLocaleDateString();
  }

  destroy() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
    }
  }
}

// Initialize notification manager when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
  console.log('DOM loaded, initializing notifications...');
  window.notificationManager = new NotificationManager();
  window.notificationManager.init();
});

// Clean up when page unloads
window.addEventListener('beforeunload', function() {
  if (window.notificationManager) {
    window.notificationManager.destroy();
  }
});
