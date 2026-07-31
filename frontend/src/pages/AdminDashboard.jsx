import { useEffect, useState } from "react";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";

const statusLabel = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
};

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

  function handleLogout() {
    logout();
    navigate("/login");
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
                </tr>
              </thead>
              <tbody>
                {fields.map((field) => (
                  <tr key={field.id}>
                    <td>{field.name}</td>
                    <td>{field.total_meters}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <h2>Employees ({users.length})</h2>
          <ul className="user-list">
            {users.map((user) => (
              <li key={user.id}>
                <strong>{user.username}</strong> {user.full_name ? `(${user.full_name})` : ""} — {user.role}
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
          {error && <p className="error">{error}</p>}
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
                {submissions.map((submission) => (
                  <tr key={submission.id}>
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
                ))}
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
