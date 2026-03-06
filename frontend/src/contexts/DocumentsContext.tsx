/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import i18n from '../i18n/config';
import {
  BackendDocument,
  DocumentDetailResponse,
  DocumentTreeNodePayload,
  archiveDocument as archiveDocumentApi,
  buildIndex,
  IndexBuildResponse,
  deleteDocument as deleteDocumentApi,
  isApiError,
  listDocuments,
  restoreDocument as restoreDocumentApi,
  uploadDocument,
} from '../api/backend';

type DocumentType = 'pdf' | 'docx' | 'md' | 'txt' | 'image';

export type DocumentStatus =
  | 'RAW'
  | 'PARSED'
  | 'CHUNKED'
  | 'EMBEDDED'
  | 'INDEXED'
  | 'READY'
  | 'ERROR'
  | 'ARCHIVED';

export interface DocumentTreeNode {
  id: string;
  title: string;
  path: string;
  children?: DocumentTreeNode[];
}

export interface EvidenceItem {
  id: string;
  chunkId: string;
  score: number;
  path: string;
  sourceRank: number;
  conflict: boolean;
  redundant: boolean;
  nodeId: string;
  snippet: string;
}

export interface GraphNode {
  id: string;
  label: string;
  type: 'root' | 'section' | 'concept';
  score: number;
  path: string;
  x: number;
  y: number;
}

export interface GraphEdge {
  source: string;
  target: string;
  relation: string;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface DocumentItem {
  id: string;
  name: string;
  type: DocumentType;
  sizeLabel: string;
  status: DocumentStatus;
  archivePath?: string;
  updatedAt: string;
  version: string;
  pages: number;
  chunks: number;
  tags: string[];
  tree: DocumentTreeNode[];
  evidence: EvidenceItem[];
  graph: GraphData;
}

interface DocumentsContextType {
  documents: DocumentItem[];
  cacheAgeMs: number;
  cacheStale: boolean;
  addFiles: (files: File[]) => void;
  updateDocument: (id: string, updater: (doc: DocumentItem) => DocumentItem) => void;
  deleteDocument: (id: string) => void;
  archiveDocument: (id: string, archivePath?: string) => void;
  restoreDocument: (id: string) => void;
  triggerIndexBuild: () => Promise<IndexBuildResponse>;
  getDocumentById: (id: string) => DocumentItem | undefined;
}

const DocumentsContext = createContext<DocumentsContextType | undefined>(undefined);

const STORAGE_KEY = 'rag_documents_v2';
const CACHE_KEY = 'rag_documents_cache_ts_v2';
const CACHE_TTL_MS = 5 * 60 * 1000;

const STATUS_SET = new Set<DocumentStatus>([
  'RAW',
  'PARSED',
  'CHUNKED',
  'EMBEDDED',
  'INDEXED',
  'READY',
  'ERROR',
  'ARCHIVED',
]);

const nowDate = () => new Date().toISOString().slice(0, 10);

const flattenTree = (nodes: DocumentTreeNode[], depth = 0): Array<DocumentTreeNode & { depth: number }> => {
  const output: Array<DocumentTreeNode & { depth: number }> = [];
  nodes.forEach((node) => {
    output.push({ ...node, depth });
    if (node.children?.length) {
      output.push(...flattenTree(node.children, depth + 1));
    }
  });
  return output;
};

export const buildGraphFromTree = (tree: DocumentTreeNode[]): GraphData => {
  if (!tree.length) {
    return { nodes: [], edges: [] };
  }
  const flat = flattenTree(tree);
  const levels = flat.reduce<Record<number, Array<DocumentTreeNode & { depth: number }>>>((acc, node) => {
    acc[node.depth] = acc[node.depth] || [];
    acc[node.depth].push(node);
    return acc;
  }, {});

  const nodes: GraphNode[] = [];
  Object.entries(levels).forEach(([depthKey, levelNodes]) => {
    const depth = Number(depthKey);
    const radius = depth * 140;
    const count = levelNodes.length || 1;
    levelNodes.forEach((node, index) => {
      const angle = (index / count) * Math.PI * 2 - Math.PI / 2;
      const x = depth === 0 ? 0 : Math.cos(angle) * radius;
      const y = depth === 0 ? 0 : Math.sin(angle) * radius;
      nodes.push({
        id: node.id,
        label: node.title,
        type: depth === 0 ? 'root' : 'section',
        score: Math.max(0.45, 0.92 - depth * 0.1 - index * 0.02),
        path: node.path,
        x,
        y,
      });
    });
  });

  const edges: GraphEdge[] = [];
  const walk = (parent: DocumentTreeNode) => {
    parent.children?.forEach((child) => {
      edges.push({ source: parent.id, target: child.id, relation: 'contains' });
      walk(child);
    });
  };
  tree.forEach(walk);

  return { nodes, edges };
};

const normalizeFileType = (fileName: string, contentType?: string): DocumentType => {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.pdf') || contentType?.includes('pdf')) return 'pdf';
  if (lower.endsWith('.doc') || lower.endsWith('.docx') || contentType?.includes('wordprocessingml')) return 'docx';
  if (lower.endsWith('.md') || lower.endsWith('.markdown')) return 'md';
  if (lower.endsWith('.txt') || contentType?.includes('text')) return 'txt';
  if (contentType?.startsWith('image/')) return 'image';
  return 'txt';
};

const formatDateLabel = (value?: string) => {
  if (!value) return nowDate();
  return value.length >= 10 ? value.slice(0, 10) : value;
};

const formatSizeLabel = (meta?: Record<string, unknown>) => {
  const sizeBytes = typeof meta?.size_bytes === 'number'
    ? meta.size_bytes
    : typeof meta?.size === 'number'
      ? meta.size
      : undefined;
  if (typeof sizeBytes === 'number') {
    const kb = sizeBytes / 1024;
    if (kb < 1024) return `${Math.max(1, Math.round(kb))} KB`;
    return `${(kb / 1024).toFixed(1)} MB`;
  }
  if (typeof meta?.content_type === 'string' && meta.content_type) {
    return meta.content_type;
  }
  return i18n.t('common.empty');
};

const pickTags = (meta?: Record<string, unknown>) => {
  const tags = meta?.tags;
  if (Array.isArray(tags)) {
    return tags.filter((tag) => typeof tag === 'string') as string[];
  }
  return [];
};

const toDocumentStatus = (value?: string): DocumentStatus => {
  if (value && STATUS_SET.has(value as DocumentStatus)) {
    return value as DocumentStatus;
  }
  return 'RAW';
};

const mapTreeNode = (node: DocumentTreeNodePayload): DocumentTreeNode => ({
  id: node.id,
  title: node.title,
  path: node.path,
  children: node.children?.map(mapTreeNode),
});

const mapBackendDocument = (doc: BackendDocument, detail?: DocumentDetailResponse): DocumentItem => {
  const meta = doc.meta ?? {};
  const name = doc.title || doc.source || i18n.t('documents.untitled');
  const archivePath = typeof meta.archive_path === 'string' ? meta.archive_path : undefined;
  const pages = typeof meta.pages === 'number' ? meta.pages : detail?.sections ?? 0;
  const chunks = typeof meta.chunks === 'number' ? meta.chunks : detail?.chunks ?? 0;
  return {
    id: doc.doc_id,
    name,
    type: normalizeFileType(doc.source || doc.title || '', typeof meta.content_type === 'string' ? meta.content_type : undefined),
    sizeLabel: formatSizeLabel(meta),
    status: toDocumentStatus(doc.status),
    archivePath,
    updatedAt: formatDateLabel(doc.updated_at),
    version: typeof meta.version === 'string' ? meta.version : 'v1.0.0',
    pages,
    chunks,
    tags: pickTags(meta),
    tree: [],
    evidence: [],
    graph: { nodes: [], edges: [] },
  };
};

const mergeDocuments = (nextDocs: DocumentItem[], prevDocs: DocumentItem[]) => {
  const prevMap = new Map(prevDocs.map((doc) => [doc.id, doc]));
  return nextDocs.map((doc) => {
    const prev = prevMap.get(doc.id);
    if (!prev) return doc;
    return {
      ...doc,
      tree: prev.tree,
      evidence: prev.evidence,
      graph: prev.graph,
    };
  });
};

const mergeDocumentUpdate = (prevDocs: DocumentItem[], updated: BackendDocument) => {
  const next = mapBackendDocument(updated);
  return prevDocs.map((doc) => (doc.id === next.id
    ? { ...next, tree: doc.tree, evidence: doc.evidence, graph: doc.graph }
    : doc
  ));
};

const loadDocuments = (): { documents: DocumentItem[]; cacheTs: number } => {
  const cacheTs = Number(localStorage.getItem(CACHE_KEY)) || 0;
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) {
    return { documents: [], cacheTs };
  }
  try {
    return { documents: JSON.parse(stored) as DocumentItem[], cacheTs };
  } catch {
    return { documents: [], cacheTs: 0 };
  }
};

export const DocumentsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [{ documents, cacheTs }, setState] = useState(loadDocuments);

  const refreshDocuments = useCallback(async () => {
    try {
      const response = await listDocuments();
      const nextDocs = response.documents.map((doc) => mapBackendDocument(doc));
      setState((prev) => ({
        documents: mergeDocuments(nextDocs, prev.documents),
        cacheTs: Date.now(),
      }));
    } catch (error) {
      console.error('Failed to fetch documents', error);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(documents));
    localStorage.setItem(CACHE_KEY, String(cacheTs));
  }, [documents, cacheTs]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      await refreshDocuments();
    };
    if (active) {
      void load();
    }
    return () => {
      active = false;
    };
  }, [refreshDocuments]);

  const cacheAgeMs = Date.now() - cacheTs;
  const cacheStale = cacheAgeMs > CACHE_TTL_MS;

  const updateDocument = useCallback((id: string, updater: (doc: DocumentItem) => DocumentItem) => {
    setState((prev) => ({
      documents: prev.documents.map((doc) => (doc.id === id ? updater(doc) : doc)),
      cacheTs: Date.now(),
    }));
  }, []);

  const addFiles = useCallback((files: File[]) => {
    if (!files.length) return;
    void (async () => {
      for (const file of files) {
        try {
          const response = await uploadDocument(file, { title: file.name, source: file.name, asyncProcess: false });
          if ('document' in response) {
            setState((prev) => ({
              documents: mergeDocuments([mapBackendDocument(response.document, response)], prev.documents),
              cacheTs: Date.now(),
            }));
          }
        } catch (error) {
          console.error('Failed to upload document', error);
        }
      }
      await refreshDocuments();
    })();
  }, [refreshDocuments]);

  const deleteDocument = useCallback((id: string) => {
    void (async () => {
      try {
        await deleteDocumentApi(id);
        setState((prev) => ({
          documents: prev.documents.filter((doc) => doc.id !== id),
          cacheTs: Date.now(),
        }));
      } catch (error) {
        console.error('Failed to delete document', error);
      }
    })();
  }, []);

  const archiveDocument = useCallback((id: string, archivePath?: string) => {
    void (async () => {
      try {
        const response = await archiveDocumentApi(id, archivePath);
        setState((prev) => ({
          documents: mergeDocumentUpdate(prev.documents, response.document),
          cacheTs: Date.now(),
        }));
      } catch (error) {
        console.error('Failed to archive document', error);
        // Don't fake a successful archive when the backend call fails.
        if (isApiError(error)) return;
      }
    })();
  }, []);

  const restoreDocument = useCallback((id: string) => {
    void (async () => {
      try {
        const response = await restoreDocumentApi(id);
        setState((prev) => ({
          documents: mergeDocumentUpdate(prev.documents, response.document),
          cacheTs: Date.now(),
        }));
      } catch (error) {
        console.error('Failed to restore document', error);
      }
    })();
  }, []);

  const triggerIndexBuild = useCallback(async () => {
    const response = await buildIndex(false);
    await refreshDocuments();
    return response;
  }, [refreshDocuments]);

  const getDocumentById = useCallback(
    (id: string) => documents.find((doc) => doc.id === id),
    [documents]
  );

  const value = useMemo(() => ({
    documents,
    cacheAgeMs,
    cacheStale,
    addFiles,
    updateDocument,
    deleteDocument,
    archiveDocument,
    restoreDocument,
    triggerIndexBuild,
    getDocumentById,
  }), [documents, cacheAgeMs, cacheStale, addFiles, updateDocument, deleteDocument, archiveDocument, restoreDocument, triggerIndexBuild, getDocumentById]);

  return (
    <DocumentsContext.Provider value={value}>
      {children}
    </DocumentsContext.Provider>
  );
};

export const useDocuments = () => {
  const context = useContext(DocumentsContext);
  if (!context) {
    throw new Error('useDocuments must be used within a DocumentsProvider');
  }
  return context;
};

export const applyDocumentDetail = (doc: DocumentItem, detail: DocumentDetailResponse): DocumentItem => {
  const meta = detail.document.meta ?? {};
  const name = detail.document.title || detail.document.source || doc.name;
  const updatedAt = formatDateLabel(detail.document.updated_at) || doc.updatedAt;
  const archivePath = typeof meta.archive_path === 'string' ? meta.archive_path : doc.archivePath;
  const pages = typeof meta.pages === 'number' ? meta.pages : detail.sections ?? doc.pages;
  const chunks = typeof meta.chunks === 'number' ? meta.chunks : detail.chunks ?? doc.chunks;
  return {
    ...doc,
    name,
    status: toDocumentStatus(detail.document.status) || doc.status,
    archivePath,
    updatedAt,
    version: typeof meta.version === 'string' ? meta.version : doc.version,
    pages,
    chunks,
    tags: pickTags(meta).length ? pickTags(meta) : doc.tags,
    sizeLabel: formatSizeLabel(meta) || doc.sizeLabel,
    type: normalizeFileType(detail.document.source || detail.document.title || '', typeof meta.content_type === 'string' ? meta.content_type : undefined),
  };
};

export const applyDocumentTree = (doc: DocumentItem, treePayload: DocumentTreeNodePayload[]): DocumentItem => {
  const tree = treePayload.map(mapTreeNode);
  const graph = buildGraphFromTree(tree);
  return {
    ...doc,
    tree,
    graph,
  };
};

