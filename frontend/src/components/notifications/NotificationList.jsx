import { FiCheck, FiMoreHorizontal } from 'react-icons/fi';

function NotificationList({
  notifications = [],
  unreadCount = 0,
  activeFilter = 'all',
  isLoading = false,
  isLoadingMore = false,
  showActionsMenu = false,
  hasMore = false,
  onFilterChange,
  onItemClick,
  onLoadMore,
  onToggleActionsMenu,
  onMarkAllRead,
  formatTimestamp,
}) {
  const visibleNotifications =
    activeFilter === 'unread'
      ? notifications.filter((item) => !item?.isRead)
      : notifications;

  return (
    <div className="notification-bell__dropdown" role="dialog" aria-label="Notifications">
      <div className="notification-bell__panel-header">
        <div>
          <h2>Notifications</h2>
          <p>{unreadCount > 0 ? `${unreadCount} unread` : 'All read'}</p>
        </div>

        <div className="notification-bell__actions">
            <button
              type="button"
              className="notification-bell__icon-btn"
              aria-label="Notification options"
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
                <span>Mark all as read</span>
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
          All
        </button>
        <button
          type="button"
          className={`notification-bell__filter ${activeFilter === 'unread' ? 'is-active' : ''}`}
          onClick={() => onFilterChange?.('unread')}
        >
          Unread
        </button>
      </div>

      <div className="notification-bell__content">
        <div className="notification-bell__section-head">
          <strong>New</strong>
        </div>

        {isLoading ? (
          <p className="notification-bell__empty">Loading notifications...</p>
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
                    <strong>{item?.title || 'Notification'}</strong>
                    {!item?.isRead ? <span className="notification-bell__item-dot" aria-hidden="true" /> : null}
                  </div>
                  <p>{item?.content || 'You have a new update.'}</p>
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
                      {isLoadingMore ? 'Loading more...' : 'Load earlier notifications'}
                </button>
              </div>
            ) : null}
          </div>
        ) : (
          <p className="notification-bell__empty">
            {activeFilter === 'unread' ? 'No unread notifications.' : 'No notifications yet.'}
          </p>
        )}
      </div>
    </div>
  );
}

export default NotificationList;
