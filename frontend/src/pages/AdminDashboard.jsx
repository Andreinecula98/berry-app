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
  const [newUser, setNewUser] = useState({ username: "", password: "", full_name: "" });
  const [error, setError] = useState("");
  const [userMsg, setUserMsg] = useState("");
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

  useEffect(() => {
    loadSubmissions(filter);
  }, [filter]);

  useEffect(() => {
    loadUsers();
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
      link.download = `berry_weight_report.${extension}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
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

  function handleLogout() {
    logout();
    navigate("/login");
  }

  return (
    <div className="page">
      <header className="topbar">
        <h1>Berry Weight App — Admin</h1>
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
          <h2>Employees ({users.length})</h2>
          <ul className="user-list">
            {users.map((u) => (
              <li key={u.id}>
                <strong>{u.username}</strong> {u.full_name ? `(${u.full_name})` : ""} — {u.role}
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
                  <th>Employee</th>
                  <th>Var1</th>
                  <th>Var2</th>
                  <th>Var3</th>
                  <th>Average</th>
                  <th>Status</th>
                  <th>Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {submissions.map((s) => (
                  <tr key={s.id}>
                    <td>{s.employee.full_name || s.employee.username}</td>
                    <td>{s.var1}</td>
                    <td>{s.var2}</td>
                    <td>{s.var3}</td>
                    <td>{s.average_berry_weight.toFixed(2)}</td>
                    <td>
                      <span className={`badge badge-${s.status}`}>{statusLabel[s.status]}</span>
                    </td>
                    <td>{new Date(s.created_at).toLocaleString()}</td>
                    <td className="actions">
                      <button disabled={s.status === "approved"} onClick={() => review(s.id, "approved")}>
                        Approve
                      </button>
                      <button
                        className="danger"
                        disabled={s.status === "rejected"}
                        onClick={() => review(s.id, "rejected")}
                      >
                        Reject
                      </button>
                    </td>
                  </tr>
                ))}
                {submissions.length === 0 && (
                  <tr>
                    <td colSpan={8} className="empty">No submissions</td>
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
