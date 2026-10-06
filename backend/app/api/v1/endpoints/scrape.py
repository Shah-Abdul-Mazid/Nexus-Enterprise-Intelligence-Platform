import ipaddress
import socket
from urllib.parse import urlparse
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.agents.retriever import retriever_agent
from app.db.pinecone import vector_store
import requests
from bs4 import BeautifulSoup
from app.api.v1.endpoints.auth import get_current_user
from fastapi import Depends
from app.db.models import User

router = APIRouter()

def validate_safe_url(url: str):
    """Prevents SSRF attacks against internal network and cloud metadata services."""
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https"):
        raise HTTPException(status_code=400, detail="Only HTTP and HTTPS URLs are allowed.")
    hostname = parsed.hostname
    if not hostname:
        raise HTTPException(status_code=400, detail="Invalid target URL host.")
    if hostname.lower() in ("localhost", "127.0.0.1", "0.0.0.0", "169.254.169.254"):
        raise HTTPException(status_code=400, detail="Access to local or metadata services is blocked.")
    try:
        ip = socket.gethostbyname(hostname)
        ip_obj = ipaddress.ip_address(ip)
        if ip_obj.is_private or ip_obj.is_loopback or ip_obj.is_link_local:
            raise HTTPException(status_code=400, detail="Target IP resolves to a private or restricted network.")
    except socket.gaierror:
        raise HTTPException(status_code=400, detail="Failed to resolve host.")

class ScrapeRequest(BaseModel):
    url: str

class BulkScrapeRequest(BaseModel):
    urls: list[str]

@router.post("/scrape")
async def scrape_website(
    request: ScrapeRequest,
    current_user: User = Depends(get_current_user)
):
    validate_safe_url(request.url)
    try:
        return _perform_scrape(request.url)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/bulk-scrape")
async def bulk_scrape_websites(
    request: BulkScrapeRequest,
    current_user: User = Depends(get_current_user)
):
    """Handles multiple URLs in a single request (Batch Logic)"""
    results = []
    for url in request.urls:
        try:
            validate_safe_url(url)
            chunks = _perform_scrape(url)
            results.append({"url": url, "status": "processed", "chunks": chunks})
        except Exception as e:
            results.append({"url": url, "status": "error", "detail": str(e)})
    return {"results": results}

def _perform_scrape(url: str):
    import hashlib
    print(f"Scraping {url}...")
    headers = {'User-Agent': 'Mozilla/5.0'}
    response = requests.get(url, headers=headers, timeout=15)
    
    soup = BeautifulSoup(response.content, 'html.parser')
    for script in soup(["script", "style"]):
        script.decompose()
    
    text = soup.get_text(separator=' ', strip=True)
    chunks = [text[i:i+1000] for i in range(0, len(text), 800)]
    
    vectors = []
    for i, chunk in enumerate(chunks):
        unique_id = hashlib.md5(f"{url}_{i}".encode()).hexdigest()
        vec = retriever_agent._get_embeddings(chunk)
        vectors.append({
            "id": f"web_{unique_id}",
            "values": vec,
            "metadata": {"text": chunk, "source": url}
        })
    
    if vectors:
        vector_store.index.upsert(vectors=vectors)
    return len(chunks)
