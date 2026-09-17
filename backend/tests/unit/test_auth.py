from app.security.jwt import create_access_token
from app.security.password import get_password_hash, verify_password


def test_password_hashing():
    password = "supersecretpassword"
    hashed = get_password_hash(password)
    assert hashed != password
    assert verify_password(password, hashed) is True
    assert verify_password("wrongpassword", hashed) is False

def test_create_access_token():
    token = create_access_token(subject=1)
    assert isinstance(token, str)
    assert len(token) > 20
