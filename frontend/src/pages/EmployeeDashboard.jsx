import { useEffect, useState } from "react";
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

function todayValue() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

function createMeter() {
  return {
    orange_fruit: 0,
    white_pink_fruit: 0,
    white_fruit: 0,
    big_green_fruit: 0,
    small_green_fruit: 0,
    opened_flowers: 0,
    buds: 0,
  };
}

export default function EmployeeDashboard() {
  const [fields, setFields] = useState([]);
  const [fieldId, setFieldId] = useState("");
  const [date, setDate] = useState(todayValue());
  const [time, setTime] = useState("");
  const [meters, setMeters] = useState([createMeter()]);
  const [submissions, setSubmissions] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { auth, logout } = useAuth();
  const navigate = useNavigate();

  async function loadFields() {
    const { data } = await api.get("/fields");
    setFields(data);
    setFieldId((current) => current || (data[0] ? String(data[0].id) : ""));
  }

  async function loadSubmissions() {
    const { data } = await api.get("/submissions/me");
    setSubmissions(data);
  }

  useEffect(() => {
    async function loadData() {
      try {
        await Promise.all([loadFields(), loadSubmissions()]);
      } catch (err) {
        setError(err.response?.data?.detail || "Error loading dashboard");
      }
    }

    loadData();
  }, []);

  function updateMeter(index, key, value) {
    setMeters((current) =>
      current.map((meter, meterIndex) =>
        meterIndex === index ? { ...meter, [key]: Number(value) } : meter,
      ),
    );
  }

  function addMeter() {
    setMeters((current) => [...current, createMeter()]);
  }

  function removeMeter(index) {
    setMeters((current) => current.filter((_, meterIndex) => meterIndex !== index));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await api.post("/submissions", {
        field_id: Number(fieldId),
        date,
        time: time || null,
        meters: meters.map((meter, index) => ({
          meter_number: index + 1,
          ...meter,
        })),
      });
      setTime("");
      setMeters([createMeter()]);
      setDate(todayValue());
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
        <h1>Daily TL Counts</h1>
        <div className="topbar-right">
          <span>Hi, {auth.username}</span>
          <button className="secondary" onClick={handleLogout}>Log out</button>
        </div>
      </header>

      <main className="content">
        <div className="card stack">
          <h2>Submit daily count</h2>
          <form onSubmit={handleSubmit} className="stack">
            <div className="form-grid">
              <label>
                Field
                <select value={fieldId} onChange={(e) => setFieldId(e.target.value)} required>
                  {fields.map((field) => (
                    <option key={field.id} value={field.id}>
                      {field.name} ({field.total_meters} m)
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Date
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
              </label>
              <label>
                Time (optional)
                <input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
              </label>
            </div>

            <div className="stack">
              {meters.map((meter, index) => (
                <div key={index} className="card meter-card">
                  <div className="meter-header">
                    <h3>Meter {index + 1}</h3>
                    <button
                      type="button"
                      className="secondary"
                      onClick={() => removeMeter(index)}
                      disabled={meters.length === 1}
                    >
                      Remove meter
                    </button>
                  </div>
                  <div className="meter-grid">
                    {meterFields.map((field) => (
                      <label key={field.key}>
                        {field.label}
                        <input
                          type="number"
                          min="0"
                          value={meter[field.key]}
                          onChange={(e) => updateMeter(index, field.key, e.target.value)}
                          required
                        />
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="header-actions">
              <button type="button" className="secondary" onClick={addMeter}>Add meter</button>
              <button type="submit" disabled={loading || !fieldId}>
                {loading ? "Submitting..." : "Submit for approval"}
              </button>
            </div>
            {error && <p className="error">{error}</p>}
          </form>
        </div>

        <div className="card">
          <h2>My submissions</h2>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Field</th>
                  <th>Date</th>
                  <th># of meters</th>
                  <th>Status</th>
                  <th>Submitted At</th>
                </tr>
              </thead>
              <tbody>
                {submissions.map((submission) => (
                  <tr key={submission.id}>
                    <td>{submission.field.name}</td>
                    <td>{submission.date}</td>
                    <td>{submission.meters.length}</td>
                    <td>
                      <span className={`badge badge-${submission.status}`}>{statusLabel[submission.status]}</span>
                    </td>
                    <td>{new Date(submission.created_at).toLocaleString()}</td>
                  </tr>
                ))}
                {submissions.length === 0 && (
                  <tr>
                    <td colSpan={5} className="empty">No submissions yet</td>
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
