def test_root_ok(client):
    resp = client.get("/")
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"


def test_admin_login_success(admin_token):
    assert admin_token


def test_login_wrong_password(client):
    resp = client.post("/auth/login", json={"username": "admin", "password": "wrong"})
    assert resp.status_code == 401


def test_admin_can_create_employee(client, admin_token):
    resp = client.post(
        "/admin/users",
        json={"username": "ion_test", "password": "parola123", "full_name": "Ion Test", "role": "employee"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert resp.status_code == 201
    assert resp.json()["role"] == "employee"


def test_duplicate_employee_rejected(client, admin_token):
    resp = client.post(
        "/admin/users",
        json={"username": "ion_test", "password": "parola123", "role": "employee"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert resp.status_code == 400


def test_employee_login_and_submission_flow(client, admin_token):
    login_resp = client.post("/auth/login", json={"username": "ion_test", "password": "parola123"})
    assert login_resp.status_code == 200
    emp_token = login_resp.json()["access_token"]
    emp_headers = {"Authorization": f"Bearer {emp_token}"}

    submit_resp = client.post(
        "/submissions", json={"var1": 10, "var2": 12, "var3": 11}, headers=emp_headers
    )
    assert submit_resp.status_code == 201
    body = submit_resp.json()
    assert body["average_berry_weight"] == 11.0
    assert body["status"] == "pending"

    mine_resp = client.get("/submissions/me", headers=emp_headers)
    assert mine_resp.status_code == 200
    assert len(mine_resp.json()) == 1

    # Employee must not be able to access admin endpoints.
    forbidden = client.get("/admin/submissions", headers=emp_headers)
    assert forbidden.status_code == 403

    # Admin sees and approves the submission.
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    all_resp = client.get("/admin/submissions", headers=admin_headers)
    assert all_resp.status_code == 200
    submission_id = all_resp.json()[0]["id"]

    review_resp = client.patch(
        f"/admin/submissions/{submission_id}", json={"status": "approved"}, headers=admin_headers
    )
    assert review_resp.status_code == 200
    assert review_resp.json()["status"] == "approved"


def test_export_endpoints_require_admin(client):
    resp = client.get("/admin/submissions/export/excel")
    assert resp.status_code == 401


def test_export_excel_and_pdf(client, admin_token):
    headers = {"Authorization": f"Bearer {admin_token}"}
    excel_resp = client.get("/admin/submissions/export/excel", headers=headers)
    assert excel_resp.status_code == 200
    assert excel_resp.headers["content-type"].startswith("application/vnd.openxmlformats")

    pdf_resp = client.get("/admin/submissions/export/pdf", headers=headers)
    assert pdf_resp.status_code == 200
    assert pdf_resp.headers["content-type"] == "application/pdf"
