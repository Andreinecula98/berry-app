import { useEffect, useState } from "react";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";

const statusLabel = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
};

export default function EmployeeDashboard() {
  const [var1, setVar1] = useState("");
  const [var2, setVar2] = useState("");
  const [var3, setVar3] = useState("");
  const [preview, setPreview] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { auth, logout } = useAuth();
  const navigate = useNavigate();

  async function loadSubmissions() {
    const { data } = await api.get("/submissions/me");
    setSubmissions(data);
  }

  useEffect(() => {
    loadSubmissions();
  }, []);

  useEffect(() => {
    const nums = [var1, var2, var3].map(Number);
    if (var1 !== "" && var2 !== "" && var3 !== "" && nums.every((n) => !Number.isNaN(n))) {
      setPreview((nums[0] + nums[1] + nums[2]) / 3);
    } else {
      setPreview(null);
    }
  }, [var1, var2, var3]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await api.post("/submissions", { var1: Number(var1), var2: Number(var2), var3: Number(var3) });
      setVar1("");
      setVar2("");
      setVar3("");
      await loadSubmissions();
    } catch (err) {
      setError(err.response?.data?.detail || "An error occurred");
    } finally {
      setLoading(false);
    }
  }

  function handleLogout() {
    logout();
    navigate("/login");
  }

  return (
    <div className="page">
      <header className="topbar">
        <h1>Berry Weight App</h1>
        <div className="topbar-right">
          <span>Hi, {auth.username}</span>
          <button className="secondary" onClick={handleLogout}>Log out</button>
        </div>
      </header>

      <main className="content">
        <div className="card">
          <h2>Enter values</h2>
          <form onSubmit={handleSubmit} className="form-grid">
            <label>
              Var1
              <input type="number" step="any" value={var1} onChange={(e) => setVar1(e.target.value)} required />
            </label>
            <label>
              Var2
              <input type="number" step="any" value={var2} onChange={(e) => setVar2(e.target.value)} required />
            </label>
            <label>
              Var3
              <input type="number" step="any" value={var3} onChange={(e) => setVar3(e.target.value)} required />
            </label>
            <div className="preview">
              Average berry weight: <strong>{preview !== null ? preview.toFixed(2) : "-"}</strong>
            </div>
            {error && <p className="error">{error}</p>}
            <button type="submit" disabled={loading}>
              {loading ? "Submitting..." : "Submit for approval"}
            </button>
          </form>
        </div>

        <div className="card">
          <h2>My submissions</h2>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Var1</th>
                  <th>Var2</th>
                  <th>Var3</th>
                  <th>Average</th>
                  <th>Status</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {submissions.map((s) => (
                  <tr key={s.id}>
                    <td>{s.var1}</td>
                    <td>{s.var2}</td>
                    <td>{s.var3}</td>
                    <td>{s.average_berry_weight.toFixed(2)}</td>
                    <td>
                      <span className={`badge badge-${s.status}`}>{statusLabel[s.status]}</span>
                    </td>
                    <td>{new Date(s.created_at).toLocaleString()}</td>
                  </tr>
                ))}
                {submissions.length === 0 && (
                  <tr>
                    <td colSpan={6} className="empty">No submissions yet</td>
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
