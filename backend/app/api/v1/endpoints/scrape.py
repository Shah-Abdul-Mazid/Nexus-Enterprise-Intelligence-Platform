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
    target_url = request.url.strip()
    if not target_url.startswith(("http://", "https://")):
        target_url = "https://" + target_url

    validate_safe_url(target_url)
    try:
        chunks_count = _perform_scrape(target_url)
        return {"status": "success", "url": target_url, "chunks": chunks_count}
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
    for raw_url in request.urls:
        url = raw_url.strip()
        if not url.startswith(("http://", "https://")):
            url = "https://" + url
        try:
            validate_safe_url(url)
            chunks = _perform_scrape(url)
            results.append({"url": url, "status": "processed", "chunks": chunks})
        except Exception as e:
            results.append({"url": url, "status": "error", "detail": str(e)})
    return {"results": results}

def _perform_scrape(url: str):
    import hashlib
    import re
    import urllib3
    print(f"Scraping {url}...")
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
    }

    try:
        response = requests.get(url, headers=headers, timeout=20)
    except requests.exceptions.SSLError:
        # Fallback for sites with missing intermediate SSL certificates
        urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
        response = requests.get(url, headers=headers, timeout=20, verify=False)
    except requests.exceptions.RequestException as e:
        raise HTTPException(status_code=400, detail=f"Failed to connect to website: {str(e)}")

    if response.status_code >= 400:
        raise HTTPException(
            status_code=400,
            detail=f"Website returned HTTP {response.status_code} ({response.reason}). Please verify the URL."
        )

    soup = BeautifulSoup(response.content, 'html.parser')
    for tag in soup(["script", "style", "nav", "footer", "header", "noscript", "svg", "iframe"]):
        tag.decompose()

    text = soup.get_text(separator=' ', strip=True)
    if not text.strip():
        # Fallback if aggressive decomposition removed everything
        soup = BeautifulSoup(response.content, 'html.parser')
        for tag in soup(["script", "style"]):
            tag.decompose()
        text = soup.get_text(separator=' ', strip=True)

    text = re.sub(r'\s+', ' ', text).strip()
    if not text:
        raise HTTPException(status_code=400, detail="Webpage contains no readable text content.")

    chunk_size = 800
    overlap = 150
    chunks = []
    start = 0
    while start < len(text):
        chunks.append(text[start:start + chunk_size])
        start += (chunk_size - overlap)
        if start >= len(text) - overlap and start < len(text):
            chunks.append(text[start:])
            break

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
