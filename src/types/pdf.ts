import type { PDFDocumentProxy } from "pdfjs-dist";

export type PdfDocumentSource = {
  id: string;
  name: string;
  bytes: ArrayBuffer;
  origin: "file" | "drop" | "url";
};

export type PdfLoadState =
  | { status: "empty" }
  | { status: "loading"; label: string; progress: number | null }
  | {
      status: "ready";
      document: PDFDocumentProxy;
      source: PdfDocumentSource;
      pageCount: number;
    }
  | { status: "error"; title: string; message: string };
