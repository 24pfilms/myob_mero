import math
import os
import threading
from pathlib import Path
from typing import Iterable, Protocol, Sequence

MODEL_NAME = os.getenv("MYOB_EMBEDDING_MODEL", "BAAI/bge-small-en-v1.5")
MODEL_DIMENSIONS = 384
MAX_BATCH_SIZE = 128
MAX_INPUT_CHARACTERS = 32_000


class LocalEmbeddingClient(Protocol):
    def embed_documents(self, texts: Sequence[str]) -> Iterable[Sequence[float]]: ...
    def embed_query(self, text: str) -> Sequence[float]: ...


class FastEmbedClient:
    def __init__(self, model_name: str = MODEL_NAME, cache_dir: str | None = None):
        from fastembed import TextEmbedding

        resolved_cache = cache_dir or os.getenv("MYOB_MODEL_CACHE") or str(Path(__file__).resolve().parent.parent / "data" / "models")
        Path(resolved_cache).mkdir(parents=True, exist_ok=True)
        self.model = TextEmbedding(model_name=model_name, cache_dir=resolved_cache, threads=max(1, min(4, os.cpu_count() or 1)))

    def embed_documents(self, texts: Sequence[str]) -> Iterable[Sequence[float]]:
        return self.model.embed(list(texts), batch_size=min(len(texts), 32))

    def embed_query(self, text: str) -> Sequence[float]:
        return next(iter(self.model.query_embed(text)))


class LocalEmbeddingProvider:
    def __init__(self, client: LocalEmbeddingClient | None = None, model_name: str = MODEL_NAME, dimensions: int = MODEL_DIMENSIONS):
        self.client = client
        self.model_name = model_name
        self.dimensions = dimensions
        self._lock = threading.Lock()

    def _client(self) -> LocalEmbeddingClient:
        if self.client is None:
            with self._lock:
                if self.client is None:
                    self.client = FastEmbedClient(self.model_name)
        return self.client

    def _validate_inputs(self, texts: Sequence[str]) -> list[str]:
        values = list(texts)
        if not values or len(values) > MAX_BATCH_SIZE:
            raise ValueError(f"Embedding batch must contain 1 to {MAX_BATCH_SIZE} inputs")
        if any(not isinstance(text, str) or not text.strip() or len(text) > MAX_INPUT_CHARACTERS for text in values):
            raise ValueError(f"Embedding inputs must be non-empty strings up to {MAX_INPUT_CHARACTERS} characters")
        return values

    def _validate_vector(self, vector: Sequence[float]) -> list[float]:
        values = [float(value) for value in vector]
        if len(values) != self.dimensions or any(not math.isfinite(value) for value in values):
            raise RuntimeError("Local embedding model returned an invalid vector")
        return values

    def embed_documents(self, texts: Sequence[str]) -> list[list[float]]:
        values = self._validate_inputs(texts)
        vectors = [self._validate_vector(vector) for vector in self._client().embed_documents(values)]
        if len(vectors) != len(values):
            raise RuntimeError("Local embedding model returned the wrong number of vectors")
        return vectors

    def embed_query(self, text: str) -> list[float]:
        value = self._validate_inputs([text])[0]
        return self._validate_vector(self._client().embed_query(value))


_provider = LocalEmbeddingProvider()


def get_local_embedding_provider() -> LocalEmbeddingProvider:
    return _provider
