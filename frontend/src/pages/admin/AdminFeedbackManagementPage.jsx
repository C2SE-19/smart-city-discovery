import { useEffect, useMemo, useState } from 'react';
import {
  createAdminFeedbackType,
  deleteAdminFeedbackReport,
  deleteAdminFeedbackType,
  fetchAdminFeedbackReportDetail,
  fetchAdminFeedbackReports,
  fetchAdminFeedbackTypes,
  sendAdminFeedbackReply,
  updateAdminFeedbackType,
} from '../../services/api/adminFeedbackApi';
import './AdminFeedbackManagementPage.css';

const REFRESH_INTERVAL_MS = 7000;

const REPORT_STATUS_OPTIONS = [
  { value: 'all', label: 'All statuses' },
  { value: 'new', label: 'New' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'replied', label: 'Replied' },
  { value: 'closed', label: 'Closed' },
];

const REPORT_TYPE_OPTIONS = [
  { value: 'all', label: 'All report types' },
  { value: 'venue_report', label: 'Venue Report' },
  { value: 'review_report', label: 'Review Report' },
];

const STATUS_LABELS = {
  new: 'New',
  in_progress: 'In Progress',
  replied: 'Replied',
  closed: 'Closed',
};

function resolveApiOrigin(baseUrl) {
  const normalizedBaseUrl = String(baseUrl || '').trim();

  if (/^https?:\/\//i.test(normalizedBaseUrl)) {
    return normalizedBaseUrl.replace(/\/api\/v1\/?$/, '').replace(/\/api\/?$/, '');
  }

  const uploadsBaseUrl = String(import.meta.env.VITE_UPLOADS_BASE_URL || '').trim();
  if (/^https?:\/\//i.test(uploadsBaseUrl)) {
    return uploadsBaseUrl.replace(/\/$/, '');
  }

  if (typeof window !== 'undefined') {
    return window.location.origin;
  }

  return 'http://localhost:3000';
}

const DEFAULT_API_BASE_URL = import.meta.env.DEV ? 'http://localhost:3000/api/v1' : '/api';
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || DEFAULT_API_BASE_URL;
const API_ORIGIN = resolveApiOrigin(API_BASE_URL);

function toUploadedFileUrl(rawUrl) {
  if (!rawUrl) {
    return '';
  }

  if (/^https?:\/\//i.test(rawUrl)) {
    return rawUrl;
  }

  return `${API_ORIGIN}${rawUrl.startsWith('/') ? rawUrl : `/${rawUrl}`}`;
}

function isImageAttachmentUrl(rawUrl) {
  if (!rawUrl) {
    return false;
  }

  const sanitizedUrl = String(rawUrl).split('?')[0].toLowerCase();
  return /\.(png|jpg|jpeg|webp|gif|bmp|svg)$/.test(sanitizedUrl);
}

function formatDateTime(value) {
  if (!value) {
    return 'N/A';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'N/A';
  }

  return date.toLocaleString();
}

function AdminFeedbackManagementPage() {
  const [activeView, setActiveView] = useState('types');

  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [searchInput, setSearchInput] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');

  const [reports, setReports] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, pageSize: 50, totalPages: 1 });
  const [reportsLoading, setReportsLoading] = useState(true);
  const [reportsError, setReportsError] = useState('');

  const [selectedReportId, setSelectedReportId] = useState(null);
  const [selectedReport, setSelectedReport] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [replyNotice, setReplyNotice] = useState('');
  const [replyNoticeType, setReplyNoticeType] = useState('');
  const [lightboxImageUrl, setLightboxImageUrl] = useState('');

  const [replyMessage, setReplyMessage] = useState('');
  const [replyAttachment, setReplyAttachment] = useState(null);
  const [replySubmitting, setReplySubmitting] = useState(false);

  const [typeRows, setTypeRows] = useState([]);
  const [typesLoading, setTypesLoading] = useState(true);
  const [typesError, setTypesError] = useState('');
  const [typesNotice, setTypesNotice] = useState('');
  const [typeSubmitting, setTypeSubmitting] = useState(false);
  const [selectedTypeId, setSelectedTypeId] = useState(null);
  const [typeNameInput, setTypeNameInput] = useState('');

  const selectedSummary = useMemo(
    () => reports.find((item) => Number(item.id) === Number(selectedReportId)) || null,
    [reports, selectedReportId]
  );

  const selectedType = useMemo(
    () => typeRows.find((item) => Number(item.id) === Number(selectedTypeId)) || null,
    [typeRows, selectedTypeId]
  );

  const loadFeedbackTypes = async ({ silent = false } = {}) => {
    try {
      if (!silent) {
        setTypesLoading(true);
      }

      const rows = await fetchAdminFeedbackTypes();
      const normalizedRows = Array.isArray(rows) ? rows : [];
      setTypeRows(normalizedRows);

      if (selectedTypeId) {
        const selectedRowStillExists = normalizedRows.some(
          (row) => Number(row.id) === Number(selectedTypeId)
        );

        if (!selectedRowStillExists) {
          setSelectedTypeId(null);
          setTypeNameInput('');
        }
      }

      if (!silent) {
        setTypesError('');
      }
    } catch (error) {
      if (!silent) {
        setTypesError(error?.response?.data?.message || 'Failed to load feedback types.');
      }
    } finally {
      if (!silent) {
        setTypesLoading(false);
      }
    }
  };

  const loadReports = async ({ silent = false } = {}) => {
    try {
      if (!silent) {
        setReportsLoading(true);
      }

      const response = await fetchAdminFeedbackReports({
        status: statusFilter === 'all' ? undefined : statusFilter,
        typeCode: typeFilter === 'all' ? undefined : typeFilter,
        search: appliedSearch || undefined,
        page: 1,
        pageSize: 50,
      });

      const nextItems = Array.isArray(response?.items) ? response.items : [];
      setReports(nextItems);
      setPagination(response?.pagination || { total: nextItems.length, page: 1, pageSize: 50, totalPages: 1 });

      if (!nextItems.length) {
        setSelectedReportId(null);
        setSelectedReport(null);
        if (!silent) {
          setDetailError('');
          setReportsError('');
        }
        return;
      }

      const stillExists = nextItems.some((item) => Number(item.id) === Number(selectedReportId));
      if (!selectedReportId || !stillExists) {
        setSelectedReportId(nextItems[0].id);
      }

      if (!silent) {
        setReportsError('');
      }
    } catch (error) {
      if (!silent) {
        setReportsError(error?.response?.data?.message || 'Failed to load feedback reports.');
        setReports([]);
        setSelectedReportId(null);
        setSelectedReport(null);
      }
    } finally {
      if (!silent) {
        setReportsLoading(false);
      }
    }
  };

  const loadReportDetail = async (feedbackId, { silent = false } = {}) => {
    if (!feedbackId) {
      setSelectedReport(null);
      return;
    }

    try {
      if (!silent) {
        setDetailLoading(true);
      }

      const detail = await fetchAdminFeedbackReportDetail(feedbackId);
      setSelectedReport(detail || null);

      if (!silent) {
        setDetailError('');
      }
    } catch (error) {
      if (!silent) {
        setSelectedReport(null);
        setDetailError(error?.response?.data?.message || 'Failed to load report details.');
      }
    } finally {
      if (!silent) {
        setDetailLoading(false);
      }
    }
  };

  useEffect(() => {
    if (activeView === 'types') {
      loadFeedbackTypes();
      return;
    }

    loadReports();
  }, [activeView, statusFilter, typeFilter, appliedSearch]);

  useEffect(() => {
    if (activeView !== 'reports') {
      return;
    }

    loadReportDetail(selectedReportId);
  }, [activeView, selectedReportId]);

  useEffect(() => {
    if (activeView !== 'types') {
      return undefined;
    }

    const pollingTimerId = window.setInterval(() => {
      loadFeedbackTypes({ silent: true });
    }, REFRESH_INTERVAL_MS);

    return () => {
      window.clearInterval(pollingTimerId);
    };
  }, [activeView, selectedTypeId]);

  useEffect(() => {
    if (activeView !== 'reports') {
      return undefined;
    }

    const pollingTimerId = window.setInterval(() => {
      loadReports({ silent: true });
      if (selectedReportId) {
        loadReportDetail(selectedReportId, { silent: true });
      }
    }, REFRESH_INTERVAL_MS);

    return () => {
      window.clearInterval(pollingTimerId);
    };
  }, [activeView, statusFilter, typeFilter, appliedSearch, selectedReportId]);

  useEffect(() => {
    if (!lightboxImageUrl) {
      return undefined;
    }

    const handleEscapeKey = (event) => {
      if (event.key === 'Escape') {
        setLightboxImageUrl('');
      }
    };

    window.addEventListener('keydown', handleEscapeKey);
    return () => {
      window.removeEventListener('keydown', handleEscapeKey);
    };
  }, [lightboxImageUrl]);

  useEffect(() => {
    setReplyNotice('');
    setReplyNoticeType('');
  }, [activeView, selectedReportId]);

  useEffect(() => {
    const contentFrameElement = document.querySelector('.admin-content-frame');
    if (!contentFrameElement) {
      return undefined;
    }

    if (activeView === 'reports') {
      contentFrameElement.classList.add('admin-content-frame--allow-scroll');
    } else {
      contentFrameElement.classList.remove('admin-content-frame--allow-scroll');
    }

    return () => {
      contentFrameElement.classList.remove('admin-content-frame--allow-scroll');
    };
  }, [activeView]);

  const handleTypeSelect = (row) => {
    setSelectedTypeId(row.id);
    setTypeNameInput(row.name || '');
    setTypesError('');
    setTypesNotice('');
  };

  const handleClearTypeInput = () => {
    setSelectedTypeId(null);
    setTypeNameInput('');
    setTypesError('');
    setTypesNotice('');
  };

  const handleCreateType = async () => {
    if (!typeNameInput.trim()) {
      setTypesError('Feedback type name is required.');
      return;
    }

    try {
      setTypeSubmitting(true);
      setTypesError('');
      setTypesNotice('');

      const createdRow = await createAdminFeedbackType({
        name: typeNameInput.trim(),
      });

      await loadFeedbackTypes();
      setSelectedTypeId(createdRow?.id || null);
      setTypeNameInput(createdRow?.name || typeNameInput.trim());
      setTypesNotice('Feedback type created.');
    } catch (error) {
      setTypesError(error?.response?.data?.message || 'Failed to create feedback type.');
    } finally {
      setTypeSubmitting(false);
    }
  };

  const handleUpdateType = async () => {
    if (!selectedTypeId) {
      setTypesError('Select an existing feedback type from the left list to update.');
      return;
    }

    if (!typeNameInput.trim()) {
      setTypesError('Feedback type name is required.');
      return;
    }

    try {
      setTypeSubmitting(true);
      setTypesError('');
      setTypesNotice('');

      const updatedRow = await updateAdminFeedbackType(selectedTypeId, {
        name: typeNameInput.trim(),
      });

      await loadFeedbackTypes();
      setTypeNameInput(updatedRow?.name || typeNameInput.trim());
      setTypesNotice('Feedback type updated.');
    } catch (error) {
      setTypesError(error?.response?.data?.message || 'Failed to update feedback type.');
    } finally {
      setTypeSubmitting(false);
    }
  };

  const handleDeleteType = async () => {
    if (!selectedTypeId) {
      setTypesError('Select an existing feedback type from the left list to delete.');
      return;
    }

    const confirmed = window.confirm(`Delete feedback type "${selectedType?.name || selectedTypeId}"?`);
    if (!confirmed) {
      return;
    }

    try {
      setTypeSubmitting(true);
      setTypesError('');
      setTypesNotice('');

      await deleteAdminFeedbackType(selectedTypeId);
      await loadFeedbackTypes();
      setSelectedTypeId(null);
      setTypeNameInput('');
      setTypesNotice('Feedback type deleted.');
    } catch (error) {
      setTypesError(error?.response?.data?.message || 'Failed to delete feedback type.');
    } finally {
      setTypeSubmitting(false);
    }
  };

  const handleSearchSubmit = (event) => {
    event.preventDefault();
    setAppliedSearch(searchInput.trim());
  };

  const handleReplySubmit = async (event) => {
    event.preventDefault();

    if (!selectedReport?.id) {
      return;
    }

    if (!replyMessage.trim()) {
      setReplyNoticeType('error');
      setReplyNotice('Reply message is required.');
      return;
    }

    try {
      setReplySubmitting(true);
      setDetailError('');
      setReplyNotice('');
      setReplyNoticeType('');

      const replyResult = await sendAdminFeedbackReply(selectedReport.id, {
        replyMessage: replyMessage.trim(),
        attachment: replyAttachment,
      });

      const deliveredTo = replyResult?.deliveredTo || selectedReport?.contact_email || 'recipient';
      if (replyResult?.emailSent === false) {
        setReplyNoticeType('error');
        setReplyNotice(
          `Reply was saved for report and targeted to ${deliveredTo}, but email delivery failed (Gmail auth).`
        );
      } else {
        setReplyNoticeType('success');
        setReplyNotice(`Reply sent successfully to ${deliveredTo}.`);
      }

      setReplyMessage('');
      setReplyAttachment(null);
      const fileInput = document.getElementById('admin-reply-attachment');
      if (fileInput) {
        fileInput.value = '';
      }

      await Promise.all([
        loadReports({ silent: true }),
        loadReportDetail(selectedReport.id, { silent: true }),
      ]);
    } catch (error) {
      setReplyNoticeType('error');
      setReplyNotice(error?.response?.data?.message || 'Failed to send reply.');
    } finally {
      setReplySubmitting(false);
    }
  };

  const handleClearReplyAttachment = () => {
    setReplyAttachment(null);
    const fileInput = document.getElementById('admin-reply-attachment');
    if (fileInput) {
      fileInput.value = '';
    }
  };

  const handleDeleteReport = async () => {
    const reportToDelete = selectedReport || selectedSummary;

    if (!reportToDelete?.id) {
      return;
    }

    const reportTypeCode = String(reportToDelete?.feedback_type_code || '').trim().toLowerCase();
    const shouldDeleteTarget = reportTypeCode === 'review_report' || reportTypeCode === 'venue_report';
    const deleteTargetLabel = reportTypeCode === 'review_report'
      ? 'review/comment'
      : reportTypeCode === 'venue_report'
        ? 'venue/place'
        : 'reported target';

    const confirmed = window.confirm(
      shouldDeleteTarget
        ? `Delete feedback report #${reportToDelete.id} and permanently delete the related ${deleteTargetLabel}?`
        : `Delete feedback report #${reportToDelete.id}?`
    );
    if (!confirmed) {
      return;
    }

    try {
      setReplyNotice('');
      setReplyNoticeType('');
      setDetailError('');

      const result = await deleteAdminFeedbackReport(reportToDelete.id, {
        deleteTarget: shouldDeleteTarget,
      });

      if (result?.deletedTarget) {
        setReplyNoticeType('success');
        setReplyNotice(`Report deleted. Related ${deleteTargetLabel} was deleted successfully.`);
      } else {
        setReplyNoticeType('success');
        setReplyNotice('Report deleted successfully.');
      }

      await loadReports();
    } catch (error) {
      setDetailError(error?.response?.data?.message || 'Failed to delete report.');
    }
  };

  const renderFeedbackTypesView = () => (
    <section className="admin-feedback-split">
      <article className="admin-feedback-card admin-feedback-list-panel">
        <div className="admin-feedback-card-head">
          <h2>Feedback Types</h2>
          <p>Left panel shows current type names used in the user dropdown.</p>
        </div>

        {typesError ? <p className="admin-feedback-error">{typesError}</p> : null}
        {typesNotice ? <p className="admin-feedback-success">{typesNotice}</p> : null}

        <div className="admin-feedback-simple-list">
          {typesLoading ? <p>Loading feedback types...</p> : null}
          {!typesLoading && !typeRows.length ? <p>No feedback types found.</p> : null}
          {!typesLoading
            ? typeRows.map((row) => (
                <button
                  key={row.id}
                  type="button"
                  className={`admin-feedback-simple-item ${
                    Number(row.id) === Number(selectedTypeId) ? 'is-active' : ''
                  }`}
                  onClick={() => handleTypeSelect(row)}
                >
                  {row.name}
                </button>
              ))
            : null}
        </div>
      </article>

      <article className="admin-feedback-card admin-feedback-detail-panel">
        <div className="admin-feedback-card-head">
          <h2>Type Editor</h2>
          <p>Use one input box to add, edit, or delete feedback types.</p>
        </div>

        <div className="admin-feedback-type-editor">
          <label htmlFor="feedback-type-name">Choose a feedback type</label>
          <input
            id="feedback-type-name"
            type="text"
            value={typeNameInput}
            onChange={(event) => setTypeNameInput(event.target.value)}
            placeholder="Enter feedback type name"
          />

          <div className="admin-feedback-type-editor-actions">
            <button type="button" onClick={handleCreateType} disabled={typeSubmitting}>
              {typeSubmitting ? 'Saving...' : 'Add'}
            </button>
            <button
              type="button"
              className="secondary"
              onClick={handleUpdateType}
              disabled={typeSubmitting || !selectedTypeId}
            >
              Update
            </button>
            <button
              type="button"
              className="danger"
              onClick={handleDeleteType}
              disabled={typeSubmitting || !selectedTypeId}
            >
              Delete
            </button>
            <button type="button" className="secondary" onClick={handleClearTypeInput}>
              Clear
            </button>
          </div>
        </div>
      </article>
    </section>
  );

  const renderFeedbackReportsView = () => {
    const activeReport = selectedReport || selectedSummary;
    const userAttachmentRawUrl = activeReport?.attachment_url || '';
    const userAttachmentUrl = toUploadedFileUrl(userAttachmentRawUrl);
    const canPreviewUserAttachment = isImageAttachmentUrl(userAttachmentRawUrl);
    const activeReportTypeCode = String(activeReport?.feedback_type_code || '').trim().toLowerCase();
    const deleteReportButtonLabel = activeReportTypeCode === 'review_report'
      ? 'Delete Report + Review'
      : activeReportTypeCode === 'venue_report'
        ? 'Delete Report + Venue'
        : 'Delete Report';

    return (
    <section className="admin-feedback-workspace">
      <article className="admin-feedback-card admin-feedback-list-panel">
        <div className="admin-feedback-card-head">
          <h2>Feedback Reports</h2>
          <p>Incoming reports created by users. Auto-refresh every 7 seconds.</p>
        </div>

        <form className="admin-feedback-filters" onSubmit={handleSearchSubmit}>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            {REPORT_STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
            {REPORT_TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <input
            type="search"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Search message, email, or type"
          />
          <button type="submit">Apply</button>
        </form>

        {reportsError ? <p className="admin-feedback-error">{reportsError}</p> : null}

        <div className="admin-feedback-report-list">
          {reportsLoading ? <p>Loading reports...</p> : null}
          {!reportsLoading && !reports.length ? <p>No feedback reports found.</p> : null}
          {!reportsLoading
            ? reports.map((report) => (
                <button
                  key={report.id}
                  type="button"
                  className={`admin-feedback-report-item ${
                    Number(report.id) === Number(selectedReportId) ? 'is-active' : ''
                  }`}
                  onClick={() => setSelectedReportId(report.id)}
                >
                  <div className="admin-feedback-report-item-head">
                    <strong>#{report.id} - {report.feedback_type_name || 'Other'}</strong>
                    <span className={`status ${report.status || 'new'}`}>
                      {STATUS_LABELS[report.status] || report.status || 'New'}
                    </span>
                  </div>
                  <p>{report.message}</p>
                  <small>{formatDateTime(report.created_at)}</small>
                </button>
              ))
            : null}
        </div>
      </article>

      <article className="admin-feedback-card admin-feedback-detail-panel">
        <div className="admin-feedback-card-head">
          <h2>Report Detail</h2>
          <p>Review full report and reply with image attachment.</p>
        </div>

        {detailError ? <p className="admin-feedback-error">{detailError}</p> : null}
        {detailLoading ? <p>Loading report detail...</p> : null}
        {!detailLoading && !selectedReport && !selectedSummary ? (
          <p>Select a report to view details.</p>
        ) : null}

        {!detailLoading && activeReport ? (
          <>
            <div className="admin-feedback-detail-grid">
              <div>
                <span>Report ID</span>
                <strong>#{activeReport?.id}</strong>
              </div>
              <div>
                <span>Status</span>
                <strong>{STATUS_LABELS[activeReport?.status] || activeReport?.status || 'New'}</strong>
              </div>
              <div>
                <span>Feedback Type</span>
                <strong>{activeReport?.feedback_type_name || 'Other'}</strong>
              </div>
              <div>
                <span>Submitted At</span>
                <strong>{formatDateTime(activeReport?.created_at)}</strong>
              </div>
              <div>
                <span>Contact Email</span>
                <strong>{activeReport?.contact_email || 'N/A'}</strong>
              </div>
              <div>
                <span>Contact Phone</span>
                <strong>{activeReport?.contact_phone || 'N/A'}</strong>
              </div>
            </div>

            <div className="admin-feedback-message-block">
              <h3>User Message</h3>
              <p>{activeReport?.message || ''}</p>
              {userAttachmentRawUrl ? (
                <>
                  {canPreviewUserAttachment ? (
                    <button
                      type="button"
                      className="admin-feedback-image-trigger"
                      onClick={() => setLightboxImageUrl(userAttachmentUrl)}
                    >
                      <img
                        src={userAttachmentUrl}
                        alt="User attachment"
                        className="admin-feedback-inline-image"
                      />
                    </button>
                  ) : null}
                  <a
                    href={userAttachmentUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open user attachment
                  </a>
                </>
              ) : (
                <span>No user attachment</span>
              )}
            </div>

            <form className="admin-feedback-reply-form" onSubmit={handleReplySubmit}>
              <h3>Admin Reply</h3>
              <textarea
                value={replyMessage}
                onChange={(event) => setReplyMessage(event.target.value)}
                rows={5}
                placeholder="Write your support reply..."
                required
              />

              <div className="admin-feedback-reply-row">
                <div className="admin-feedback-upload-tools">
                  <label className="admin-feedback-upload">
                    <span>{replyAttachment ? replyAttachment.name : 'Attach image'}</span>
                    <input
                      id="admin-reply-attachment"
                      type="file"
                      accept=".png,.jpg,.jpeg,.webp,.gif"
                      onChange={(event) => setReplyAttachment(event.target.files?.[0] || null)}
                    />
                  </label>
                  <button
                    type="button"
                    className="admin-feedback-clear-upload"
                    onClick={handleClearReplyAttachment}
                    disabled={!replyAttachment}
                  >
                    Remove image
                  </button>
                </div>
              </div>

              <div className="admin-feedback-reply-footer">
                <div className="admin-feedback-reply-actions">
                  <button type="submit" disabled={replySubmitting}>
                    {replySubmitting ? 'Sending...' : 'Reply Report'}
                  </button>
                  <button type="button" className="danger" onClick={handleDeleteReport}>
                    {deleteReportButtonLabel}
                  </button>
                </div>
                {replyNotice ? (
                  <p
                    className={`admin-feedback-reply-notice ${
                      replyNoticeType === 'error' ? 'admin-feedback-error' : 'admin-feedback-success'
                    }`}
                  >
                    {replyNotice}
                  </p>
                ) : null}
              </div>
            </form>
          </>
        ) : null}
      </article>
    </section>
    );
  };

  return (
    <div className="admin-feedback-page">
      <section className="admin-feedback-hero">
        <div>
          <p className="admin-feedback-kicker">Support Operations</p>
          <h1>Feedback & Support Management</h1>
          <p>
            Review user feedback reports, manage feedback type options used by the public form,
            and send reply emails with optional image attachments.
          </p>
        </div>
        <div className="admin-feedback-hero-badge">
          <span>Total reports</span>
          <strong>{pagination.total || reports.length}</strong>
        </div>
      </section>

      <section className="admin-feedback-view-switch">
        <button
          type="button"
          className={activeView === 'types' ? 'is-active' : ''}
          onClick={() => setActiveView('types')}
        >
          Feedback Types
        </button>
        <button
          type="button"
          className={activeView === 'reports' ? 'is-active' : ''}
          onClick={() => setActiveView('reports')}
        >
          Manage Feedback Reports
        </button>
      </section>

      {activeView === 'types' ? renderFeedbackTypesView() : renderFeedbackReportsView()}

      {lightboxImageUrl ? (
        <div
          className="admin-feedback-lightbox"
          role="dialog"
          aria-modal="true"
          aria-label="Attachment preview"
          onClick={() => setLightboxImageUrl('')}
        >
          <button
            type="button"
            className="admin-feedback-lightbox-close"
            onClick={() => setLightboxImageUrl('')}
          >
            Close
          </button>
          <img
            src={lightboxImageUrl}
            alt="Attachment preview"
            className="admin-feedback-lightbox-image"
            onClick={(event) => event.stopPropagation()}
          />
        </div>
      ) : null}
    </div>
  );
}

export default AdminFeedbackManagementPage;
