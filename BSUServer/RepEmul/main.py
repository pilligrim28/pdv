import socket
import threading
import time
import pyaudio

# Аудиомодуль
class AudioModule:
    def __init__(self):
        self.audio = pyaudio.PyAudio()
        self.stream = self.audio.open(format=pyaudio.paInt16, channels=1, rate=44100, input=True, output=True, frames_per_buffer=1024)

    def play_audio(self, data):
        self.stream.write(data)

    def capture_audio(self):
        return self.stream.read(1024)

# GPS-модуль
class GPSModule:
    def generate_nmea(self):
        # Пример данных GPS в формате NMEA
        return "$GPGGA,123519,4807.038,N,01131.000,E,1,08,0.9,545.4,M,46.9,M,,*47"

# Сетевой модуль
class NetworkModule:
    def __init__(self, ip, port):
        self.ip = ip
        self.port = port
        self.socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        self.socket.bind((self.ip, self.port))
        self.socket.listen(5)

    def handle_client(self, client_socket):
        audio_module = AudioModule()
        gps_module = GPSModule()

        while True:
            # Отправка GPS данных
            client_socket.send(gps_module.generate_nmea().encode())

            # Передача аудио
            audio_data = audio_module.capture_audio()
            client_socket.send(audio_data)

            time.sleep(1)

    def start(self):
        while True:
            client, addr = self.socket.accept()
            print(f"Подключен клиент: {addr}")
            client_thread = threading.Thread(target=self.handle_client, args=(client,))
            client_thread.start()

# Запуск эмулятора
if __name__ == "__main__":
    network_module = NetworkModule("127.0.0.1", 5000)
    network_module.start()