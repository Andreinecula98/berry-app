import { Fragment, useEffect, useState } from "react";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";

const statusLabel = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
};

const meterFields = [
  { key: "orange_fruit", label: "Orange fruit" },
  { key: "white_pink_fruit", label: "White/pink fruit" },
  { key: "white_fruit", label: "White fruit" },
  { key: "big_green_fruit", label: "Big green fruit" },
  { key: "small_green_fruit", label: "Small green fruit" },
  { key: "opened_flowers", label: "Opened flowers" },
  { key: "buds", label: "Buds" },
];

function formatAverage(value) {
  return Number(value ?? 0).toFixed(2);
}

export default function AdminDashboard() {
  const [submissions, setSubmissions] = useState([]);
  const [filter, setFilter] = useState("");
  const [users, setUsers] = useState([]);
  const [fields, setFields] = useState([]);
  const [newUser, setNewUser] = useState({ username: "", password: "", full_name: "" });
  const [newField, setNewField] = useState({ name: "", total_meters: "" });
  const [error, setError] = useState("");
  const [userMsg, setUserMsg] = useState("");
  const [fieldMsg, setFieldMsg] = useState("");
  const [editingFieldId, setEditingFieldId] = useState(null);
  const [editField, setEditField] = useState({ name: "", total_meters: "" });
  const [resetUserId, setResetUserId] = useState(null);
  const [resetPassword, setResetPassword] = useState("");
  const [resetMsg, setResetMsg] = useState("");
  const [expandedSubmissions, setExpandedSubmissions] = useState(() => new Set());
  const { auth, logout } = useAuth();
  const navigate = useNavigate();

  async function loadSubmissions(status) {
    const { data } = await api.get("/admin/submissions", { params: status ? { status_filter: status } : {} });
    setSubmissions(data);
  }

  async function loadUsers() {
    const { data } = await api.get("/admin/users");
    setUsers(data);
  }

  async function loadFields() {
    const { data } = await api.get("/fields");
    setFields(data);
  }

  useEffect(() => {
    loadSubmissions(filter).catch(() => setError("Error loading submissions"));
  }, [filter]);

  useEffect(() => {
    Promise.all([loadUsers(), loadFields()]).catch(() => setError("Error loading dashboard"));
  }, []);

  async function review(id, status) {
    setError("");
    try {
      await api.patch(`/admin/submissions/${id}`, { status });
      await loadSubmissions(filter);
    } catch (err) {
      setError(err.response?.data?.detail || "Error updating submission");
    }
  }

  async function downloadReport(type) {
    setError("");
    try {
      const { data } = await api.get(`/admin/submissions/export/${type}`, {
        params: filter ? { status_filter: filter } : {},
        responseType: "blob",
      });
      const extension = type === "excel" ? "xlsx" : "pdf";
      const url = window.URL.createObjectURL(new Blob([data]));
      const link = document.createElement("a");
      link.href = url;
      link.download = `daily_tl_counts_report.${extension}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      setError("Error generating report");
    }
  }

  async function handleCreateUser(e) {
    e.preventDefault();
    setUserMsg("");
    setError("");
    try {
      await api.post("/admin/users", { ...newUser, role: "employee" });
      setUserMsg(`Employee "${newUser.username}" created successfully.`);
      setNewUser({ username: "", password: "", full_name: "" });
      await loadUsers();
    } catch (err) {
      setUserMsg(err.response?.data?.detail || "Error creating user");
    }
  }

  async function handleCreateField(e) {
    e.preventDefault();
    setFieldMsg("");
    setError("");
    try {
      await api.post("/admin/fields", {
        name: newField.name,
        total_meters: Number(newField.total_meters),
      });
      setFieldMsg(`Field "${newField.name}" created successfully.`);
      setNewField({ name: "", total_meters: "" });
      await loadFields();
    } catch (err) {
      setFieldMsg(err.response?.data?.detail || "Error creating field");
    }
  }

  function startFieldEdit(field) {
    setEditingFieldId(field.id);
    setEditField({ name: field.name, total_meters: String(field.total_meters) });
    setFieldMsg("");
  }

  function cancelFieldEdit() {
    setEditingFieldId(null);
    setEditField({ name: "", total_meters: "" });
  }

  async function handleUpdateField(e, fieldId) {
    e.preventDefault();
    setFieldMsg("");
    setError("");
    try {
      await api.put(`/admin/fields/${fieldId}`, {
        name: editField.name,
        total_meters: Number(editField.total_meters),
      });
      setFieldMsg(`Field "${editField.name}" updated successfully.`);
      cancelFieldEdit();
      await loadFields();
    } catch (err) {
      setFieldMsg(err.response?.data?.detail || "Error updating field");
    }
  }

  async function handleDeleteField(field) {
    if (!window.confirm(`Delete field ${field.name}? This is only possible if it has no submissions yet.`)) {
      return;
    }

    setFieldMsg("");
    setError("");
    try {
      await api.delete(`/admin/fields/${field.id}`);
      setFieldMsg(`Field "${field.name}" deleted successfully.`);
      if (editingFieldId === field.id) {
        cancelFieldEdit();
      }
      await loadFields();
    } catch (err) {
      setFieldMsg(err.response?.data?.detail || "Error deleting field");
    }
  }

  function handleLogout() {
    logout();
    navigate("/login");
  }

  function startReset(userId) {
    setResetUserId(userId);
    setResetPassword("");
    setResetMsg("");
  }

  function cancelReset() {
    setResetUserId(null);
    setResetPassword("");
  }

  async function handleResetPassword(e, userId) {
    e.preventDefault();
    setResetMsg("");
    setError("");
    try {
      await api.patch(`/admin/users/${userId}/password`, { password: resetPassword });
      setResetMsg("Password reset successfully.");
      setResetUserId(null);
      setResetPassword("");
    } catch (err) {
      setResetMsg(err.response?.data?.detail || "Error resetting password");
    }
  }

  async function handleDeleteUser(user) {
    if (!window.confirm(`Delete employee ${user.username} and all their submissions? This cannot be undone.`)) {
      return;
    }

    setError("");
    setUserMsg("");
    try {
      await api.delete(`/admin/users/${user.id}`);
      setUserMsg(`Employee "${user.username}" deleted successfully.`);
      setExpandedSubmissions((current) => {
        const next = new Set(current);
        for (const submission of submissions) {
          if (submission.employee.id === user.id) {
            next.delete(submission.id);
          }
        }
        return next;
      });
      if (resetUserId === user.id) {
        cancelReset();
      }
      await Promise.all([loadUsers(), loadSubmissions(filter)]);
    } catch (err) {
      setError(err.response?.data?.detail || "Error deleting employee");
    }
  }

  function toggleSubmissionDetails(submissionId) {
    setExpandedSubmissions((current) => {
      const next = new Set(current);
      if (next.has(submissionId)) {
        next.delete(submissionId);
      } else {
        next.add(submissionId);
      }
      return next;
    });
  }

  return (
    <div className="page">
      <header className="topbar">
        <h1>Daily TL Counts — Admin</h1>
        <div className="topbar-right">
          <span>Hi, {auth.username}</span>
          <button className="secondary" onClick={handleLogout}>Log out</button>
        </div>
      </header>

      <main className="content">
        {error && <p className="error">{error}</p>}
        <div className="card">
          <h2>Create new employee</h2>
          <form onSubmit={handleCreateUser} className="form-grid">
            <label>
              Username
              <input
                value={newUser.username}
                onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                required
              />
            </label>
            <label>
              Full name
              <input
                value={newUser.full_name}
                onChange={(e) => setNewUser({ ...newUser, full_name: e.target.value })}
              />
            </label>
            <label>
              Password
              <input
                type="password"
                value={newUser.password}
                onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                required
                minLength={6}
              />
            </label>
            {userMsg && <p className="info">{userMsg}</p>}
            <button type="submit">Create employee</button>
          </form>
        </div>

        <div className="card">
          <h2>Fields ({fields.length})</h2>
          <form onSubmit={handleCreateField} className="form-grid">
            <label>
              Name
              <input
                value={newField.name}
                onChange={(e) => setNewField({ ...newField, name: e.target.value })}
                required
              />
            </label>
            <label>
              Total meters
              <input
                type="number"
                min="1"
                value={newField.total_meters}
                onChange={(e) => setNewField({ ...newField, total_meters: e.target.value })}
                required
              />
            </label>
            {fieldMsg && <p className="info">{fieldMsg}</p>}
            <button type="submit">Add field</button>
          </form>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Total meters</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {fields.map((field) => (
                  <Fragment key={field.id}>
                    <tr>
                      <td>{field.name}</td>
                      <td>{field.total_meters}</td>
                      <td className="actions">
                        <button type="button" className="secondary" onClick={() => startFieldEdit(field)}>
                          Edit
                        </button>
                        <button type="button" className="danger" onClick={() => handleDeleteField(field)}>
                          Delete
                        </button>
                      </td>
                    </tr>
                    {editingFieldId === field.id && (
                      <tr>
                        <td colSpan={3}>
                          <form onSubmit={(e) => handleUpdateField(e, field.id)} className="inline-form">
                            <input
                              value={editField.name}
                              onChange={(e) => setEditField({ ...editField, name: e.target.value })}
                              required
                            />
                            <input
                              type="number"
                              min="1"
                              value={editField.total_meters}
                              onChange={(e) => setEditField({ ...editField, total_meters: e.target.value })}
                              required
                            />
                            <button type="submit">Save</button>
                            <button type="button" className="secondary" onClick={cancelFieldEdit}>
                              Cancel
                            </button>
                          </form>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <h2>Employees ({users.length})</h2>
          {resetMsg && <p className="info">{resetMsg}</p>}
          <ul className="user-list">
            {users.map((user) => (
              <li key={user.id}>
                <div>
                  <strong>{user.username}</strong> {user.full_name ? `(${user.full_name})` : ""} — {user.role}
                </div>
                {resetUserId === user.id ? (
                  <form onSubmit={(e) => handleResetPassword(e, user.id)} className="inline-form">
                    <input
                      type="password"
                      placeholder="New password"
                      value={resetPassword}
                      onChange={(e) => setResetPassword(e.target.value)}
                      required
                      minLength={6}
                    />
                    <button type="submit">Save</button>
                    <button type="button" className="secondary" onClick={cancelReset}>
                      Cancel
                    </button>
                  </form>
                ) : (
                  <div className="actions">
                    <button className="secondary" onClick={() => startReset(user.id)}>
                      Reset password
                    </button>
                    {user.role !== "admin" && (
                      <button className="danger" onClick={() => handleDeleteUser(user)}>
                        Delete
                      </button>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>

        <div className="card">
          <div className="card-header">
            <h2>All submissions</h2>
            <div className="header-actions">
              <select value={filter} onChange={(e) => setFilter(e.target.value)}>
                <option value="">All</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
              <button className="secondary" onClick={() => downloadReport("excel")}>
                📊 Export Excel
              </button>
              <button className="secondary" onClick={() => downloadReport("pdf")}>
                📄 Export PDF
              </button>
            </div>
          </div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Team Leader</th>
                  <th>Field</th>
                  <th>Date</th>
                  <th># of meters</th>
                  <th>Status</th>
                  <th>Submitted At</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {submissions.map((submission) => {
                  const isExpanded = expandedSubmissions.has(submission.id);

                  return (
                    <Fragment key={submission.id}>
                      <tr>
                        <td>{submission.employee.full_name || submission.employee.username}</td>
                        <td>{submission.field.name}</td>
                        <td>{submission.date}</td>
                        <td>{submission.meters.length}</td>
                        <td>
                          <span className={`badge badge-${submission.status}`}>{statusLabel[submission.status]}</span>
                        </td>
                        <td>{new Date(submission.created_at).toLocaleString()}</td>
                        <td className="actions">
                          <button
                            type="button"
                            className="secondary"
                            onClick={() => toggleSubmissionDetails(submission.id)}
                          >
                            {isExpanded ? "▾ Details" : "▸ Details"}
                          </button>
                          <button
                            disabled={submission.status === "approved"}
                            onClick={() => review(submission.id, "approved")}
                          >
                            Approve
                          </button>
                          <button
                            className="danger"
                            disabled={submission.status === "rejected"}
                            onClick={() => review(submission.id, "rejected")}
                          >
                            Reject
                          </button>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="detail-row">
                          <td colSpan={7}>
                            <div className="submission-detail">
                              <div className="table-scroll">
                                <table className="detail-table">
                                  <thead>
                                    <tr>
                                      <th>Meter</th>
                                      {meterFields.map((field) => (
                                        <th key={field.key}>{field.label}</th>
                                      ))}
                                      <th>Overall Avg</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {submission.meters.map((meter) => (
                                      <tr key={meter.id}>
                                        <td>{meter.meter_number}</td>
                                        {meterFields.map((field) => (
                                          <td key={field.key}>{meter[field.key]}</td>
                                        ))}
                                        <td>-</td>
                                      </tr>
                                    ))}
                                    <tr className="detail-average-row">
                                      <td>Average</td>
                                      {meterFields.map((field) => (
                                        <td key={field.key}>{formatAverage(submission.averages[field.key])}</td>
                                      ))}
                                      <td>{formatAverage(submission.overall_average)}</td>
                                    </tr>
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
                {submissions.length === 0 && (
                  <tr>
                    <td colSpan={7} className="empty">No submissions</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
