import type {
  DocumentRecord,
  HistoryEntry as PersistedHistoryEntry,
  PdfAnnotation
} from "../../types/annotation.ts";

const DB_NAME = "venma-annotations";
const DB_VERSION = 1;

export const DOCUMENTS_STORE = "documents";
export const ANNOTATIONS_STORE = "annotations";
export const HISTORY_STORE = "annotationHistory";

export type HistoryEntry = PersistedHistoryEntry;

export type StoredDocumentRecord = {
  fingerprint: string;
  fileName: string;
  pageCount: number;
  createdAt: number;
  updatedAt: number;
};

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains(DOCUMENTS_STORE)) {
        db.createObjectStore(DOCUMENTS_STORE, { keyPath: "fingerprint" });
      }

      if (!db.objectStoreNames.contains(ANNOTATIONS_STORE)) {
        const annotations = db.createObjectStore(ANNOTATIONS_STORE, { keyPath: "id" });
        annotations.createIndex("by-document", "documentFingerprint", { unique: false });
      }

      if (!db.objectStoreNames.contains(HISTORY_STORE)) {
        const history = db.createObjectStore(HISTORY_STORE, { keyPath: "id" });
        history.createIndex("by-document", "fingerprint", { unique: false });
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      reject(request.error ?? new Error("Failed to open the annotation database"));
    };
  });
}

function toPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => {
      resolve(request.result);
    };
    request.onerror = () => {
      reject(request.error ?? new Error("IndexedDB request failed"));
    };
  });
}

async function withStore<T>(
  storeName: string,
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => Promise<T>
): Promise<T> {
  const db = await openDatabase();
  const transaction = db.transaction(storeName, mode);
  const store = transaction.objectStore(storeName);

  try {
    const result = await operation(store);
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => {
        resolve();
      };
      transaction.onerror = () => {
        reject(transaction.error ?? new Error("IndexedDB transaction failed"));
      };
      transaction.onabort = () => {
        reject(transaction.error ?? new Error("IndexedDB transaction aborted"));
      };
    });
    return result;
  } finally {
    db.close();
  }
}

export class AnnotationStore {
  async upsertDocument(record: DocumentRecord): Promise<void> {
    await withStore(DOCUMENTS_STORE, "readwrite", (store) =>
      toPromise(store.put(record))
    );
  }

  async getDocument(fingerprint: string): Promise<DocumentRecord | null> {
    const result = await withStore(DOCUMENTS_STORE, "readonly", (store) =>
      toPromise(store.get(fingerprint) as IDBRequest<StoredDocumentRecord | undefined>)
    );

    return result ?? null;
  }

  async getAnnotations(fingerprint: string): Promise<PdfAnnotation[]> {
    const all = await withStore(ANNOTATIONS_STORE, "readonly", (store) =>
      toPromise(store.getAll() as IDBRequest<PdfAnnotation[]>)
    );

    return all
      .filter((annotation) => annotation.documentFingerprint === fingerprint)
      .sort((a, b) => a.createdAt - b.createdAt);
  }

  /** Replace the whole annotation set for a document in one transaction. */
  async replaceAnnotationsForDocument(
    fingerprint: string,
    annotations: PdfAnnotation[]
  ): Promise<void> {
    const existing = await this.getAnnotations(fingerprint);
    const keepIds = new Set(annotations.map((annotation) => annotation.id));
    const removed = existing.filter((annotation) => !keepIds.has(annotation.id));

    await withStore(ANNOTATIONS_STORE, "readwrite", (store) => {
      for (const annotation of removed) {
        store.delete(annotation.id);
      }
      for (const annotation of annotations) {
        store.put(annotation);
      }
      return Promise.resolve();
    });
  }

  async saveAnnotation(annotation: PdfAnnotation): Promise<void> {
    await withStore(ANNOTATIONS_STORE, "readwrite", (store) =>
      toPromise(store.put(annotation))
    );
  }

  async saveAnnotations(annotations: PdfAnnotation[]): Promise<void> {
    if (annotations.length === 0) {
      return;
    }

    await withStore(ANNOTATIONS_STORE, "readwrite", (store) => {
      for (const annotation of annotations) {
        store.put(annotation);
      }
      return Promise.resolve();
    });
  }

  async deleteAnnotation(id: string): Promise<void> {
    await withStore(ANNOTATIONS_STORE, "readwrite", (store) =>
      toPromise(store.delete(id))
    );
  }

  async deleteAnnotations(ids: string[]): Promise<void> {
    if (ids.length === 0) {
      return;
    }

    await withStore(ANNOTATIONS_STORE, "readwrite", (store) => {
      for (const id of ids) {
        store.delete(id);
      }
      return Promise.resolve();
    });
  }

  async appendHistory(entry: HistoryEntry): Promise<void> {
    await withStore(HISTORY_STORE, "readwrite", (store) =>
      toPromise(store.put(entry))
    );
  }

  async getHistory(fingerprint: string): Promise<HistoryEntry[]> {
    const all = await withStore(HISTORY_STORE, "readonly", (store) =>
      toPromise(store.getAll() as IDBRequest<HistoryEntry[]>)
    );

    return all
      .filter((entry) => entry.fingerprint === fingerprint)
      .sort((a, b) => a.createdAt - b.createdAt);
  }

  /** Replace the persisted undo history for a document (applied prefix only). */
  async replaceHistoryForDocument(
    fingerprint: string,
    entries: HistoryEntry[]
  ): Promise<void> {
    const existing = await this.getHistory(fingerprint);
    const keepIds = new Set(entries.map((entry) => entry.id));
    const removed = existing.filter((entry) => !keepIds.has(entry.id));

    await withStore(HISTORY_STORE, "readwrite", (store) => {
      for (const entry of removed) {
        store.delete(entry.id);
      }
      for (const entry of entries) {
        store.put(entry);
      }
      return Promise.resolve();
    });
  }

  async deleteHistoryFrom(id: string, fingerprint: string): Promise<void> {
    const entries = await this.getHistory(fingerprint);
    const cutoff = entries.findIndex((entry) => entry.id === id);

    if (cutoff === -1) {
      return;
    }

    const doomed = entries.slice(cutoff);

    await withStore(HISTORY_STORE, "readwrite", (store) => {
      for (const entry of doomed) {
        store.delete(entry.id);
      }
      return Promise.resolve();
    });
  }

  async clearHistory(fingerprint: string): Promise<void> {
    const entries = await this.getHistory(fingerprint);

    await withStore(HISTORY_STORE, "readwrite", (store) => {
      for (const entry of entries) {
        store.delete(entry.id);
      }
      return Promise.resolve();
    });
  }

  async clearAll(): Promise<void> {
    await withStore(DOCUMENTS_STORE, "readwrite", (store) =>
      toPromise(store.clear())
    );
    await withStore(ANNOTATIONS_STORE, "readwrite", (store) =>
      toPromise(store.clear())
    );
    await withStore(HISTORY_STORE, "readwrite", (store) =>
      toPromise(store.clear())
    );
  }
}
