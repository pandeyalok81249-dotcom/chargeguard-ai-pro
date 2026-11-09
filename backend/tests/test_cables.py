"""Tests for Cable inventory CRUD and validations."""

def test_cable_crud_flow(client):
    # 1. List cables
    res = client.get("/api/cables")
    assert res.status_code == 200
    initial_count = len(res.json())
    assert initial_count >= 4

    # 2. Search cables
    res = client.get("/api/cables?search=Anker")
    assert res.status_code == 200
    assert len(res.json()) >= 1

    # 3. Filter by connector
    res = client.get("/api/cables?connector_type=USB-C to USB-C")
    assert res.status_code == 200
    assert all(c["connector_type"] == "USB-C to USB-C" for c in res.json())

    # 4. Create new cable
    new_cable = {
        "cable_id": "cable-test-01",
        "display_name": "Ugreen 100W Right-Angle",
        "connector_type": "USB-C to USB-C",
        "cable_type": "Braided",
        "manufacturer_metadata": "Ugreen (User Provided)",
        "rated_power_w": 100.0,
        "rated_current_a": 5.0,
        "notes": "Testing cable"
    }
    res = client.post("/api/cables", json=new_cable)
    assert res.status_code == 201
    created = res.json()
    assert created["cable_id"] == "cable-test-01"

    # 5. Reject duplicate ID
    res = client.post("/api/cables", json=new_cable)
    assert res.status_code == 409

    # 6. Get single cable
    res = client.get("/api/cables/cable-test-01")
    assert res.status_code == 200
    assert res.json()["display_name"] == "Ugreen 100W Right-Angle"

    # 7. Update cable
    res = client.put("/api/cables/cable-test-01", json={"display_name": "Ugreen 100W Mod"})
    assert res.status_code == 200
    assert res.json()["display_name"] == "Ugreen 100W Mod"

    # 8. Delete cable
    res = client.delete("/api/cables/cable-test-01")
    assert res.status_code == 204

    # 9. Verify deleted
    res = client.get("/api/cables/cable-test-01")
    assert res.status_code == 404
