import { FiCheck, FiMoreHorizontal } from 'react-icons/fi';

function NotificationList({
  notifications = [],
  unreadCount = 0,
  activeFilter = 'all',
  isLoading = false,
  isLoadingMore = false,
  showActionsMenu = false,
  hasMore = false,
  copy,
  onFilterChange,
  onItemClick,
  onLoadMore,
  onToggleActionsMenu,
  onMarkAllRead,
  formatTimestamp,
}) {
  const ui = copy || {};
  const visibleNotifications =
    activeFilter === 'unread'
      ? notifications.filter((item) => !item?.isRead)
      : notifications;

  return (
    <div className="notification-bell__dropdown" role="dialog" aria-label={ui.panelAriaLabel || 'Notifications'}>
      <div className="notification-bell__panel-header">
        <div>
          <h2>{ui.title || 'Notifications'}</h2>
          <p>{unreadCount > 0 ? ui.unreadCount?.(unreadCount) : (ui.allRead || 'All read')}</p>
        </div>

        <div className="notification-bell__actions">
            <button
              type="button"
              className="notification-bell__icon-btn"
              aria-label={ui.optionsAriaLabel || 'Notification options'}
              onClick={onToggleActionsMenu}
            >
            <FiMoreHorizontal />
          </button>

          {showActionsMenu ? (
            <div className="notification-bell__actions-menu">
              <button
                type="button"
                className="notification-bell__actions-item"
                onClick={onMarkAllRead}
                disabled={unreadCount <= 0}
              >
                <FiCheck />
                <span>{ui.markAllAsRead || 'Mark all as read'}</span>
              </button>
            </div>
          ) : null}
        </div>
      </div>

      <div className="notification-bell__filters">
        <button
          type="button"
          className={`notification-bell__filter ${activeFilter === 'all' ? 'is-active' : ''}`}
          onClick={() => onFilterChange?.('all')}
        >
          {ui.allFilter || 'All'}
        </button>
        <button
          type="button"
          className={`notification-bell__filter ${activeFilter === 'unread' ? 'is-active' : ''}`}
          onClick={() => onFilterChange?.('unread')}
        >
          {ui.unreadFilter || 'Unread'}
        </button>
      </div>

      <div className="notification-bell__content">
        <div className="notification-bell__section-head">
          <strong>{ui.sectionTitle || 'New'}</strong>
        </div>

        {isLoading ? (
          <p className="notification-bell__empty">{ui.loading || 'Loading notifications...'}</p>
        ) : visibleNotifications.length ? (
          <div className="notification-bell__list">
            {visibleNotifications.map((item) => (
              <button
                key={`notification-${item.id}`}
                type="button"
                className={`notification-bell__item ${item?.isRead ? '' : 'is-unread'}`}
                onClick={() => onItemClick?.(item)}
              >
                <div className="notification-bell__item-copy">
                  <div className="notification-bell__item-title-row">
                    <strong>{item?.title || ui.fallbackTitle || 'Notification'}</strong>
                    {!item?.isRead ? <span className="notification-bell__item-dot" aria-hidden="true" /> : null}
                  </div>
                  <p>{item?.content || ui.fallbackContent || 'You have a new update.'}</p>
                  <span>{formatTimestamp?.(item?.createdAt)}</span>
                </div>
              </button>
            ))}

                {activeFilter === 'all' && hasMore ? (
              <div className="notification-bell__load-more-wrap">
                <button
                  type="button"
                  className="notification-bell__load-more"
                  onClick={() => onLoadMore?.()}
                  disabled={isLoadingMore}
                >
                      {isLoadingMore ? (ui.loadingMore || 'Loading more...') : (ui.loadMore || 'Load earlier notifications')}
                </button>
              </div>
            ) : null}
          </div>
        ) : (
          <p className="notification-bell__empty">
            {activeFilter === 'unread' ? (ui.emptyUnread || 'No unread notifications.') : (ui.emptyAll || 'No notifications yet.')}
          </p>
        )}
      </div>
    </div>
  );
}

export default NotificationList;
