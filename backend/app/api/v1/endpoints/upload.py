import os

import pandas as pd
from app.agents.retriever import retriever_agent
from app.api.v1.endpoints.auth import get_current_user
from app.core.config import settings
from app.db.models import User
from app.db.pinecone import vector_store
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile

router = APIRouter()


def table_to_records(file_path: str, filename: str):
    records = []
    filename_lower = filename.lower()

    if filename_lower.endswith(".csv"):
        sheets = {"CSV": pd.read_csv(file_path)}
    else:
        sheets = pd.read_excel(file_path, sheet_name=None)

    for sheet_name, df in sheets.items():
        df = df.fillna("")
        df.columns = [str(col).strip() for col in df.columns]

        for idx, row in df.iterrows():
            row_data = {
                col: str(row[col]).strip()
                for col in df.columns
                if str(row[col]).strip()
            }

            if not row_data:
                continue

            text = (
                f"Source: {filename}\n"
                f"Sheet/Category: {sheet_name}\n"
                f"Row: {idx + 2}\n"
                + "\n".join([f"{k}: {v}" for k, v in row_data.items()])
            )

            metadata = {
                "text": text,
                "source": filename,
                "sheet": sheet_name,
                "row": idx + 2,
            }

            for key, value in row_data.items():
                metadata[key[:40]] = value[:500]

            records.append({"text": text, "metadata": metadata})

    return records


@router.post("/upload")
async def upload_document(
    file: UploadFile = File(...), current_user: User = Depends(get_current_user)
):
    # Sanitize filename to prevent path traversal
    safe_filename = os.path.basename(file.filename or "upload.bin")
    ext = os.path.splitext(safe_filename)[1].lower()
    allowed_extensions = {".pdf", ".docx", ".doc", ".txt", ".csv", ".xlsx", ".xls"}
    if ext not in allowed_extensions:
        raise HTTPException(
            status_code=400, detail=f"File extension '{ext}' is not permitted."
        )

    os.makedirs(settings.UPLOADS_DIR, exist_ok=True)
    file_path = os.path.join(settings.UPLOADS_DIR, safe_filename)

    try:
        with open(file_path, "wb") as f:
            f.write(await file.read())

        filename_lower = safe_filename.lower()

        try:
            vector_store.index.delete(filter={"source": {"$eq": safe_filename}})
        except Exception:
            pass

        vectors = []

        if filename_lower.endswith((".xlsx", ".xls", ".csv")):
            records = table_to_records(file_path, safe_filename)

            for i, record in enumerate(records):
                vec = retriever_agent._get_embeddings(record["text"])
                vectors.append(
                    {
                        "id": f"table_{safe_filename}_{i}",
                        "values": vec,
                        "metadata": record["metadata"],
                    }
                )

        else:
            from app.utils.unstructured_loader import advanced_partition_file

            chunks = advanced_partition_file(file_path)

            import hashlib

            for i, chunk in enumerate(chunks):
                vec = retriever_agent._get_embeddings(chunk)
                # Generate a safe, short hash for the ID
                file_hash = hashlib.md5(safe_filename.encode()).hexdigest()[:10]
                vectors.append(
                    {
                        "id": f"doc_{file_hash}_{i}",
                        "values": vec,
                        "metadata": {
                            "text": chunk,
                            "source": safe_filename,
                            "chunk": i,
                        },
                    }
                )

        if vectors:
            vector_store.index.upsert(vectors=vectors)

        return {
            "filename": safe_filename,
            "status": "indexed",
            "chunks": len(vectors),
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if os.path.exists(file_path):
            os.remove(file_path)
