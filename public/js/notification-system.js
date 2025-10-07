/**
 * Advanced Notification System
 * A modern, feature-rich notification system with toast notifications,
 * real-time updates, queue management, and enhanced UX
 */

class AdvancedNotificationSystem {
  constructor(options = {}) {
    this.options = {
      maxToasts: 5,
      defaultDuration: 5000,
      pollingInterval: 30000,
      enableSounds: true,
      enableAnimations: true,
      position: 'top-right',
      enableBrowserNotifications: false,
      ...options
    };

    // State management
    this.notifications = [];
    this.toasts = new Map();
    this.settings = {};
    this.isInitialized = false;
    this.pollingInterval = null;
    this.audioContext = null;
    this.sounds = {};

    // DOM elements
    this.elements = {};

    // Queue management
    this.toastQueue = [];
    this.isProcessingQueue = false;

    // Event listeners array for cleanup
    this.eventListeners = [];

    this.init();
  }

  async init() {
    try {
      this.setupDOM();
      await this.loadSettings();
      await this.loadNotifications();
      this.setupEventListeners();
      this.setupAudio();
      this.startPolling();
      this.requestBrowserPermissions();

      this.isInitialized = true;
      console.log('✅ Advanced Notification System initialized');
    } catch (error) {
      console.error('❌ Failed to initialize notification system:', error);
    }
  }

  setupDOM() {
    // Find existing elements
    this.elements = {
      toggle: document.getElementById('notificationToggle'),
      count: document.getElementById('notificationCount'),
      menu: document.getElementById('notificationMenu'),
      list: document.getElementById('notificationList'),
      markAllRead: document.getElementById('markAllRead'),
      loading: document.getElementById('notificationLoading')
    };

    // Create toast container if it doesn't exist
    if (!document.getElementById('toast-container')) {
      this.createToastContainer();
    }
    this.elements.toastContainer = document.getElementById('toast-container');

    // Create notification sounds toggle if it doesn't exist
    this.createSoundToggle();
  }

  createToastContainer() {
    const container = document.createElement('div');
    container.id = 'toast-container';
    container.className = `fixed z-[9999] pointer-events-none ${this.getPositionClasses()}`;
    container.style.cssText = `
      max-width: 400px;
      width: 100%;
    `;
    document.body.appendChild(container);
  }

  getPositionClasses() {
    const positions = {
      'top-right': 'top-4 right-4',
      'top-left': 'top-4 left-4',
      'bottom-right': 'bottom-4 right-4',
      'bottom-left': 'bottom-4 left-4',
      'top-center': 'top-4 left-1/2 transform -translate-x-1/2',
      'bottom-center': 'bottom-4 left-1/2 transform -translate-x-1/2'
    };
    return positions[this.options.position] || positions['top-right'];
  }

  createSoundToggle() {
    if (!this.elements.toggle || document.getElementById('sound-toggle')) return;

    const soundToggle = document.createElement('button');
    soundToggle.id = 'sound-toggle';
    soundToggle.className = 'ml-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors';
    soundToggle.innerHTML = '<i class="fas fa-volume-up text-sm"></i>';
    soundToggle.title = 'Toggle notification sounds';

    this.elements.toggle.parentElement.appendChild(soundToggle);

    soundToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleSounds();
    });
  }

  async loadSettings() {
    try {
      const response = await fetch('/notifications/settings');
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          this.settings = data.settings || [];
        }
      }
    } catch (error) {
      console.error('Error loading notification settings:', error);
    }
  }

  async loadNotifications() {
    try {
      const response = await fetch('/notifications');
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const contentType = response.headers.get('content-type');
      if (!contentType?.includes('application/json')) {
        throw new Error('Invalid response type');
      }

      const data = await response.json();
      if (data.success) {
        const oldCount = this.notifications.filter(n => !n.is_read).length;
        this.notifications = data.notifications || [];
        const newCount = this.notifications.filter(n => !n.is_read).length;

        this.updateUI();

        // Show toast for new notifications (only if we had notifications before)
        if (oldCount < newCount && this.isInitialized) {
          const newNotifications = this.notifications
            .filter(n => !n.is_read)
            .slice(0, newCount - oldCount);

          newNotifications.forEach(notification => {
            this.showToast({
              type: this.getNotificationToastType(notification.type_name),
              title: notification.title,
              message: this.truncateMessage(notification.message, 80),
              duration: 6000,
              onClick: () => {
                if (notification.url) {
                  // Use simple SPA navigation
                  if (window.spaController) {
                    window.spaController.navigateToUrl(notification.url);
                  } else {
                    window.location.href = notification.url;
                  }
                }
                this.markAsRead(notification.id);
              }
            });
          });

          // Play sound for new notifications
          if (newNotifications.length > 0) {
            this.playNotificationSound('new');
          }
        }
      }
    } catch (error) {
      console.error('Error loading notifications:', error);
      this.notifications = [];
      this.updateUI();
    }
  }

  updateUI() {
    const unreadCount = this.notifications.filter(n => !n.is_read).length;

    // Update badge
    if (this.elements.count) {
      this.elements.count.textContent = unreadCount;
      this.elements.count.style.display = unreadCount > 0 ? 'flex' : 'none';

      // Add pulsing animation for new notifications
      if (unreadCount > 0) {
        this.elements.count.classList.add('animate-pulse');
        setTimeout(() => {
          this.elements.count?.classList.remove('animate-pulse');
        }, 2000);
      }
    }

    // Update notification list
    if (this.elements.list) {
      if (this.notifications.length === 0) {
        this.elements.list.innerHTML = this.getEmptyState();
      } else {
        this.elements.list.innerHTML = this.notifications
          .slice(0, 10)
          .map(notification => this.renderNotification(notification))
          .join('');
      }
    }

    // Hide loading indicator
    if (this.elements.loading) {
      this.elements.loading.style.display = 'none';
    }

    // Update browser tab title if there are unread notifications
    this.updateTabTitle(unreadCount);
  }

  getEmptyState() {
    return `
      <div class="px-6 py-12 text-center">
        <div class="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
          <i class="fas fa-bell-slash text-2xl text-gray-400 dark:text-gray-500"></i>
        </div>
        <h3 class="text-sm font-medium text-gray-900 dark:text-white mb-2">No notifications</h3>
        <p class="text-xs text-gray-500 dark:text-gray-400">You're all caught up!</p>
      </div>
    `;
  }

  renderNotification(notification) {
    const isUnread = !notification.is_read;
    const timeAgo = this.timeAgo(new Date(notification.created_at));
    const bgClass = isUnread
      ? 'bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500 dark:border-blue-400'
      : '';

    const iconColor = this.getNotificationIconColor(notification.type_name);
    const icon = notification.icon || this.getNotificationIcon(notification.type_name);

    let displayMessage = notification.message;
    if (notification.type_name === 'security_alert' && notification.data?.short_error) {
      displayMessage = notification.data.short_error;
    }

    return `
      <div class="notification-item group ${bgClass} cursor-pointer transition-all duration-200 hover:bg-gray-50 dark:hover:bg-gray-700/50"
           data-notification-id="${notification.id}"
           data-url="${notification.url || ''}"
           data-unread="${isUnread}">
        <div class="flex items-start gap-3 px-4 py-3 relative">
          <!-- Status indicator -->
          ${isUnread ? '<div class="absolute left-1 top-3 w-2 h-2 bg-blue-500 dark:bg-blue-400 rounded-full"></div>' : ''}

          <!-- Icon -->
          <div class="flex-shrink-0 ${iconColor} mt-0.5">
            <i class="${icon} text-lg"></i>
          </div>

          <!-- Content -->
          <div class="flex-1 min-w-0">
            <div class="flex items-start justify-between mb-1">
              <h4 class="text-sm font-medium text-gray-900 dark:text-white line-clamp-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                ${this.escapeHtml(notification.title)}
              </h4>
              ${isUnread ? '<div class="ml-2 w-1.5 h-1.5 bg-blue-500 dark:bg-blue-400 rounded-full flex-shrink-0"></div>' : ''}
            </div>

            ${notification.title !== displayMessage ?
              `<p class="text-xs text-gray-600 dark:text-gray-300 mb-2 line-clamp-2">${this.escapeHtml(displayMessage)}</p>` :
              ''}

            <div class="flex items-center justify-between">
              <span class="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                <i class="far fa-clock"></i>
                ${timeAgo}
              </span>

              <!-- Action buttons -->
              <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                ${isUnread ?
                  `<button class="mark-read-btn p-1 text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300" title="Mark as read">
                    <i class="fas fa-check"></i>
                  </button>` :
                  `<button class="mark-unread-btn p-1 text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300" title="Mark as unread">
                    <i class="fas fa-undo"></i>
                  </button>`
                }
                <button class="delete-btn p-1 text-xs text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300" title="Delete">
                  <i class="fas fa-trash"></i>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  getNotificationIcon(type) {
    const icons = {
      'admin_broadcast': 'fas fa-bullhorn',
      'warranty_expiring': 'fas fa-exclamation-triangle',
      'warranty_expired': 'fas fa-times-circle',
      'item_assignment': 'fas fa-hand-holding',
      'item_unassignment': 'fas fa-hand',
      'system_update': 'fas fa-cog',
      'security_alert': 'fas fa-shield-alt'
    };
    return icons[type] || 'fas fa-bell';
  }

  getNotificationIconColor(type) {
    const colors = {
      'admin_broadcast': 'text-red-500 dark:text-red-400',
      'warranty_expiring': 'text-yellow-500 dark:text-yellow-400',
      'warranty_expired': 'text-red-500 dark:text-red-400',
      'item_assignment': 'text-green-500 dark:text-green-400',
      'item_unassignment': 'text-orange-500 dark:text-orange-400',
      'system_update': 'text-blue-500 dark:text-blue-400',
      'security_alert': 'text-red-500 dark:text-red-400'
    };
    return colors[type] || 'text-gray-500 dark:text-gray-400';
  }

  getNotificationToastType(type) {
    const types = {
      'admin_broadcast': 'info',
      'warranty_expiring': 'warning',
      'warranty_expired': 'error',
      'item_assignment': 'success',
      'item_unassignment': 'info',
      'system_update': 'info',
      'security_alert': 'error'
    };
    return types[type] || 'info';
  }

  async showToast(options = {}) {
    const toastOptions = {
      type: 'info',
      title: '',
      message: '',
      duration: this.options.defaultDuration,
      showClose: true,
      onClick: null,
      actionButton: null,
      ...options
    };

    // Add to queue if we have too many toasts
    if (this.toasts.size >= this.options.maxToasts) {
      this.toastQueue.push(toastOptions);
      return;
    }

    const toastId = 'toast_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    const toast = this.createToastElement(toastId, toastOptions);

    this.elements.toastContainer.appendChild(toast);
    this.toasts.set(toastId, { element: toast, options: toastOptions });

    // Animate in
    requestAnimationFrame(() => {
      toast.classList.remove('translate-x-full', 'opacity-0');
      toast.classList.add('translate-x-0', 'opacity-100');
    });

    // Auto remove
    if (toastOptions.duration > 0) {
      setTimeout(() => {
        this.removeToast(toastId);
      }, toastOptions.duration);
    }

    // Process queue
    this.processToastQueue();

    return toastId;
  }

  createToastElement(toastId, options) {
    const toast = document.createElement('div');
    toast.id = toastId;
    toast.className = `
      toast-notification pointer-events-auto
      transform transition-all duration-300 ease-out
      translate-x-full opacity-0
      mb-2 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700
      min-h-[4rem] flex items-start gap-3 p-4 relative overflow-hidden
      hover:shadow-xl hover:scale-[1.02]
    `.replace(/\s+/g, ' ').trim();

    const iconColors = {
      success: 'text-green-500',
      error: 'text-red-500',
      warning: 'text-yellow-500',
      info: 'text-blue-500'
    };

    const icons = {
      success: 'fas fa-check-circle',
      error: 'fas fa-times-circle',
      warning: 'fas fa-exclamation-triangle',
      info: 'fas fa-info-circle'
    };

    const borderColors = {
      success: 'border-l-green-500',
      error: 'border-l-red-500',
      warning: 'border-l-yellow-500',
      info: 'border-l-blue-500'
    };

    toast.innerHTML = `
      <!-- Progress bar -->
      <div class="absolute top-0 left-0 h-1 bg-gray-200 dark:bg-gray-700 w-full">
        <div class="h-full ${options.type === 'success' ? 'bg-green-500' : options.type === 'error' ? 'bg-red-500' : options.type === 'warning' ? 'bg-yellow-500' : 'bg-blue-500'} transition-all ease-linear duration-${options.duration}"
             style="width: 100%; animation: shrink ${options.duration}ms linear forwards;"></div>
      </div>

      <!-- Left border -->
      <div class="absolute left-0 top-0 w-1 h-full ${borderColors[options.type] || borderColors.info}"></div>

      <!-- Icon -->
      <div class="flex-shrink-0 ${iconColors[options.type] || iconColors.info} mt-0.5">
        <i class="${icons[options.type] || icons.info} text-xl"></i>
      </div>

      <!-- Content -->
      <div class="flex-1 min-w-0">
        ${options.title ? `<h4 class="font-medium text-gray-900 dark:text-white mb-1 line-clamp-2">${this.escapeHtml(options.title)}</h4>` : ''}
        ${options.message ? `<p class="text-sm text-gray-600 dark:text-gray-300 line-clamp-3">${this.escapeHtml(options.message)}</p>` : ''}

        ${options.actionButton ? `
          <button class="mt-2 px-3 py-1 text-xs font-medium text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 border border-blue-300 hover:border-blue-400 dark:border-blue-500 dark:hover:border-blue-400 rounded transition-colors">
            ${options.actionButton.text}
          </button>
        ` : ''}
      </div>

      <!-- Close button -->
      ${options.showClose ? `
        <button class="close-toast-btn flex-shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors ml-2">
          <i class="fas fa-times"></i>
        </button>
      ` : ''}
    `;

    // Add click handler
    if (options.onClick) {
      toast.style.cursor = 'pointer';
      toast.addEventListener('click', (e) => {
        if (!e.target.closest('.close-toast-btn') && !e.target.closest('button')) {
          options.onClick();
          this.removeToast(toastId);
        }
      });
    }

    // Add close button handler
    const closeBtn = toast.querySelector('.close-toast-btn');
    if (closeBtn) {
      closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.removeToast(toastId);
      });
    }

    // Add action button handler
    const actionBtn = toast.querySelector('button:not(.close-toast-btn)');
    if (actionBtn && options.actionButton?.onClick) {
      actionBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        options.actionButton.onClick();
      });
    }

    return toast;
  }

  removeToast(toastId) {
    const toastData = this.toasts.get(toastId);
    if (!toastData) return;

    const toast = toastData.element;

    // Animate out
    toast.classList.remove('translate-x-0', 'opacity-100');
    toast.classList.add('translate-x-full', 'opacity-0');

    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
      this.toasts.delete(toastId);
      this.processToastQueue();
    }, 300);
  }

  processToastQueue() {
    if (this.isProcessingQueue || this.toastQueue.length === 0 || this.toasts.size >= this.options.maxToasts) {
      return;
    }

    this.isProcessingQueue = true;
    const nextToast = this.toastQueue.shift();

    setTimeout(() => {
      this.showToast(nextToast);
      this.isProcessingQueue = false;
      this.processToastQueue();
    }, 100);
  }

  setupEventListeners() {
    // Notification menu toggle
    if (this.elements.toggle && this.elements.menu) {
      const toggleHandler = (e) => {
        e.preventDefault();
        e.stopPropagation();

        const isHidden = this.elements.menu.classList.contains('hidden') ||
                        this.elements.menu.style.display === 'none';

        if (isHidden) {
          // Show dropdown
          this.elements.menu.style.display = 'block';
          this.elements.menu.classList.remove('hidden', 'opacity-0', 'scale-95');
          this.elements.menu.classList.add('show', 'opacity-100', 'scale-100');

          this.loadNotifications(); // Refresh when opening
        } else {
          // Hide dropdown
          this.elements.menu.classList.add('opacity-0', 'scale-95');
          this.elements.menu.classList.remove('opacity-100', 'scale-100', 'show');

          // Hide after animation
          setTimeout(() => {
            this.elements.menu.classList.add('hidden');
            this.elements.menu.style.display = 'none';
          }, 200);
        }
      };

      this.elements.toggle.addEventListener('click', toggleHandler);
      this.eventListeners.push({ element: this.elements.toggle, event: 'click', handler: toggleHandler });
    }

    // Close menu when clicking outside
    const outsideClickHandler = (e) => {
      if (this.elements.menu && this.elements.toggle &&
          !this.elements.menu.contains(e.target) &&
          !this.elements.toggle.contains(e.target) &&
          !this.elements.menu.classList.contains('hidden')) {

        // Hide with animation
        this.elements.menu.classList.add('opacity-0', 'scale-95');
        this.elements.menu.classList.remove('opacity-100', 'scale-100');

        setTimeout(() => {
          this.elements.menu.classList.add('hidden');
        }, 200);
      }
    };

    document.addEventListener('click', outsideClickHandler);
    this.eventListeners.push({ element: document, event: 'click', handler: outsideClickHandler });

    // Mark all as read
    if (this.elements.markAllRead) {
      const markAllHandler = (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.markAllAsRead();
      };

      this.elements.markAllRead.addEventListener('click', markAllHandler);
      this.eventListeners.push({ element: this.elements.markAllRead, event: 'click', handler: markAllHandler });
    }

    // Notification item interactions
    const notificationHandler = (e) => {
      const notificationItem = e.target.closest('.notification-item');
      if (!notificationItem) return;

      const notificationId = parseInt(notificationItem.dataset.notificationId);
      const url = notificationItem.dataset.url;
      const isUnread = notificationItem.dataset.unread === 'true';

      // Handle different button clicks
      if (e.target.closest('.mark-read-btn')) {
        e.stopPropagation();
        this.markAsRead(notificationId);
        return;
      }

      if (e.target.closest('.mark-unread-btn')) {
        e.stopPropagation();
        this.markAsUnread(notificationId);
        return;
      }

      if (e.target.closest('.delete-btn')) {
        e.stopPropagation();
        this.deleteNotification(notificationId);
        return;
      }

      // Handle main notification click
      if (isUnread) {
        this.markAsRead(notificationId);
      }

      if (url) {
        this.elements.menu?.classList.add('hidden');
        // Use simple SPA navigation
        if (window.spaController) {
          window.spaController.navigateToUrl(url);
        } else {
          window.location.href = url;
        }
      }
    };

    if (this.elements.list) {
      this.elements.list.addEventListener('click', notificationHandler);
      this.eventListeners.push({ element: this.elements.list, event: 'click', handler: notificationHandler });
    }

    // Keyboard shortcuts
    const keyHandler = (e) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case 'n':
            e.preventDefault();
            this.elements.toggle?.click();
            break;
          case 'm':
            if (e.shiftKey) {
              e.preventDefault();
              this.markAllAsRead();
            }
            break;
        }
      }
    };

    document.addEventListener('keydown', keyHandler);
    this.eventListeners.push({ element: document, event: 'keydown', handler: keyHandler });
  }

  async markAsRead(notificationId) {
    try {
      const response = await fetch(`/notifications/${notificationId}/read`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' }
      });

      if (response.ok) {
        const notification = this.notifications.find(n => n.id === notificationId);
        if (notification) {
          notification.is_read = true;
          notification.read_at = new Date().toISOString();
          this.updateUI();
          this.playNotificationSound('read');
        }
      }
    } catch (error) {
      console.error('Error marking notification as read:', error);
      this.showToast({
        type: 'error',
        title: 'Error',
        message: 'Failed to mark notification as read',
        duration: 3000
      });
    }
  }

  async markAsUnread(notificationId) {
    try {
      const response = await fetch(`/notifications/${notificationId}/unread`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' }
      });

      if (response.ok) {
        const notification = this.notifications.find(n => n.id === notificationId);
        if (notification) {
          notification.is_read = false;
          notification.read_at = null;
          this.updateUI();
        }
      }
    } catch (error) {
      console.error('Error marking notification as unread:', error);
      this.showToast({
        type: 'error',
        title: 'Error',
        message: 'Failed to mark notification as unread',
        duration: 3000
      });
    }
  }

  async deleteNotification(notificationId) {
    try {
      const response = await fetch(`/notifications/${notificationId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        this.notifications = this.notifications.filter(n => n.id !== notificationId);
        this.updateUI();
        this.showToast({
          type: 'success',
          title: 'Deleted',
          message: 'Notification deleted successfully',
          duration: 2000
        });
      }
    } catch (error) {
      console.error('Error deleting notification:', error);
      this.showToast({
        type: 'error',
        title: 'Error',
        message: 'Failed to delete notification',
        duration: 3000
      });
    }
  }

  async markAllAsRead() {
    try {
      const response = await fetch('/notifications/mark-all-read', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' }
      });

      if (response.ok) {
        this.notifications.forEach(n => {
          n.is_read = true;
          n.read_at = new Date().toISOString();
        });
        this.updateUI();
        this.playNotificationSound('read');

        this.showToast({
          type: 'success',
          title: 'All notifications marked as read',
          message: 'You\'re all caught up!',
          duration: 2000
        });
      }
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      this.showToast({
        type: 'error',
        title: 'Error',
        message: 'Failed to mark all notifications as read',
        duration: 3000
      });
    }
  }

  setupAudio() {
    if (!this.options.enableSounds) return;

    try {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();

      // Generate simple notification sounds
      this.sounds = {
        new: this.generateTone(800, 0.1),
        read: this.generateTone(400, 0.1),
        error: this.generateTone(300, 0.2)
      };
    } catch (error) {
      console.warn('Audio context not supported:', error);
      this.options.enableSounds = false;
    }
  }

  generateTone(frequency, duration) {
    if (!this.audioContext) return null;

    return () => {
      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext.destination);

      oscillator.frequency.value = frequency;
      oscillator.type = 'sine';

      gainNode.gain.setValueAtTime(0.3, this.audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + duration);

      oscillator.start(this.audioContext.currentTime);
      oscillator.stop(this.audioContext.currentTime + duration);
    };
  }

  playNotificationSound(type) {
    if (!this.options.enableSounds || !this.sounds[type]) return;

    try {
      this.sounds[type]();
    } catch (error) {
      console.warn('Failed to play notification sound:', error);
    }
  }

  toggleSounds() {
    this.options.enableSounds = !this.options.enableSounds;
    const soundToggle = document.getElementById('sound-toggle');

    if (soundToggle) {
      const icon = soundToggle.querySelector('i');
      if (this.options.enableSounds) {
        icon.className = 'fas fa-volume-up text-sm';
        soundToggle.title = 'Disable notification sounds';
      } else {
        icon.className = 'fas fa-volume-mute text-sm';
        soundToggle.title = 'Enable notification sounds';
      }
    }

    // Save preference
    localStorage.setItem('notificationSoundsEnabled', this.options.enableSounds);
  }

  startPolling() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
    }

    this.pollingInterval = setInterval(() => {
      this.loadNotifications();
    }, this.options.pollingInterval);
  }

  async requestBrowserPermissions() {
    if (!this.options.enableBrowserNotifications || !('Notification' in window)) return;

    if (Notification.permission === 'default') {
      const permission = await Notification.requestPermission();
      this.options.enableBrowserNotifications = permission === 'granted';
    } else {
      this.options.enableBrowserNotifications = Notification.permission === 'granted';
    }
  }

  showBrowserNotification(title, options = {}) {
    if (!this.options.enableBrowserNotifications || Notification.permission !== 'granted') return;

    const notification = new Notification(title, {
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      ...options
    });

    notification.onclick = () => {
      window.focus();
      notification.close();
      if (options.onClick) options.onClick();
    };

    // Auto close after 5 seconds
    setTimeout(() => notification.close(), 5000);
  }

  updateTabTitle(unreadCount) {
    const title = document.title;
    const baseTitle = title.replace(/^\(\d+\)\s*/, '');

    if (unreadCount > 0) {
      document.title = `(${unreadCount}) ${baseTitle}`;
    } else {
      document.title = baseTitle;
    }
  }

  timeAgo(date) {
    const now = new Date();
    const diffInSeconds = Math.floor((now - date) / 1000);

    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
    return date.toLocaleDateString();
  }

  truncateMessage(message, maxLength) {
    if (!message || message.length <= maxLength) return message;
    return message.substring(0, maxLength).trim() + '...';
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  destroy() {
    // Clear intervals
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
    }

    // Remove event listeners
    this.eventListeners.forEach(({ element, event, handler }) => {
      element.removeEventListener(event, handler);
    });

    // Clear toasts
    this.toasts.forEach((_, toastId) => {
      this.removeToast(toastId);
    });

    // Reset state
    this.isInitialized = false;
    this.notifications = [];
    this.toasts.clear();
    this.toastQueue = [];

    console.log('🧹 Notification system destroyed');
  }
}

// CSS for animations - add to page if not present
if (!document.getElementById('notification-styles')) {
  const style = document.createElement('style');
  style.id = 'notification-styles';
  style.textContent = `
    @keyframes shrink {
      from { width: 100%; }
      to { width: 0%; }
    }

    .line-clamp-2 {
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    .line-clamp-3 {
      display: -webkit-box;
      -webkit-line-clamp: 3;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    .notification-item {
      position: relative;
    }

    .notification-item::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: linear-gradient(90deg, transparent 0%, rgba(59, 130, 246, 0.05) 50%, transparent 100%);
      transform: translateX(-100%);
      transition: transform 0.6s ease;
    }

    .notification-item:hover::before {
      transform: translateX(100%);
    }

    @media (prefers-reduced-motion: reduce) {
      .notification-item::before,
      .toast-notification {
        animation: none !important;
        transition: none !important;
      }
    }
  `;
  document.head.appendChild(style);
}

// Export for use
window.AdvancedNotificationSystem = AdvancedNotificationSystem;

// Floating Notification Bubble Manager
class FloatingNotificationBubble {
  constructor() {
    this.isVisible = false;
    this.scrollThreshold = 300; // Show after scrolling 300px
    this.init();
  }

  init() {
    this.bubble = document.getElementById('floatingNotificationBubble');
    this.toggle = document.getElementById('floatingNotificationToggle');
    this.menu = document.getElementById('floatingNotificationMenu');
    this.count = document.getElementById('floatingNotificationCount');
    this.list = document.getElementById('floatingNotificationList');

    if (!this.bubble) return;

    // Set up scroll detection
    this.setupScrollDetection();

    // Set up click handlers
    this.setupEventListeners();

    // Sync with main notification system
    this.syncWithMainSystem();
  }

  setupScrollDetection() {
    let lastScrollY = window.scrollY;
    let ticking = false;

    const updateBubbleVisibility = () => {
      const shouldShow = window.scrollY > this.scrollThreshold;

      if (shouldShow !== this.isVisible) {
        this.isVisible = shouldShow;
        this.bubble.style.display = shouldShow ? 'block' : 'none';

        if (shouldShow) {
          this.bubble.style.animation = 'floatIn 0.3s ease-out forwards';
        }
      }

      ticking = false;
    };

    const onScroll = () => {
      if (!ticking) {
        requestAnimationFrame(updateBubbleVisibility);
        ticking = true;
      }
    };

    window.addEventListener('scroll', onScroll);
  }

  setupEventListeners() {
    if (!this.toggle) return;

    // Toggle dropdown - redirect to main notification system
    this.toggle.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();

      // Instead of opening floating dropdown, scroll to top and open main dropdown
      window.scrollTo({
        top: 0,
        behavior: 'smooth'
      });

      // Wait for scroll to complete, then open main notification menu
      setTimeout(() => {
        if (window.notificationSystem && window.notificationSystem.elements.toggle) {
          window.notificationSystem.elements.toggle.click();
        }
      }, 500);
    });

    // Close on outside click
    document.addEventListener('click', (e) => {
      if (!this.bubble.contains(e.target)) {
        this.closeDropdown();
      }
    });

    // Sync actions with main system
    const markAllReadBtn = this.bubble.querySelector('#floating-markAllRead');
    const soundToggleBtn = this.bubble.querySelector('#floating-sound-toggle');

    if (markAllReadBtn) {
      markAllReadBtn.addEventListener('click', () => {
        if (window.notificationSystem) {
          window.notificationSystem.markAllAsRead();
        }
      });
    }

    if (soundToggleBtn) {
      soundToggleBtn.addEventListener('click', () => {
        if (window.notificationSystem) {
          window.notificationSystem.toggleSound();
          this.updateSoundToggle();
        }
      });
    }
  }

  toggleDropdown() {
    const isOpen = !this.menu.classList.contains('hidden');

    if (isOpen) {
      this.closeDropdown();
    } else {
      this.openDropdown();
    }
  }

  openDropdown() {
    if (!this.menu) return;

    this.menu.classList.remove('hidden');
    this.menu.classList.add('animate-in');
    this.menu.classList.remove('animate-out');

    // Load notifications
    this.loadNotifications();
  }

  closeDropdown() {
    if (!this.menu) return;

    this.menu.classList.add('animate-out');
    this.menu.classList.remove('animate-in');

    setTimeout(() => {
      this.menu.classList.add('hidden');
    }, 200);
  }

  syncWithMainSystem() {
    // Listen for notification updates from main system
    if (window.notificationSystem) {
      const originalUpdateUI = window.notificationSystem.updateUI.bind(window.notificationSystem);

      window.notificationSystem.updateUI = () => {
        originalUpdateUI();
        this.updateCount();
        this.updateSoundToggle();
      };
    }

    // Update every 30 seconds
    setInterval(() => {
      this.updateCount();
    }, 30000);
  }

  async updateCount() {
    try {
      const response = await fetch('/api/notifications/count');
      const result = await response.json();

      if (result.success && this.count) {
        const unreadCount = result.count || 0;
        this.count.textContent = unreadCount;

        if (unreadCount > 0) {
          this.count.classList.add('show');
          this.count.parentElement.querySelector('.floating-notification-pulse').classList.add('show');
        } else {
          this.count.classList.remove('show');
          this.count.parentElement.querySelector('.floating-notification-pulse').classList.remove('show');
        }
      }
    } catch (error) {
      console.error('Error updating floating notification count:', error);
    }
  }

  async loadNotifications() {
    if (!this.list) return;

    try {
      const response = await fetch('/api/notifications?limit=10');
      const result = await response.json();

      if (result.success) {
        const notifications = result.data || [];
        this.renderNotifications(notifications);
      }
    } catch (error) {
      console.error('Error loading notifications for floating bubble:', error);
      this.list.innerHTML = '<div class="p-4 text-center text-red-500">Failed to load notifications</div>';
    }
  }

  renderNotifications(notifications) {
    if (!this.list) return;

    if (notifications.length === 0) {
      this.list.innerHTML = `
        <div class="flex flex-col items-center justify-center py-8 px-4 text-center">
          <i class="fas fa-bell-slash text-3xl text-gray-400 mb-3"></i>
          <p class="text-gray-500 dark:text-gray-400">No notifications</p>
        </div>
      `;
      return;
    }

    this.list.innerHTML = notifications.map(notification => `
      <div class="notification-item border-b border-gray-100 dark:border-gray-700 last:border-b-0 p-4 hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors ${!notification.is_read ? 'bg-blue-50 dark:bg-blue-900/20' : ''}">
        <div class="flex items-start gap-3">
          <div class="notification-icon ${notification.type || 'info'} flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center">
            <i class="fas ${this.getNotificationIcon(notification.type)} text-sm"></i>
          </div>
          <div class="flex-1 min-w-0">
            <h4 class="font-medium text-gray-900 dark:text-gray-100 text-sm mb-1">${notification.title}</h4>
            <p class="text-gray-600 dark:text-gray-400 text-xs mb-2 line-clamp-2">${notification.message}</p>
            <div class="flex items-center justify-between">
              <span class="text-xs text-gray-500 dark:text-gray-500">${this.formatDate(notification.created_at)}</span>
              <div class="flex items-center gap-1">
                ${!notification.is_read ? `
                  <button onclick="markNotificationRead(${notification.id})" class="p-1 text-gray-400 hover:text-blue-500 transition-colors" title="Mark as read">
                    <i class="fas fa-check text-xs"></i>
                  </button>
                ` : ''}
                <button onclick="deleteNotification(${notification.id})" class="p-1 text-gray-400 hover:text-red-500 transition-colors" title="Delete">
                  <i class="fas fa-trash text-xs"></i>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `).join('');
  }

  getNotificationIcon(type) {
    const icons = {
      'info': 'fa-info-circle',
      'success': 'fa-check-circle',
      'warning': 'fa-exclamation-triangle',
      'error': 'fa-times-circle'
    };
    return icons[type] || 'fa-bell';
  }

  formatDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMinutes = Math.floor((now - date) / (1000 * 60));

    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;

    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}h ago`;

    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) return `${diffInDays}d ago`;

    return date.toLocaleDateString();
  }

  updateSoundToggle() {
    const soundToggle = this.bubble?.querySelector('#floating-sound-toggle i');
    if (soundToggle && window.notificationSystem) {
      const soundsEnabled = window.notificationSystem.soundsEnabled;
      soundToggle.className = soundsEnabled ? 'fas fa-volume-up text-sm' : 'fas fa-volume-mute text-sm';
    }
  }
}

// Global functions for notification actions
window.markNotificationRead = async function(id) {
  if (window.notificationSystem) {
    await window.notificationSystem.markAsRead(id);
    // Reload the floating bubble notifications
    if (window.floatingBubble) {
      window.floatingBubble.loadNotifications();
    }
  }
};

window.deleteNotification = async function(id) {
  if (window.notificationSystem) {
    await window.notificationSystem.deleteNotification(id);
    // Reload the floating bubble notifications
    if (window.floatingBubble) {
      window.floatingBubble.loadNotifications();
    }
  }
};

// Auto-initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
  // Load sound preference
  const soundsEnabled = localStorage.getItem('notificationSoundsEnabled') !== 'false';

  window.notificationSystem = new AdvancedNotificationSystem({
    enableSounds: soundsEnabled,
    enableBrowserNotifications: true,
    maxToasts: 4,
    defaultDuration: 5000,
    pollingInterval: 30000
  });

  // Also expose as advancedNotificationSystem for compatibility
  window.advancedNotificationSystem = window.notificationSystem;

  // Initialize floating bubble
  window.floatingBubble = new FloatingNotificationBubble();
});

// Cleanup on page unload
window.addEventListener('beforeunload', function() {
  if (window.notificationSystem) {
    window.notificationSystem.destroy();
  }
});

// Expose global toast function for easy use
window.showToast = function(options) {
  if (window.notificationSystem) {
    return window.notificationSystem.showToast(options);
  }
};
