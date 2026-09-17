import io
import pandas as pd

def test_create_shop(client):
    response = client.post("/api/v1/shops/", json={
        "hul_code": "TEST1",
        "name": "Test Shop",
        "beat_name": "Test Beat",
        "latitude": 12.34,
        "longitude": 56.78
    })
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Test Shop"
    assert data["is_archived"] is False
    assert "id" in data

def test_get_shops(client):
    client.post("/api/v1/shops/", json={
        "hul_code": "TEST2",
        "name": "Another Shop",
        "latitude": 10.0,
        "longitude": 20.0
    })
    response = client.get("/api/v1/shops/")
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 1
    assert any(shop["name"] == "Another Shop" for shop in data)

def test_update_shop(client):
    # Create
    create_res = client.post("/api/v1/shops/", json={
        "name": "Shop to Update",
        "latitude": 1.0,
        "longitude": 1.0
    })
    shop_id = create_res.json()["id"]

    # Update
    update_res = client.put(f"/api/v1/shops/{shop_id}", json={
        "name": "Updated Shop Name"
    })
    assert update_res.status_code == 200
    assert update_res.json()["name"] == "Updated Shop Name"

def test_delete_shop(client):
    # Create
    create_res = client.post("/api/v1/shops/", json={
        "name": "Shop to Delete",
        "latitude": 1.0,
        "longitude": 1.0
    })
    shop_id = create_res.json()["id"]

    # Delete
    del_res = client.delete(f"/api/v1/shops/{shop_id}")
    assert del_res.status_code == 200

    # Ensure it's not in the get list (soft deleted)
    get_res = client.get("/api/v1/shops/")
    data = get_res.json()
    assert not any(shop["id"] == shop_id for shop in data)

def test_upload_shops(client):
    # Create an in-memory Excel file
    df = pd.DataFrame({
        'Outlet HUL Code': ['HUL001', 'HUL002'],
        'Outlet Name': ['Shop A', 'Shop B'],
        'Beat Name': ['Beat 1', 'Beat 2'],
        'Outlet Latitude': [10.1, 20.1],
        'Outlet Longitude': [10.2, 20.2]
    })
    buffer = io.BytesIO()
    df.to_excel(buffer, index=False)
    buffer.seek(0)
    
    response = client.post(
        "/api/v1/shops/upload",
        files={"file": ("test.xlsx", buffer, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}
    )
    
    assert response.status_code == 200
    assert "Successfully imported 2 shops" in response.json()["message"]
    
    # Verify in DB
    get_res = client.get("/api/v1/shops/")
    names = [s["name"] for s in get_res.json()]
    assert "Shop A" in names
    assert "Shop B" in names

def test_export_shops(client):
    client.post("/api/v1/shops/", json={
        "name": "Exportable Shop",
        "latitude": 0.0,
        "longitude": 0.0
    })
    
    response = client.get("/api/v1/shops/export")
    assert response.status_code == 200
    assert response.headers["content-type"] == "text/csv; charset=utf-8"
    assert "Exportable Shop" in response.text
