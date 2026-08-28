import unittest

from openai_provider import AIProviderError, RequestAwareOpenAIProvider


class FakeEmbeddingClient:
    def __init__(self, vectors=None):
        self.vectors = vectors or [[0.1, 0.2, 0.3]]
        self.calls = []

    def embed(self, api_key, texts, model, dimensions, timeout_seconds):
        self.calls.append({"api_key": api_key, "texts": list(texts), "model": model, "dimensions": dimensions, "timeout": timeout_seconds})
        return self.vectors


class OpenAIProviderTests(unittest.TestCase):
    def test_request_credential_and_pinned_contract_reach_injected_client(self):
        client = FakeEmbeddingClient()
        provider = RequestAwareOpenAIProvider(
            client=client,
            credential_getter=lambda: "request-only-value",
            model="test-embedding-model",
            dimensions=3,
            timeout_seconds=4.5,
        )
        result = provider.embed(["first input"])
        self.assertEqual(result.vectors, [[0.1, 0.2, 0.3]])
        self.assertEqual(result.model, "test-embedding-model")
        self.assertEqual(result.dimensions, 3)
        self.assertEqual(client.calls, [{
            "api_key": "request-only-value",
            "texts": ["first input"],
            "model": "test-embedding-model",
            "dimensions": 3,
            "timeout": 4.5,
        }])

    def test_missing_credential_maps_to_typed_unavailable_error(self):
        provider = RequestAwareOpenAIProvider(client=FakeEmbeddingClient(), credential_getter=lambda: (_ for _ in ()).throw(RuntimeError("AI credential is unavailable")), dimensions=3)
        with self.assertRaises(AIProviderError) as raised:
            provider.embed(["input"])
        self.assertEqual(raised.exception.code, "credential_unavailable")
        self.assertFalse(raised.exception.retryable)

    def test_invalid_or_mixed_dimension_response_is_rejected(self):
        provider = RequestAwareOpenAIProvider(client=FakeEmbeddingClient([[0.1, 0.2]]), credential_getter=lambda: "value", dimensions=3)
        with self.assertRaises(AIProviderError) as raised:
            provider.embed(["input"])
        self.assertEqual(raised.exception.code, "invalid_response")

    def test_batch_and_input_bounds_are_enforced_before_client_call(self):
        client = FakeEmbeddingClient()
        provider = RequestAwareOpenAIProvider(client=client, credential_getter=lambda: "value", dimensions=3)
        with self.assertRaises(ValueError):
            provider.embed([])
        with self.assertRaises(ValueError):
            provider.embed([""])
        self.assertEqual(client.calls, [])


if __name__ == "__main__":
    unittest.main()
