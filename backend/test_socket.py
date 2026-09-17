import socketio

sio = socketio.Client()

@sio.event
def connect():
    print("Connection established")

@sio.event
def connect_error(data):
    print("The connection failed!")

@sio.event
def disconnect():
    print("Disconnected from server")

print("Attempting to connect...")
sio.connect('http://localhost:8001')
print("Connected!")
sio.disconnect()
