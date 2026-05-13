import { useEffect, useMemo, useState } from 'react';
import useAdminI18n from '../../hooks/useAdminI18n';
import {
  fetchAdminUsers,
  updateAdminUser,
  deleteAdminUser,
  createAdminUser,
} from '../../services/api/adminUsersApi';
import './AdminUserManagementPage.css';

const ROLE_OPTIONS = [
  { value: 'all', label: 'All roles' },
  { value: 'admin', label: 'Admin' },
  { value: 'user', label: 'User' }
];

function normalizeGenderValue(value) {
  const normalized = String(value || '').trim().toLowerCase();

  if (['male', 'nam'].includes(normalized)) return 'male';
  if (['female', 'nữ', 'nu'].includes(normalized)) return 'female';
  if (['other', 'khác', 'khac'].includes(normalized)) return 'other';

  return '';
}

function AdminUserManagementPage() {
  const { language, tx, formatDate, formatDateTime, formatNumber } = useAdminI18n();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [selectedUserIds, setSelectedUserIds] = useState([]);
  const [roleFilter, setRoleFilter] = useState('all');
  const [submitStatus, setSubmitStatus] = useState('');
  const [addFormError, setAddFormError] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingUserId, setEditingUserId] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [newUserData, setNewUserData] = useState({
    fullname: '',
    email: '',
    username: '',
    password: '',
    phone: '',
    address: '',
    role: 'user',
    gender: '',
  });
  const [expandedRow, setExpandedRow] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  const roleOptions = useMemo(
    () => ROLE_OPTIONS.map((item) => ({ ...item, label: tx(item.label) })),
    [tx]
  );

  const formatRoleLabel = (role) => tx(role === 'admin' ? 'Admin' : 'User');
  const formatStatusLabel = (status) => {
    const normalizedStatus = String(status || 'active').toLowerCase();

    if (normalizedStatus === 'blocked') {
      return language === 'vi' ? 'Đã khóa' : 'BLOCKED';
    }

    if (normalizedStatus === 'paused') {
      return language === 'vi' ? 'Tạm dừng' : 'PAUSED';
    }

    return language === 'vi' ? 'Hoạt động' : 'ACTIVE';
  };


  const loadUsers = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetchAdminUsers({ search: search.trim(), role: roleFilter === 'all' ? undefined : roleFilter });
      const fetchedUsers = Array.isArray(response?.users) ? response.users : Array.isArray(response?.data) ? response.data : [];
      setUsers(fetchedUsers);
    } catch (err) {
      console.error('Failed to load users', err);
      setError(err?.response?.data?.message || err.message || tx('Unable to load users'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setCurrentPage(1);
    loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roleFilter]);

  const handleSearch = (event) => {
    setSearch(event.target.value);
  };

  const applySearch = (event) => {
    event.preventDefault();
    setCurrentPage(1);
    loadUsers();
  };

  const isAllSelected = () => {
    return (
      currentPageUsers.length > 0 &&
      currentPageUsers.every((user) => selectedUserIds.includes(String(user.id)))
    );
  };

  const toggleSelectAll = (checked) => {
    if (checked) {
      setSelectedUserIds(currentPageUsers.map((user) => String(user.id)));
    } else {
      setSelectedUserIds([]);
    }
  };

  const toggleSelectOne = (userId, checked) => {
    if (checked) {
      setSelectedUserIds((prev) => [...new Set([...prev, String(userId)])]);
    } else {
      setSelectedUserIds((prev) => prev.filter((id) => id !== String(userId)));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedUserIds.length === 0) {
      setSubmitStatus(tx('No accounts selected for deletion.'));
      return;
    }

    if (!window.confirm(language === 'vi'
      ? `Xóa ${formatNumber(selectedUserIds.length)} tài khoản đã chọn?`
      : `Delete ${selectedUserIds.length} selected account(s)?`)) {
      return;
    }

    setLoading(true);
    try {
      for (let id of selectedUserIds) {
        await deleteAdminUser(id);
      }
      setUsers((prev) => prev.filter((user) => !selectedUserIds.includes(String(user.id))));
      setSubmitStatus(language === 'vi'
        ? `Đã xóa ${formatNumber(selectedUserIds.length)} tài khoản.`
        : `${selectedUserIds.length} account(s) deleted.`);
      setSelectedUserIds([]);
    } catch (err) {
      console.error('Failed bulk delete', err);
      setSubmitStatus(err?.response?.data?.message || tx('Bulk delete failed.'));
    } finally {
      setLoading(false);
    }
  };

  const openAddUserModal = () => {
    setIsEditMode(false);
    setEditingUserId(null);
    setShowPassword(false);
    setNewUserData({
      fullname: '',
      email: '',
      username: '',
      password: '',
      phone: '',
      address: '',
      role: 'user',
      gender: '',
    });
    setIsAddModalOpen(true);
    setSubmitStatus('');
    setAddFormError('');
  };

  const openEditUserModal = (user) => {
    setIsEditMode(true);
    setEditingUserId(user.id);
    const validGender = normalizeGenderValue(user.gender);

    setNewUserData({
      fullname: user.fullname || '',
      email: user.email || '',
      username: user.username || '',
      password: '',
      phone: user.phone || '',
      address: user.address || '',
      role: user.role || 'user',
      gender: validGender,
    });
    setShowPassword(false);
    setIsAddModalOpen(true);
    setSubmitStatus('');
    setAddFormError('');
  };

  const closeAddUserModal = () => {
    setIsAddModalOpen(false);
  };

  const handleAddUserSubmit = async (event) => {
    event.preventDefault();

    const { fullname, email, username, password, phone, address, role, gender } = newUserData;

    if (!fullname.trim() || !email.trim() || !username.trim() || (!password && !isEditMode)) {
      setSubmitStatus('');
      setAddFormError(tx('Enter full name, email, username, and password.'));
      return;
    }

    const emailRegex = /^[\w.-]+@([\w-]+\.)+[\w-]{2,4}$/;
    if (!emailRegex.test(email)) {
      setSubmitStatus('');
      setAddFormError(tx('Invalid email address.'));
      return;
    }

    const phoneRegex = /^\d{9,15}$/;
    if (newUserData.phone && !phoneRegex.test(newUserData.phone)) {
      setSubmitStatus('');
      setAddFormError(tx('Phone number must contain 9 to 15 digits.'));
      return;
    }

    if (!newUserData.address.trim() || newUserData.address.trim().length < 5) {
      setSubmitStatus('');
      setAddFormError(tx('Address must be at least 5 characters long.'));
      return;
    }

    // Validate username format
    const usernameRegex = /^[a-zA-Z0-9._-]{3,30}$/;
    if (!usernameRegex.test(username)) {
      setSubmitStatus('');
      setAddFormError(tx('Username must be 3-30 characters and only include letters, numbers, ., _, or -.'));
      return;
    }

    // Check duplicate email, username, phone, address
    const currentEditingId = editingUserId ? String(editingUserId) : null;

    const sameEmail = users.some((user) =>
      String(user.id) !== currentEditingId &&
      String(user.email || '').toLowerCase() === email.toLowerCase()
    );

    const sameUsername = users.some((user) =>
      String(user.id) !== currentEditingId &&
      String(user.username || '').toLowerCase() === username.toLowerCase()
    );

    const samePhone = newUserData.phone
      ? users.some((user) => String(user.id) !== currentEditingId && String(user.phone || '') === newUserData.phone)
      : false;

    const sameAddress = users.some((user) =>
      String(user.id) !== currentEditingId &&
      String(user.address || '').toLowerCase() === newUserData.address.toLowerCase()
    );

    if (sameEmail) {
      setSubmitStatus('');
      setAddFormError(tx('This email already exists.'));
      return;
    }

    if (sameUsername) {
      setSubmitStatus('');
      setAddFormError(tx('This username already exists.'));
      return;
    }

    if (samePhone) {
      setSubmitStatus('');
      setAddFormError(tx('This phone number already exists.'));
      return;
    }

    if (sameAddress) {
      setSubmitStatus('');
      setAddFormError(tx('This address already exists.'));
      return;
    }

    const passwordErrors = [];
    if (!isEditMode || password) {
      if (password.length < 8) passwordErrors.push('at least 8 characters');
      if (!/[A-Z]/.test(password)) passwordErrors.push('1 uppercase letter');
      if (!/[a-z]/.test(password)) passwordErrors.push('1 lowercase letter');
      if (!/[0-9]/.test(password)) passwordErrors.push('1 number');
      if (!/[!@#$%^&*]/.test(password)) passwordErrors.push('1 special character (!@#$%^&*)');

      if (passwordErrors.length > 0) {
        setSubmitStatus('');
        setAddFormError(
          language === 'vi'
            ? `Mật khẩu phải có ${passwordErrors.join(', ')}.`
            : `Password must include ${passwordErrors.join(', ')}.`
        );
        return;
      }
    }

    setAddFormError('');
    setLoading(true);
    setSubmitStatus(isEditMode ? tx('Updating account...') : tx('Creating new account...'));

    try {
      let response;
      let resultUser;

      if (isEditMode && editingUserId) {
        response = await updateAdminUser(editingUserId, {
          fullname,
          email,
          username,
          password: password || undefined,
          phone,
          address,
          role,
          gender,
        });

        resultUser = response.user || response;
        setUsers((prev) => prev.map((u) => (String(u.id) === String(editingUserId) ? { ...u, ...resultUser } : u)));
        setSubmitStatus(tx('User updated successfully.'));
      } else {
        response = await createAdminUser(newUserData);
        resultUser = response.user || response;
        if (resultUser) {
          setUsers((prev) => [resultUser, ...prev]);
        } else {
          const fakeNewUser = {
            id: Date.now(),
            fullname,
            email,
            username,
            role,
            status: 'active',
            phone,
            address,
            pause_until: null,
            created_at: new Date().toISOString(),
          };
          setUsers((prev) => [fakeNewUser, ...prev]);
        }

        setSubmitStatus(tx('New user created successfully.'));
      }

      setAddFormError('');
      closeAddUserModal();
      setSelectedUserIds([]);
    } catch (err) {
      console.error('Failed to create user', err);
      const errMsg = err?.response?.data?.message || tx('Failed to create user.');
      setSubmitStatus('');
      setAddFormError(errMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (userId) => {
    const confirmDelete = window.confirm(tx('Are you sure you want to delete this user?'));
    if (!confirmDelete) {
      return;
    }

    setSubmitStatus('');

    try {
      await deleteAdminUser(userId);
      setUsers((prev) => prev.filter((u) => String(u.id) !== String(userId)));
      setSubmitStatus(tx('User deleted.'));
    } catch (err) {
      console.error('Failed to delete user', err);
      setSubmitStatus(err?.response?.data?.message || tx('Failed to delete user.'));
    }
  };

  const filteredUsers = useMemo(() => {
    if (!search) return users;

    return users.filter((user) => {
      const q = search.toLowerCase();
      return (
        String(user.fullname || user.username || user.email).toLowerCase().includes(q) ||
        String(user.email || '').toLowerCase().includes(q) ||
        String(user.username || '').toLowerCase().includes(q)
      );
    });
  }, [search, users]);

  const sortedUsers = useMemo(() => {
    const copy = [...filteredUsers];
    copy.sort((a, b) => {
      if (a.role === 'admin' && b.role !== 'admin') return -1;
      if (a.role !== 'admin' && b.role === 'admin') return 1;

      const dateA = a.created_at ? new Date(a.created_at) : new Date(0);
      const dateB = b.created_at ? new Date(b.created_at) : new Date(0);
      return dateB - dateA;
    });
    return copy;
  }, [filteredUsers]);

  const totalPages = Math.max(1, Math.ceil(sortedUsers.length / pageSize));
  const currentPageUsers = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedUsers.slice(start, start + pageSize);
  }, [currentPage, sortedUsers]);

  useEffect(() => {
    const handleDocumentClick = (event) => {
      if (!event.target.closest('.admin-action-dropdown')) {
        setExpandedRow(null);
      }
    };

    document.addEventListener('mousedown', handleDocumentClick);
    return () => {
      document.removeEventListener('mousedown', handleDocumentClick);
    };
  }, []);

  const handleAction = async (userId, action) => {
    setExpandedRow(null);
    const target = users.find((u) => String(u.id) === String(userId));
    if (!target) return;

    if (action === 'edit') {
      openEditUserModal(target);
      return;
    }

    if (action === 'delete') {
      return handleDelete(userId);
    }

    if (action === 'block') {
      const reason = window.prompt(tx('Reason for permanent block:'), tx('Policy violation'));
      try {
        const resp = await updateAdminUser(userId, {
          status: 'blocked',
          blocked_reason: reason || tx('Terms violation')
        });
        setUsers((prev) => prev.map((u) => (String(u.id) === String(userId) ? { ...u, ...resp.user } : u)));
        setSubmitStatus(tx('Account permanently blocked.'));
      } catch (err) {
        setSubmitStatus(err?.response?.data?.message || tx('Failed to block account.'));
      }
      return;
    }

    if (action === 'unblock') {
      try {
        const resp = await updateAdminUser(userId, {
          status: 'active',
          pause_until: null,
          blocked_reason: null
        });
        setUsers((prev) => prev.map((u) => (String(u.id) === String(userId) ? { ...u, ...resp.user } : u)));
        setSubmitStatus(tx('Account unblocked.'));
      } catch (err) {
        setSubmitStatus(err?.response?.data?.message || tx('Failed to unblock account.'));
      }
      return;
    }

    if (action === 'pause') {
      const isPaused = target.status === 'paused';
      const nextStatus = isPaused ? 'active' : 'paused';
      const now = new Date();
      const pauseUntil = isPaused ? null : new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString();

      try {
        const resp = await updateAdminUser(userId, {
          status: nextStatus,
          pause_until: pauseUntil,
          blocked_reason: null
        });
        setUsers((prev) => prev.map((u) => (String(u.id) === String(userId) ? { ...u, ...resp.user } : u)));
        setSubmitStatus(
          isPaused
            ? tx('Account reactivated from paused status.')
            : language === 'vi'
              ? `Tài khoản tạm dừng đến ${formatDateTime(pauseUntil)}`
              : `Account paused until ${formatDateTime(pauseUntil)}`
        );
      } catch (err) {
        setSubmitStatus(err?.response?.data?.message || tx('Failed to update account status.'));
      }
      return;
    }
  };

  return (
    <div className="admin-user-management-page">
      <header className="admin-user-management-header">
        <div>
          <h1>{tx('User Management')}</h1>
          <p>{tx('Manage user accounts, roles, and account removal.')}</p>
        </div>
        <form className="admin-user-management-toolbar" onSubmit={applySearch}>
          <input
            type="search"
            placeholder={tx('Search by name, email, or username')}
            value={search}
            onChange={handleSearch}
            className="admin-user-search"
          />
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="admin-user-role-filter"
          >
            {roleOptions.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
          <button type="submit" className="admin-user-search-btn" disabled={loading}>
            {tx('Search')}
          </button>
          <button
            type="button"
            className="admin-user-add-btn"
            onClick={openAddUserModal}
            disabled={loading}
          >
            {tx('Add user')}
          </button>
          <button
            type="button"
            className="admin-user-refresh-btn"
            onClick={loadUsers}
            disabled={loading}
          >
            {tx('Refresh')}
          </button>
        </form>
        {selectedUserIds.length > 0 && (
          <div className="admin-user-bulk-bar">
            <span>{formatNumber(selectedUserIds.length)} {tx('selected user(s)')}</span>
            <button type="button" className="admin-user-delete-btn" onClick={handleBulkDelete} disabled={loading}>
              {tx('Delete selected')}
            </button>
          </div>
        )}
      </header>

      {submitStatus && <div className="admin-user-notice">{submitStatus}</div>}
      {error && <div className="admin-user-error">{error}</div>}

      {isAddModalOpen && (
        <div className="modal-overlay">
          <div className="add-user-modal">
            <h2>{isEditMode ? tx('Edit User') : tx('Add User')}</h2>
            <form onSubmit={handleAddUserSubmit}>
              <div className="modal-grid">
                <label>
                  {tx('Full Name')}
                  <input
                    value={newUserData.fullname}
                    onChange={(e) => setNewUserData((prev) => ({ ...prev, fullname: e.target.value }))}
                    required
                  />
                </label>
                <label>
                  {tx('Email')}
                  <input
                    type="email"
                    value={newUserData.email}
                    onChange={(e) => setNewUserData((prev) => ({ ...prev, email: e.target.value }))}
                    required
                  />
                </label>
                <label>
                  {tx('Username')}
                  <input
                    value={newUserData.username}
                    onChange={(e) => setNewUserData((prev) => ({ ...prev, username: e.target.value }))}
                    required
                  />
                </label>
                <label>
                  {tx('Password')}
                  <div className="password-input-wrap">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={newUserData.password}
                      onChange={(e) => setNewUserData((prev) => ({ ...prev, password: e.target.value }))}
                      required={!isEditMode}
                      placeholder={isEditMode ? tx('Leave blank to keep the current password') : ''}
                    />
                    <button
                      type="button"
                      className="password-toggle-btn"
                      onClick={() => setShowPassword((prev) => !prev)}
                    >
                      {showPassword ? tx('Hide') : tx('Show')}
                    </button>
                  </div>
                </label>
                <label>
                  {tx('Phone')}
                  <input
                    value={newUserData.phone}
                    onChange={(e) => setNewUserData((prev) => ({ ...prev, phone: e.target.value }))}
                  />
                </label>
                <label>
                  {tx('Address')}
                  <input
                    value={newUserData.address}
                    onChange={(e) => setNewUserData((prev) => ({ ...prev, address: e.target.value }))}
                  />
                </label>
                <label>
                  {tx('Role')}
                  <select
                    value={newUserData.role}
                    onChange={(e) => setNewUserData((prev) => ({ ...prev, role: e.target.value }))}
                  >
                    <option value="user">{tx('User')}</option>
                    <option value="admin">{tx('Admin')}</option>
                  </select>
                </label>
                <label>
                  {tx('Gender')}
                  <select
                    value={newUserData.gender}
                    onChange={(e) => setNewUserData((prev) => ({ ...prev, gender: e.target.value }))}
                  >
                    <option value="">{tx('Not selected')}</option>
                    <option value="male">{tx('Male')}</option>
                    <option value="female">{tx('Female')}</option>
                    <option value="other">{tx('Other')}</option>
                  </select>
                </label>
              </div>

              {addFormError && <div className="add-user-error">{addFormError}</div>}
              <div className="modal-actions">
                <button type="submit" className="admin-user-add-btn" disabled={loading}>
                  {tx('Save')}
                </button>
                <button type="button" className="admin-user-refresh-btn" onClick={closeAddUserModal}>
                  {tx('Cancel')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="admin-user-table-wrapper">
        <table className="admin-user-table">
          <thead>
            <tr>
              <th>
                <input
                  type="checkbox"
                  checked={isAllSelected()}
                  onChange={(e) => toggleSelectAll(e.target.checked)}
                  aria-label={tx('Select all')}
                />
              </th>
              <th>{tx('Full name')}</th>
              <th>{tx('Email')}</th>
              <th>{tx('Username')}</th>
              <th>{tx('Role')}</th>
              <th>{tx('Status')}</th>
              <th>{tx('Pause until')}</th>
              <th>{tx('Joined at')}</th>
              <th>{tx('Actions')}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="9" className="admin-user-loading">
                  {tx('Loading data...')}
                </td>
              </tr>
            ) : filteredUsers.length === 0 ? (
              <tr>
                <td colSpan="9" className="admin-user-empty">
                  {tx('No users found.')}
                </td>
              </tr>
            ) : (
              currentPageUsers.map((user) => (
                <tr key={user.id}>
                  <td>
                    <input
                      type="checkbox"
                      checked={selectedUserIds.includes(String(user.id))}
                      onChange={(e) => toggleSelectOne(user.id, e.target.checked)}
                      aria-label={`${tx('Select')} ${user.fullname || user.username || user.email}`}
                    />
                  </td>
                  <td>{user.fullname || tx('N/A')}</td>
                  <td>{user.email || tx('N/A')}</td>
                  <td>{user.username || tx('N/A')}</td>
                  <td>{formatRoleLabel(user.role)}</td>
                  <td>
                    <span
                      className={`status-badge status-${(user.status || 'active').toLowerCase()}`}
                    >
                      {formatStatusLabel(user.status)}
                    </span>
                  </td>
                  <td>{user.pause_until ? formatDate(user.pause_until) : tx('N/A')}</td>
                  <td>{formatDate(user.created_at)}</td>
                  <td className="admin-user-action-cell">
                    <div className="admin-action-dropdown">
                      <button
                        type="button"
                        className="admin-action-toggle"
                        onClick={() => setExpandedRow((prev) => (prev === user.id ? null : user.id))}
                      >
                        ⋮
                      </button>

                      {expandedRow === user.id ? (
                        <ul className="admin-action-menu">
                          <li onClick={() => handleAction(user.id, 'edit')}>{tx('Edit')}</li>
                          <li onClick={() => handleAction(user.id, 'delete')}>
                            {tx('Delete')}
                          </li>
                          {user.status === 'blocked' ? (
                            <li onClick={() => handleAction(user.id, 'unblock')}>{tx('Unblock')}</li>
                          ) : (
                            <li onClick={() => handleAction(user.id, 'block')}>{tx('Block permanently')}</li>
                          )}
                          <li onClick={() => handleAction(user.id, 'pause')}>
                            {user.status === 'paused' ? tx('Resume') : tx('Pause')}
                          </li>
                        </ul>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="admin-user-pagination">
        <div>
          <strong>{tx('Page')} {currentPage}/{totalPages}</strong> ({tx('Total')} {formatNumber(sortedUsers.length)} {language === 'vi' ? 'người dùng' : 'users'})
        </div>
        <div className="admin-user-pagination-controls">
          <button
            type="button"
            onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
            disabled={currentPage <= 1}
          >
            « {tx('Prev')}
          </button>
          <button
            type="button"
            onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
            disabled={currentPage >= totalPages}
          >
            {tx('Next')} »
          </button>
        </div>
      </div>
    </div>
  );
}

export default AdminUserManagementPage;

