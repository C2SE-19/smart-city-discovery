import { useEffect, useMemo, useState } from 'react';
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

function formatDate(value) {
  if (!value) return 'N/A';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'N/A';
  return date.toLocaleDateString();
}

function normalizeGenderValue(value) {
  const normalized = String(value || '').trim().toLowerCase();

  if (['male', 'nam'].includes(normalized)) return 'male';
  if (['female', 'nữ', 'nu'].includes(normalized)) return 'female';
  if (['other', 'khác', 'khac'].includes(normalized)) return 'other';

  return '';
}

function AdminUserManagementPage() {
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


  const loadUsers = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetchAdminUsers({ search: search.trim(), role: roleFilter === 'all' ? undefined : roleFilter });
      const fetchedUsers = Array.isArray(response?.users) ? response.users : Array.isArray(response?.data) ? response.data : [];
      setUsers(fetchedUsers);
    } catch (err) {
      console.error('Failed to load users', err);
      setError(err?.response?.data?.message || err.message || 'Unable to load users');
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
      setSubmitStatus('Chưa chọn tài khoản để xóa.');
      return;
    }

    if (!window.confirm(`Xác nhận xóa ${selectedUserIds.length} tài khoản đã chọn?`)) {
      return;
    }

    setLoading(true);
    try {
      for (let id of selectedUserIds) {
        await deleteAdminUser(id);
      }
      setUsers((prev) => prev.filter((user) => !selectedUserIds.includes(String(user.id))));
      setSubmitStatus(`${selectedUserIds.length} tài khoản đã được xóa`);
      setSelectedUserIds([]);
    } catch (err) {
      console.error('Failed bulk delete', err);
      setSubmitStatus(err?.response?.data?.message || 'Xóa hàng loạt thất bại');
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
      setAddFormError('Vui lòng điền đầy đủ tên, email, username và mật khẩu.');
      return;
    }

    const emailRegex = /^[\w.-]+@([\w-]+\.)+[\w-]{2,4}$/;
    if (!emailRegex.test(email)) {
      setSubmitStatus('');
      setAddFormError('Email không hợp lệ.');
      return;
    }

    const phoneRegex = /^\d{9,15}$/;
    if (newUserData.phone && !phoneRegex.test(newUserData.phone)) {
      setSubmitStatus('');
      setAddFormError('Số điện thoại phải là 9-15 chữ số.');
      return;
    }

    if (!newUserData.address.trim() || newUserData.address.trim().length < 5) {
      setSubmitStatus('');
      setAddFormError('Địa chỉ phải có ít nhất 5 ký tự.');
      return;
    }

    // Validate username format
    const usernameRegex = /^[a-zA-Z0-9._-]{3,30}$/;
    if (!usernameRegex.test(username)) {
      setSubmitStatus('');
      setAddFormError('Username phải từ 3-30 ký tự, chỉ gồm chữ, số, ., _, -');
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
      setAddFormError('Email đã tồn tại trên hệ thống.');
      return;
    }

    if (sameUsername) {
      setSubmitStatus('');
      setAddFormError('Username đã tồn tại trên hệ thống.');
      return;
    }

    if (samePhone) {
      setSubmitStatus('');
      setAddFormError('Số điện thoại đã tồn tại trên hệ thống.');
      return;
    }

    if (sameAddress) {
      setSubmitStatus('');
      setAddFormError('Địa chỉ đã tồn tại trên hệ thống.');
      return;
    }

    const passwordErrors = [];
    if (!isEditMode || password) {
      if (password.length < 8) passwordErrors.push('ít nhất 8 ký tự');
      if (!/[A-Z]/.test(password)) passwordErrors.push('1 chữ hoa');
      if (!/[a-z]/.test(password)) passwordErrors.push('1 chữ thường');
      if (!/[0-9]/.test(password)) passwordErrors.push('1 chữ số');
      if (!/[!@#$%^&*]/.test(password)) passwordErrors.push('1 ký tự đặc biệt (!@#$%^&*)');

      if (passwordErrors.length > 0) {
        setSubmitStatus('');
        setAddFormError(`Mật khẩu phải có ${passwordErrors.join(', ')}.`);
        return;
      }
    }

    setAddFormError('');
    setLoading(true);
    setSubmitStatus(isEditMode ? 'Đang cập nhật tài khoản...' : 'Đang tạo tài khoản mới...');

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
        setSubmitStatus('Cập nhật người dùng thành công.');
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

        setSubmitStatus('Đã tạo người dùng mới thành công.');
      }

      setAddFormError('');
      closeAddUserModal();
      setSelectedUserIds([]);
    } catch (err) {
      console.error('Failed to create user', err);
      const errMsg = err?.response?.data?.message || 'Tạo user thất bại';
      setSubmitStatus('');
      setAddFormError(errMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (userId) => {
    const confirmDelete = window.confirm('Bạn có chắc muốn xóa người dùng này?');
    if (!confirmDelete) {
      return;
    }

    setSubmitStatus('');

    try {
      await deleteAdminUser(userId);
      setUsers((prev) => prev.filter((u) => String(u.id) !== String(userId)));
      setSubmitStatus('Người dùng đã được xóa.');
    } catch (err) {
      console.error('Failed to delete user', err);
      setSubmitStatus(err?.response?.data?.message || 'Xóa người dùng thất bại');
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
      const reason = window.prompt('Lý do khóa vĩnh viễn (vi phạm):', 'Vi phạm chính sách');
      try {
        const resp = await updateAdminUser(userId, {
          status: 'blocked',
          blocked_reason: reason || 'Vi phạm điều khoản'
        });
        setUsers((prev) => prev.map((u) => (String(u.id) === String(userId) ? { ...u, ...resp.user } : u)));
        setSubmitStatus('Tài khoản đã bị khóa vĩnh viễn');
      } catch (err) {
        setSubmitStatus(err?.response?.data?.message || 'Khóa tài khoản thất bại');
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
        setSubmitStatus('Bỏ khóa hoàn tất');
      } catch (err) {
        setSubmitStatus(err?.response?.data?.message || 'Bỏ khóa thất bại');
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
            ? 'Tài khoản đã được mở lại từ trạng thái tạm dừng'
            : `Tài khoản bị tạm dừng đến ${new Date(pauseUntil).toLocaleString()}`
        );
      } catch (err) {
        setSubmitStatus(err?.response?.data?.message || 'Cập nhật trạng thái thất bại');
      }
      return;
    }
  };

  return (
    <div className="admin-user-management-page">
      <header className="admin-user-management-header">
        <div>
          <h1>Quản lý người dùng</h1>
          <p>Danh sách người dùng, phân quyền và xóa tài khoản.</p>
        </div>
        <form className="admin-user-management-toolbar" onSubmit={applySearch}>
          <input
            type="search"
            placeholder="Tìm kiếm theo tên, email hoặc username"
            value={search}
            onChange={handleSearch}
            className="admin-user-search"
          />
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="admin-user-role-filter"
          >
            {ROLE_OPTIONS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
          <button type="submit" className="admin-user-search-btn" disabled={loading}>
            Tìm
          </button>
          <button
            type="button"
            className="admin-user-add-btn"
            onClick={openAddUserModal}
            disabled={loading}
          >
            Thêm user
          </button>
          <button
            type="button"
            className="admin-user-refresh-btn"
            onClick={loadUsers}
            disabled={loading}
          >
            Làm mới
          </button>
        </form>
        {selectedUserIds.length > 0 && (
          <div className="admin-user-bulk-bar">
            <span>{selectedUserIds.length} người dùng đã chọn</span>
            <button type="button" className="admin-user-delete-btn" onClick={handleBulkDelete} disabled={loading}>
              Xóa đã chọn
            </button>
          </div>
        )}
      </header>

      {submitStatus && <div className="admin-user-notice">{submitStatus}</div>}
      {error && <div className="admin-user-error">{error}</div>}

      {isAddModalOpen && (
        <div className="modal-overlay">
          <div className="add-user-modal">
            <h2>{isEditMode ? 'Sửa User' : 'Thêm User'}</h2>
            <form onSubmit={handleAddUserSubmit}>
              <div className="modal-grid">
                <label>
                  Họ tên
                  <input
                    value={newUserData.fullname}
                    onChange={(e) => setNewUserData((prev) => ({ ...prev, fullname: e.target.value }))}
                    required
                  />
                </label>
                <label>
                  Email
                  <input
                    type="email"
                    value={newUserData.email}
                    onChange={(e) => setNewUserData((prev) => ({ ...prev, email: e.target.value }))}
                    required
                  />
                </label>
                <label>
                  Username
                  <input
                    value={newUserData.username}
                    onChange={(e) => setNewUserData((prev) => ({ ...prev, username: e.target.value }))}
                    required
                  />
                </label>
                <label>
                  Password
                  <div className="password-input-wrap">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={newUserData.password}
                      onChange={(e) => setNewUserData((prev) => ({ ...prev, password: e.target.value }))}
                      required={!isEditMode}
                      placeholder={isEditMode ? 'Để trống nếu không đổi mật khẩu' : ''}
                    />
                    <button
                      type="button"
                      className="password-toggle-btn"
                      onClick={() => setShowPassword((prev) => !prev)}
                    >
                      {showPassword ? 'Ẩn' : 'Hiện'}
                    </button>
                  </div>
                </label>
                <label>
                  Phone
                  <input
                    value={newUserData.phone}
                    onChange={(e) => setNewUserData((prev) => ({ ...prev, phone: e.target.value }))}
                  />
                </label>
                <label>
                  Address
                  <input
                    value={newUserData.address}
                    onChange={(e) => setNewUserData((prev) => ({ ...prev, address: e.target.value }))}
                  />
                </label>
                <label>
                  Role
                  <select
                    value={newUserData.role}
                    onChange={(e) => setNewUserData((prev) => ({ ...prev, role: e.target.value }))}
                  >
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
                  </select>
                </label>
                <label>
                  Gender
                  <select
                    value={newUserData.gender}
                    onChange={(e) => setNewUserData((prev) => ({ ...prev, gender: e.target.value }))}
                  >
                    <option value="">Chưa chọn</option>
                    <option value="male">Nam</option>
                    <option value="female">Nữ</option>
                    <option value="other">Khác</option>
                  </select>
                </label>
              </div>

              {addFormError && <div className="add-user-error">{addFormError}</div>}
              <div className="modal-actions">
                <button type="submit" className="admin-user-add-btn" disabled={loading}>
                  Lưu vào danh sách
                </button>
                <button type="button" className="admin-user-refresh-btn" onClick={closeAddUserModal}>
                  Hủy
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
                  aria-label="Chọn tất cả"
                />
              </th>
              <th>Họ tên</th>
              <th>Email</th>
              <th>Username</th>
              <th>Role</th>
              <th>Trạng thái</th>
              <th>Pause đến</th>
              <th>Ngày gia nhập</th>
              <th>Hành động</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="9" className="admin-user-loading">
                  Đang tải dữ liệu...
                </td>
              </tr>
            ) : filteredUsers.length === 0 ? (
              <tr>
                <td colSpan="9" className="admin-user-empty">
                  Không tìm thấy người dùng.
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
                      aria-label={`Chọn ${user.fullname || user.username || user.email}`}
                    />
                  </td>
                  <td>{user.fullname || 'N/A'}</td>
                  <td>{user.email || 'N/A'}</td>
                  <td>{user.username || 'N/A'}</td>
                  <td>{String(user.role || 'user').toUpperCase()}</td>
                  <td>
                    <span
                      className={`status-badge status-${(user.status || 'active').toLowerCase()}`}
                    >
                      {String(user.status || 'active').toUpperCase()}
                    </span>
                  </td>
                  <td>{user.pause_until ? formatDate(user.pause_until) : 'N/A'}</td>
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
                          <li onClick={() => handleAction(user.id, 'edit')}>Sửa</li>
                          <li onClick={() => handleAction(user.id, 'delete')}>
                            Xóa
                          </li>
                          {user.status === 'blocked' ? (
                            <li onClick={() => handleAction(user.id, 'unblock')}>Bỏ khóa</li>
                          ) : (
                            <li onClick={() => handleAction(user.id, 'block')}>Khóa vĩnh viễn</li>
                          )}
                          <li onClick={() => handleAction(user.id, 'pause')}>
                            {user.status === 'paused' ? 'Mở lại' : 'Tạm dừng'}
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
          <strong>Trang {currentPage}/{totalPages}</strong> (Tổng {sortedUsers.length} users)
        </div>
        <div className="admin-user-pagination-controls">
          <button
            type="button"
            onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
            disabled={currentPage <= 1}
          >
            « Trước
          </button>
          <button
            type="button"
            onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
            disabled={currentPage >= totalPages}
          >
            Tiếp »
          </button>
        </div>
      </div>
    </div>
  );
}

export default AdminUserManagementPage;

