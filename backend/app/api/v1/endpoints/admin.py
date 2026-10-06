import os
from fastapi import APIRouter, HTTPException, Depends
from app.db.pinecone import vector_store
from app.agents.retriever import retriever_agent
from app.utils.unstructured_loader import advanced_partition_file
from app.api.v1.endpoints.auth import get_current_user
from app.db.models import User

router = APIRouter()

@router.post("/ingest-local")
async def ingest_local_data(current_user: User = Depends(get_current_user)):
    """Triggers ingestion of all documents in the local data directory (Admin only)"""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin authorization required.")
    # Look for data directory relative to the project root
    data_dir = os.path.abspath(os.path.join(os.getcwd(), "..", "data"))
    if not os.path.exists(data_dir):
        data_dir = os.path.abspath(os.path.join(os.getcwd(), "data"))
        
    if not os.path.exists(data_dir):
        raise HTTPException(status_code=404, detail=f"Data directory not found at {data_dir}")

    results = []
    for filename in os.listdir(data_dir):
        file_path = os.path.join(data_dir, filename)
        if os.path.isfile(file_path):
            try:
                chunks = advanced_partition_file(file_path)
                vectors = []
                for i, chunk in enumerate(chunks):
                    vec = retriever_agent._get_embeddings(chunk)
                    vectors.append({
                        "id": f"static_{filename}_{i}",
                        "values": vec,
                        "metadata": {"text": chunk, "source": filename}
                    })
                
                if vectors:
                    vector_store.index.upsert(vectors=vectors)
                results.append({"filename": filename, "status": "success", "chunks": len(chunks)})
            except Exception as e:
                results.append({"filename": filename, "status": "error", "detail": str(e)})

    return {"status": "complete", "results": results}
