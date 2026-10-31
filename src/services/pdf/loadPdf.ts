import { getDocument, InvalidPDFException, PasswordException } from "pdfjs-dist";
import type { PDFDocumentProxy } from "pdfjs-dist";
import "./pdfWorker";
import type { PdfDocumentSource } from "../../types/pdf";

type ProgressHandler = (progress: number | null) => void;

const PDF_SIGNATURE = "%PDF";

export async function loadPdfDocument(source: PdfDocumentSource): Promise<PDFDocumentProxy> {
  try {
    return await getDocument({ data: source.bytes.slice(0) }).promise;
  } catch (error) {
    if (error instanceof PasswordException) {
      throw new Error("This PDF is password protected. Password entry is not supported yet.");
    }

    if (error instanceof InvalidPDFException) {
      throw new Error("PDF.js could not read this file as a valid PDF document.");
    }

    throw error instanceof Error
      ? error
      : new Error("The PDF could not be opened because of an unknown parsing error.");
  }
}

export async function createPdfSourceFromFile(
  file: File,
  origin: "file" | "drop",
  onProgress: ProgressHandler
): Promise<PdfDocumentSource> {
  if (!isLikelyPdfFile(file)) {
    throw new Error("Choose a PDF file with a .pdf extension or an application/pdf MIME type.");
  }

  const bytes = await readFileAsArrayBuffer(file, onProgress);
  ensurePdfSignature(bytes);

  return {
    id: createDocumentId(),
    name: file.name || "Untitled PDF",
    bytes,
    origin
  };
}

export async function createPdfSourceFromUrl(
  rawUrl: string,
  onProgress: ProgressHandler
): Promise<PdfDocumentSource> {
  const url = parsePdfUrl(rawUrl);
  let response: Response;

  try {
    response = await fetch(url.href, {
      method: "GET",
      mode: "cors",
      credentials: "omit",
      cache: "no-store"
    });
  } catch (error) {
    throw new Error(
      "The PDF URL could not be fetched. The server may block CORS requests, require authentication, or be unreachable."
    );
  }

  if (response.status === 401 || response.status === 403) {
    throw new Error("This PDF URL requires authentication or permission from the server.");
  }

  if (!response.ok) {
    throw new Error(`The server returned HTTP ${response.status} while loading the PDF.`);
  }

  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  const bytes = await readResponseAsArrayBuffer(response, onProgress);
  const hasPdfSignature = startsWithPdfSignature(bytes);

  if (!hasPdfSignature) {
    if (contentType && !contentType.includes("pdf")) {
      throw new Error(`The URL returned ${contentType}, not a PDF document.`);
    }

    throw new Error("The URL response did not contain a valid PDF file signature.");
  }

  return {
    id: createDocumentId(),
    name: getNameFromUrl(url),
    bytes,
    origin: "url"
  };
}

function parsePdfUrl(rawUrl: string): URL {
  const value = rawUrl.trim();

  if (!value) {
    throw new Error("Enter a PDF URL before loading.");
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Enter a valid absolute URL, such as https://example.com/file.pdf.");
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("Only http and https PDF URLs are supported.");
  }

  return url;
}

function isLikelyPdfFile(file: File): boolean {
  return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
}

function readFileAsArrayBuffer(file: File, onProgress: ProgressHandler): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) {
        onProgress(event.loaded / event.total);
      } else {
        onProgress(null);
      }
    };

    reader.onerror = () => reject(new Error("The selected file could not be read."));
    reader.onload = () => {
      onProgress(1);
      resolve(reader.result as ArrayBuffer);
    };

    reader.readAsArrayBuffer(file);
  });
}

async function readResponseAsArrayBuffer(
  response: Response,
  onProgress: ProgressHandler
): Promise<ArrayBuffer> {
  const contentLength = Number(response.headers.get("content-length"));

  if (!response.body || !Number.isFinite(contentLength) || contentLength <= 0) {
    onProgress(null);
    const bytes = await response.arrayBuffer();
    onProgress(1);
    return bytes;
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;

  while (true) {
    const { done, value } = await reader.read();

    if (done) {
      break;
    }

    chunks.push(value);
    received += value.byteLength;
    onProgress(received / contentLength);
  }

  const merged = new Uint8Array(received);
  let offset = 0;

  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }

  onProgress(1);
  return merged.buffer;
}

function ensurePdfSignature(bytes: ArrayBuffer): void {
  if (!startsWithPdfSignature(bytes)) {
    throw new Error("The selected file is not a valid PDF document.");
  }
}

function startsWithPdfSignature(bytes: ArrayBuffer): boolean {
  const prefix = new TextDecoder("ascii").decode(bytes.slice(0, PDF_SIGNATURE.length));
  return prefix === PDF_SIGNATURE;
}

function getNameFromUrl(url: URL): string {
  const pathName = decodeURIComponent(url.pathname.split("/").filter(Boolean).pop() ?? "");
  return pathName || "Remote PDF";
}

function createDocumentId(): string {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
}
