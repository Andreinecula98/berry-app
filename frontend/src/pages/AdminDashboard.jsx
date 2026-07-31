import { useEffect, useState } from "react";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";

const statusLabel = {
  pending: "În așteptare",
  approved: "Aprobat",
  rejected: "Respins",
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
      setError(err.response?.data?.detail || "Eroare la actualizare");
    }
  }

  async function handleCreateUser(e) {
    e.preventDefault();
    setUserMsg("");
    try {
      await api.post("/admin/users", { ...newUser, role: "employee" });
      setUserMsg(`Angajat "${newUser.username}" creat cu succes.`);
      setNewUser({ username: "", password: "", full_name: "" });
      await loadUsers();
    } catch (err) {
      setUserMsg(err.response?.data?.detail || "Eroare la creare utilizator");
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
          <span>Salut, {auth.username}</span>
          <button className="secondary" onClick={handleLogout}>Delogare</button>
        </div>
      </header>

      <main className="content">
        <div className="card">
          <h2>Creează angajat nou</h2>
          <form onSubmit={handleCreateUser} className="form-grid">
            <label>
              Utilizator
              <input
                value={newUser.username}
                onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                required
              />
            </label>
            <label>
              Nume complet
              <input
                value={newUser.full_name}
                onChange={(e) => setNewUser({ ...newUser, full_name: e.target.value })}
              />
            </label>
            <label>
              Parolă
              <input
                type="password"
                value={newUser.password}
                onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                required
                minLength={6}
              />
            </label>
            {userMsg && <p className="info">{userMsg}</p>}
            <button type="submit">Creează angajat</button>
          </form>
        </div>

        <div className="card">
          <h2>Angajați ({users.length})</h2>
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
            <h2>Toate trimiterile</h2>
            <select value={filter} onChange={(e) => setFilter(e.target.value)}>
              <option value="">Toate</option>
              <option value="pending">În așteptare</option>
              <option value="approved">Aprobate</option>
              <option value="rejected">Respinse</option>
            </select>
          </div>
          {error && <p className="error">{error}</p>}
          <table>
            <thead>
              <tr>
                <th>Angajat</th>
                <th>Var1</th>
                <th>Var2</th>
                <th>Var3</th>
                <th>Medie</th>
                <th>Status</th>
                <th>Data</th>
                <th>Acțiuni</th>
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
                      Aprobă
                    </button>
                    <button
                      className="danger"
                      disabled={s.status === "rejected"}
                      onClick={() => review(s.id, "rejected")}
                    >
                      Respinge
                    </button>
                  </td>
                </tr>
              ))}
              {submissions.length === 0 && (
                <tr>
                  <td colSpan={8} className="empty">Nicio trimitere</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
