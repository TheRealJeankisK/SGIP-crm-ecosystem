import redis
from config import settings

class RedisCacheAdapter:
    def __init__(self):
        self.host = settings.REDIS_HOST
        self.port = settings.REDIS_PORT
        self.client = None

    def _get_client(self):
        if self.client is None:
            try:
                self.client = redis.Redis(
                    host=self.host,
                    port=self.port,
                    decode_responses=True,
                    socket_connect_timeout=2
                )
            except Exception as e:
                print(f"Redis Cache Adapter - Failed to create client: {e}")
        return self.client

    def get_alerts_list(self, key: str = "patients_notifications_list") -> list:
        client = self._get_client()
        if client is None:
            raise Exception("Redis Cache - Connection not available")
        try:
            return client.lrange(key, 0, -1)
        except Exception as e:
            print(f"Redis Cache Adapter - Error reading from list: {e}")
            raise e

    def clear_alerts_list(self, key: str = "patients_notifications_list") -> None:
        client = self._get_client()
        if client is None:
            raise Exception("Redis Cache - Connection not available")
        try:
            client.delete(key)
        except Exception as e:
            print(f"Redis Cache Adapter - Error clearing list: {e}")
            raise e

    def verify_cache_health(self) -> bool:
        client = self._get_client()
        if client is None:
            return False
        try:
            return client.ping()
        except Exception:
            return False

cache_adapter = RedisCacheAdapter()
