import socket
import threading
import time
import pyaudio
import logging

# Настройка логирования
logging.basicConfig(level=logging.ERROR)

# Глобальный аудиомодуль (один для всех потоков)
class AudioModule:
    _instance = None
    _lock = threading.Lock()

    def __new__(cls):
        with cls._lock:
            if cls._instance is None:
                cls._instance = super().__new__(cls)
                cls._instance.audio = pyaudio.PyAudio()
                cls._instance.stream = cls._instance.audio.open(
                    format=pyaudio.paInt16,
                    channels=1,
                    rate=44100,
                    input=True,
                    output=True,
                    frames_per_buffer=1024,
                    input_device_index=0,
                    output_device_index=0
                )
            return cls._instance

    def __del__(self):
        self.stream.stop_stream()
        self.stream.close()
        self.audio.terminate()

# GPS-модуль
class GPSModule:
    def generate_nmea(self):
        return "$GPGGA,123519,4807.038,N,01131.000,E,1,08,0.9,545.4,M,46.9,M,,*47"

# Сетевой модуль
# main.py (исправленный фрагмент)
class NetworkModule:
    def __init__(self, ip, port):
        self.ip = ip
        self.port = port
        self.socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        self.socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        self.socket.bind((self.ip, self.port))
        self.socket.listen(5)
        print(f"Сервер запущен на {self.ip}:{self.port}")  # Добавьте логирование

    def handle_client(self, client_socket):
        gps_module = GPSModule()
        audio_module = AudioModule()  # Используем глобальный экземпляр

        try:
            while True:
                try:
                    # Отправка GPS данных
                    client_socket.send(gps_module.generate_nmea().encode())

                    # Передача аудио
                    audio_data = audio_module.capture_audio()
                    if audio_data:
                        client_socket.send(audio_data)
                except (BrokenPipeError, ConnectionResetError):
                    logging.error("Клиент отключился.")
                    break
                except Exception as e:
                    logging.error(f"Ошибка: {e}")
                    break

                time.sleep(1)
        finally:
            client_socket.close()

    def start(self):
        try:
            while True:
                client, addr = self.socket.accept()
                logging.info(f"Подключен клиент: {addr}")
                client_thread = threading.Thread(target=self.handle_client, args=(client,))
                client_thread.start()
        except KeyboardInterrupt:
            logging.info("Сервер остановлен.")
        finally:
            self.socket.close()

if __name__ == "__main__":
    network_module = NetworkModule("127.0.0.1", 5030)
    network_module.start()