import requests
from app.core.config import settings
from app.db.pinecone import vector_store

class RetrieverAgent:
    def __init__(self):
        self.index = vector_store.index

    def run(self, query: str, provider: str = None):
        print("Retriever Agent active...")
        query_vec = self._get_embeddings(query, provider=provider)
        
        # 1. Search Feedback Memory (namespace 'feedback_memory')
        try:
            feedback_results = self.index.query(
                vector=query_vec, top_k=1,
                include_metadata=True, namespace="feedback_memory"
            )
            memory_context = ""
            if feedback_results["matches"] and feedback_results["matches"][0]["score"] > 0.9:
                match = feedback_results["matches"][0]["metadata"]
                memory_context = f"\n[PAST SUCCESSFUL ANSWER]: {match.get('answer')}\n"
                print("Found high-confidence memory!")
        except Exception as e:
            print(f"Feedback memory search failed (non-critical): {e}")
            memory_context = ""

        # 2. Search Main Index
        results = self.index.query(vector=query_vec, top_k=8, include_metadata=True)
        
        context = memory_context + "\n\n".join(
            [m["metadata"].get("text", "") for m in results["matches"]]
        )
        sources = list(set([
            m["metadata"].get("source", "unknown") for m in results["matches"]
        ]))
        if memory_context:
            sources.insert(0, "Verified Feedback Memory")
        return context, sources

    def _get_embeddings(self, text: str, provider: str = None):
        selected_provider = provider or settings.LLM_PROVIDER
        if selected_provider in ["openai", "grok"]:
            url = "https://api.openai.com/v1/embeddings"
            headers = {"Authorization": f"Bearer {settings.OPENAI_API_KEY}"}
            payload = {"model": "text-embedding-3-small", "input": text}
            response = requests.post(url, headers=headers, json=payload, timeout=30)
            response.raise_for_status()
            return response.json()["data"][0]["embedding"]
        else:
            url = (
                f"https://generativelanguage.googleapis.com/v1beta/models/"
                f"text-embedding-004:embedContent?key={settings.GOOGLE_API_KEY}"
            )
            payload = {"model": "models/text-embedding-004", "content": {"parts": [{"text": text}]}}
            response = requests.post(url, json=payload, timeout=30)
            response.raise_for_status()
            data = response.json()
            # Gemini embedding response: data["embedding"]["values"]
            if "embedding" not in data:
                raise ValueError(f"Gemini embedding failed. Response: {data}")
            return data["embedding"]["values"]

retriever_agent = RetrieverAgent()
