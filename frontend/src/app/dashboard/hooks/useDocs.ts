"use client";

import { useState, useMemo } from "react";
import { api } from "@/lib/api";
import axios from "axios";

export const useDocs = () => {
  const [files, setFiles] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [scrapeUrl, setScrapeUrl] = useState("");
  const [isScraping, setIsScraping] = useState(false);

  const documentStats = useMemo(() => {
    const pdfs = files.filter((file) =>
      file.toLowerCase().endsWith(".pdf"),
    ).length;
    const tables = files.filter((file) =>
      /\.(csv|xlsx|xls)$/i.test(file),
    ).length;
    const websites = files.filter((file) => file.startsWith("http")).length;

    return { pdfs, tables, websites, total: files.length };
  }, [files]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    const formData = new FormData();
    formData.append("file", file);

    setIsUploading(true);
    try {
      await api.post("/api/v1/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setFiles((prev) => [...prev, file.name]);
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.data?.detail) {
        alert(`Upload Failed: ${error.response.data.detail}`);
      } else {
        alert("Failed to upload file. Check if backend is running.");
      }
    } finally {
      setIsUploading(false);
    }
  };

  const handleUrlScrape = async () => {
    const trimmedUrl = scrapeUrl.trim();
    if (!trimmedUrl) return;

    setIsScraping(true);
    try {
      await api.post("/api/v1/scrape", { url: trimmedUrl });
      setFiles((prev) => [...prev, trimmedUrl]);
      setScrapeUrl("");
      alert("Website successfully scraped and indexed.");
    } catch (error) {
      console.error("Scrape error:", error);
      const detail =
        axios.isAxiosError(error) && error.response?.data?.detail
          ? error.response.data.detail
          : "Failed to scrape website. Please check the URL and backend connection.";
      alert(`Scrape Failed: ${detail}`);
    } finally {
      setIsScraping(false);
    }
  };

  return {
    files,
    setFiles,
    isUploading,
    scrapeUrl,
    setScrapeUrl,
    isScraping,
    documentStats,
    handleFileUpload,
    handleUrlScrape,
  };
};
