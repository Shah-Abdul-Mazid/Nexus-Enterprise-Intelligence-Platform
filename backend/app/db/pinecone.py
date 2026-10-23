import logging
from pinecone import Pinecone, ServerlessSpec
from app.core.config import settings

logger = logging.getLogger("nexus.pinecone")

class VectorStore:
    def __init__(self):
        self._pc = None
        self._index = None
        self.index_name = settings.PINECONE_INDEX_NAME
        self.required_dim = 1536 if settings.LLM_PROVIDER == "openai" else 768

    @property
    def index(self):
        """
        Lazily initialize the Pinecone connection and index when first accessed,
        preventing server startup crashes and import-time network hangs.
        """
        if self._index is not None:
            return self._index
        if not settings.PINECONE_API_KEY:
            logger.warning("[Pinecone] PINECONE_API_KEY is not configured.")
            return None
        try:
            self._pc = Pinecone(api_key=settings.PINECONE_API_KEY)
            existing_indexes = [idx.name for idx in self._pc.list_indexes()]
            if self.index_name in existing_indexes:
                index_desc = self._pc.describe_index(self.index_name)
                if index_desc.dimension != self.required_dim:
                    self._pc.delete_index(self.index_name)
                    existing_indexes.remove(self.index_name)
            
            if self.index_name not in existing_indexes:
                self._pc.create_index(
                    name=self.index_name,
                    dimension=self.required_dim,
                    metric="cosine",
                    spec=ServerlessSpec(cloud="aws", region="us-east-1")
                )
            self._index = self._pc.Index(self.index_name)
            return self._index
        except Exception as e:
            logger.warning(f"[Pinecone] Failed to connect to index (non-fatal): {e}")
            return None

vector_store = VectorStore()
