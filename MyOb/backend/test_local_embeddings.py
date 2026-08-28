import unittest

from local_embeddings import LocalEmbeddingProvider


class FakeLocalClient:
    def __init__(self, documents=None, query=None):
        self.documents = documents or [[0.1, 0.2, 0.3]]
        self.query = query or [0.3, 0.2, 0.1]
        self.calls = []

    def embed_documents(self, texts):
        self.calls.append(("documents", list(texts)))
        return self.documents

    def embed_query(self, text):
        self.calls.append(("query", text))
        return self.query


class LocalEmbeddingTests(unittest.TestCase):
    def test_documents_and_queries_use_validated_local_vectors(self):
        client = FakeLocalClient()
        provider = LocalEmbeddingProvider(client=client, model_name="local-test", dimensions=3)
        self.assertEqual(provider.embed_documents(["note text"]), [[0.1, 0.2, 0.3]])
        self.assertEqual(provider.embed_query("search text"), [0.3, 0.2, 0.1])
        self.assertEqual(client.calls, [("documents", ["note text"]), ("query", "search text")])

    def test_empty_input_and_wrong_dimensions_fail_without_zero_vectors(self):
        provider = LocalEmbeddingProvider(client=FakeLocalClient(documents=[[0.0, 0.0]]), dimensions=3)
        with self.assertRaises(ValueError):
            provider.embed_documents([""])
        with self.assertRaisesRegex(RuntimeError, "invalid vector"):
            provider.embed_documents(["note"])


if __name__ == "__main__":
    unittest.main()
