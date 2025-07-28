class NotificationManager {
  constructor() {
    this.notifications = [];
    this.settings = {};
    this.pollingInterval = null;
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
      this.notifications = data.notifications || [];
      console.log('Loaded notifications:', this.notifications.length);
      this.updateUI();
    } catch (error) {
      console.error('Error loading notifications:', error);
      // Show empty state instead of error
      this.notifications = [];
      this.updateUI();
    }
  }

  async loadSettings() {
    try {
      const response = await fetch('/notifications/settings');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      this.settings = data.settings || [];
    } catch (error) {
      console.error('Error loading notification settings:', error);
      this.settings = [];
    }
  }

  updateUI() {
    const unreadCount = this.notifications.filter(n => !n.is_read).length;
    const countBadge = document.getElementById('notificationCount');
    const notificationList = document.getElementById('notificationList');

    // Update badge
    if (countBadge) {
      countBadge.textContent = unreadCount;
      countBadge.style.display = unreadCount > 0 ? 'flex' : 'none';
    }

    // Update notification list
    if (notificationList) {
      if (this.notifications.length === 0) {
        notificationList.innerHTML = '<div class="notification-empty">No notifications</div>';
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

    return `
      <a href="${notification.url || '#'}"
         class="notification-item ${isUnread ? 'unread' : ''}"
         data-notification-id="${notification.id}">
        <div class="notification-icon">
          <i class="${notification.icon || 'fas fa-bell'}"></i>
        </div>
        <div class="notification-content">
          <p class="notification-text">${notification.message || notification.title}</p>
          <span class="notification-time">${timeAgo}</span>
        </div>
      </a>
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

      // Update local state
      const notification = this.notifications.find(n => n.id === notificationId);
      if (notification) {
        notification.is_read = true;
        this.updateUI();
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

      // Update local state
      this.notifications.forEach(n => n.is_read = true);
      this.updateUI();
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  }

  setupEventListeners() {
    document.getElementById('notificationToggle').addEventListener('click', () => {
      this.loadNotifications();
    });

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
            notificationMenu.classList.remove('show');
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
      this.loadNotifications();
    }, 30000);
  }

  timeAgo(date) {
    const now = new Date();
    const diffInSeconds = Math.floor((now - date) / 1000);

    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    return `${Math.floor(diffInSeconds / 86400)}d ago`;
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
