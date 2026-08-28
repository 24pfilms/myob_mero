import math
import os
from dataclasses import dataclass
from typing import Callable, Protocol, Sequence

from openai import APIConnectionError, APIStatusError, APITimeoutError, AuthenticationError, OpenAI, RateLimitError

from security import get_ai_credential

DEFAULT_EMBEDDING_MODEL = "text-embedding-3-small"
DEFAULT_EMBEDDING_DIMENSIONS = 1536
MAX_EMBEDDING_BATCH = 128
MAX_INPUT_CHARACTERS = 32_000


@dataclass(frozen=True)
class EmbeddingResult:
    vectors: list[list[float]]
    model: str
    dimensions: int


class AIProviderError(RuntimeError):
    def __init__(self, code: str, message: str, retryable: bool = False):
        super().__init__(message)
        self.code = code
        self.retryable = retryable


class EmbeddingClient(Protocol):
    def embed(self, api_key: str, texts: Sequence[str], model: str, dimensions: int, timeout_seconds: float) -> Sequence[Sequence[float]]: ...


class OpenAISdkEmbeddingClient:
    def embed(self, api_key: str, texts: Sequence[str], model: str, dimensions: int, timeout_seconds: float) -> Sequence[Sequence[float]]:
        client = OpenAI(api_key=api_key, timeout=timeout_seconds, max_retries=0)
        response = client.embeddings.create(
            input=list(texts),
            model=model,
            dimensions=dimensions,
            encoding_format="float",
            timeout=timeout_seconds,
        )
        return [item.embedding for item in sorted(response.data, key=lambda item: item.index)]


class RequestAwareOpenAIProvider:
    def __init__(
        self,
        client: EmbeddingClient | None = None,
        credential_getter: Callable[[], str] = get_ai_credential,
        model: str | None = None,
        dimensions: int | None = None,
        timeout_seconds: float = 20.0,
    ):
        self.client = client or OpenAISdkEmbeddingClient()
        self.credential_getter = credential_getter
        self.model = model or os.getenv("OPENAI_EMBEDDING_MODEL", DEFAULT_EMBEDDING_MODEL)
        self.dimensions = dimensions or int(os.getenv("OPENAI_EMBEDDING_DIMENSIONS", str(DEFAULT_EMBEDDING_DIMENSIONS)))
        self.timeout_seconds = timeout_seconds

    def embed(self, texts: Sequence[str]) -> EmbeddingResult:
        normalized = list(texts)
        if not normalized or len(normalized) > MAX_EMBEDDING_BATCH:
            raise ValueError(f"Embedding batch must contain 1 to {MAX_EMBEDDING_BATCH} inputs")
        if any(not isinstance(text, str) or not text.strip() or len(text) > MAX_INPUT_CHARACTERS for text in normalized):
            raise ValueError(f"Embedding inputs must be non-empty strings up to {MAX_INPUT_CHARACTERS} characters")
        try:
            credential = self.credential_getter()
            vectors = [list(vector) for vector in self.client.embed(credential, normalized, self.model, self.dimensions, self.timeout_seconds)]
        except RuntimeError as error:
            if "credential" in str(error).lower():
                raise AIProviderError("credential_unavailable", "OpenAI credential is unavailable") from error
            raise
        except AuthenticationError as error:
            raise AIProviderError("authentication_failed", "OpenAI rejected the credential") from error
        except RateLimitError as error:
            raise AIProviderError("rate_limited", "OpenAI rate limit reached", retryable=True) from error
        except (APITimeoutError, APIConnectionError) as error:
            raise AIProviderError("unavailable", "OpenAI is unavailable", retryable=True) from error
        except APIStatusError as error:
            raise AIProviderError("upstream_failed", f"OpenAI request failed with status {error.status_code}", retryable=error.status_code >= 500) from error

        if len(vectors) != len(normalized):
            raise AIProviderError("invalid_response", "OpenAI returned the wrong number of embeddings")
        if any(len(vector) != self.dimensions or any(not math.isfinite(value) for value in vector) for vector in vectors):
            raise AIProviderError("invalid_response", "OpenAI returned an invalid embedding")
        return EmbeddingResult(vectors=vectors, model=self.model, dimensions=self.dimensions)

    def verify_credential(self) -> EmbeddingResult:
        return self.embed(["Mero MyOb credential verification"])
