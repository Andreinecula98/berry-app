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

function formatAverage(value) {
  return Number(value ?? 0).toFixed(2);
}

export default function EmployeeDashboard() {
  const [fields, setFields] = useState([]);
  const [fieldId, setFieldId] = useState("");
  const [date, setDate] = useState(todayValue());
  const [time, setTime] = useState("");
  const [meters, setMeters] = useState([createMeter()]);
  const [submissions, setSubmissions] = useState([]);
  const [expandedSubmissions, setExpandedSubmissions] = useState(() => new Set());
  const [editingId, setEditingId] = useState(null);
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

  function updateMeter(index, key, rawValue) {
    setMeters((current) =>
      current.map((meter, meterIndex) => {
        if (meterIndex !== index) {
          return meter;
        }
        let value = rawValue;
        // If the field still holds the default "0" and the user typed another
        // digit, drop the leading zero instead of showing e.g. "04".
        if (String(meter[key]) === "0" && value.length === 2 && value.includes("0")) {
          value = value.replace("0", "");
        }
        return { ...meter, [key]: Number(value) };
      }),
    );
  }

  function addMeter() {
    if (meters.length >= 3) {
      return;
    }
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
      const payload = {
        field_id: Number(fieldId),
        date,
        time: time || null,
        meters: meters.map((meter, index) => ({
          meter_number: index + 1,
          ...meter,
        })),
      };

      const { data: saved } = editingId
        ? await api.put(`/submissions/${editingId}`, payload)
        : await api.post("/submissions", payload);

      setTime("");
      setMeters([createMeter()]);
      setDate(todayValue());
      setEditingId(null);
      await loadSubmissions();
      setExpandedSubmissions((current) => new Set(current).add(saved.id));
    } catch (err) {
      setError(err.response?.data?.detail || "An error occurred");
    } finally {
      setLoading(false);
    }
  }

  function handleEdit(submission) {
    setError("");
    setEditingId(submission.id);
    setFieldId(String(submission.field.id));
    setDate(submission.date);
    setTime(submission.time || "");
    setMeters(
      submission.meters.map((meter) => ({
        orange_fruit: meter.orange_fruit,
        white_pink_fruit: meter.white_pink_fruit,
        white_fruit: meter.white_fruit,
        big_green_fruit: meter.big_green_fruit,
        small_green_fruit: meter.small_green_fruit,
        opened_flowers: meter.opened_flowers,
        buds: meter.buds,
      })),
    );
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cancelEdit() {
    setEditingId(null);
    setTime("");
    setMeters([createMeter()]);
    setDate(todayValue());
    setError("");
  }

  async function handleCancelSubmission(submission) {
    if (!window.confirm("Cancel this submission request? This cannot be undone.")) {
      return;
    }
    setError("");
    try {
      await api.delete(`/submissions/${submission.id}`);
      if (editingId === submission.id) {
        cancelEdit();
      }
      await loadSubmissions();
    } catch (err) {
      setError(err.response?.data?.detail || "Could not cancel submission");
    }
  }

  function handleLogout() {
    logout();
    navigate("/login");
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
        <h1>Daily TL Counts</h1>
        <div className="topbar-right">
          <span>Hi, {auth.username}</span>
          <button className="secondary" onClick={handleLogout}>Log out</button>
        </div>
      </header>

      <main className="content">
        <div className="card stack">
          <h2>{editingId ? "Edit submission" : "Submit daily count"}</h2>
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
              <button type="button" className="secondary" onClick={addMeter} disabled={meters.length >= 3}>
                Add meter (max 3)
              </button>
              {editingId && (
                <button type="button" className="secondary" onClick={cancelEdit}>
                  Cancel edit
                </button>
              )}
              <button type="submit" disabled={loading || !fieldId}>
                {loading ? "Saving..." : editingId ? "Save changes" : "Submit for approval"}
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
                  <th>Details</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {submissions.map((submission) => {
                  const isExpanded = expandedSubmissions.has(submission.id);

                  return (
                    <Fragment key={submission.id}>
                      <tr>
                        <td>{submission.field.name}</td>
                        <td>{submission.date}</td>
                        <td>{submission.meters.length}</td>
                        <td>
                          <span className={`badge badge-${submission.status}`}>{statusLabel[submission.status]}</span>
                        </td>
                        <td>{new Date(submission.created_at).toLocaleString()}</td>
                        <td>
                          <button
                            type="button"
                            className="secondary"
                            onClick={() => toggleSubmissionDetails(submission.id)}
                          >
                            {isExpanded ? "▾ Details" : "▸ Details"}
                          </button>
                        </td>
                        <td>
                          {submission.status === "pending" && (
                            <div className="row-actions">
                              <button type="button" className="secondary" onClick={() => handleEdit(submission)}>
                                Edit
                              </button>
                              <button
                                type="button"
                                className="danger"
                                onClick={() => handleCancelSubmission(submission)}
                              >
                                Cancel
                              </button>
                            </div>
                          )}
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
                    <td colSpan={7} className="empty">No submissions yet</td>
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
