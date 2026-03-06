import i18n from 'i18next';

export class ApiError extends Error {
  status: number;
  payload?: unknown;

  constructor(status: number, message: string, payload?: unknown) {
    super(message);
    this.status = status;
    this.payload = payload;
  }
}

export const isApiError = (error: unknown): error is ApiError =>
  error instanceof ApiError;

const API_BASE_URL = (import.meta as { env?: Record<string, string> }).env?.VITE_API_BASE_URL ?? '';

const buildUrl = (path: string) => {
  if (!API_BASE_URL) return path;
  if (API_BASE_URL.endsWith('/') && path.startsWith('/')) {
    return `${API_BASE_URL.slice(0, -1)}${path}`;
  }
  if (!API_BASE_URL.endsWith('/') && !path.startsWith('/')) {
    return `${API_BASE_URL}/${path}`;
  }
  return `${API_BASE_URL}${path}`;
};

const isFormData = (body: BodyInit | null | undefined): body is FormData =>
  typeof FormData !== 'undefined' && body instanceof FormData;

const requestJson = async <T>(path: string, options: RequestInit = {}): Promise<T> => {
  const headers = new Headers(options.headers || {});
  if (options.body && !isFormData(options.body) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(buildUrl(path), { ...options, headers });
  const contentType = response.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json');
  const payload = isJson ? await response.json() : undefined;

  if (!response.ok) {
    const detail = typeof payload?.detail === 'string' ? payload.detail : response.statusText;
    const localizedFallback = i18n.t('common.requestFailed');
    const fallbackMessage = localizedFallback === 'common.requestFailed' ? 'Request failed' : localizedFallback;
    throw new ApiError(response.status, detail || fallbackMessage, payload);
  }

  return payload as T;
};

export interface BackendDocument {
  doc_id: string;
  title?: string;
  source?: string;
  status?: string;
  meta?: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
}

export interface DocumentListResponse {
  documents: BackendDocument[];
}

export interface DocumentDetailResponse {
  document: BackendDocument;
  sections?: number;
  paragraphs?: number;
  chunks?: number;
}

export interface DocumentTreeNodePayload {
  id: string;
  title: string;
  path: string;
  level?: number;
  children?: DocumentTreeNodePayload[];
}

export interface DocumentTreeResponse {
  doc_id: string;
  tree: DocumentTreeNodePayload[];
}

export type UploadDocumentResponse =
  | { doc_id: string; status: string; task_id?: string }
  | DocumentDetailResponse;

export interface IndexMeta {
  index_id: string;
  version: number;
  status: string;
  build_time: string;
  doc_count: number;
  bm25_path?: string;
  vector_path?: string;
  corpus_path?: string;
  started_at?: string;
  finished_at?: string;
  duration_ms?: number;
}

export interface IndexBuildResponse {
  task_id?: string;
  index?: IndexMeta;
}

export interface IndexStatusResponse {
  index: IndexMeta | null;
}

export interface IndexHistoryResponse {
  history: IndexMeta[];
}

export interface QAResponse {
  answer_id?: string;
  answer?: string;
  reasoning_content?: string;
  thought_steps?: string[];
  evidence?: BackendEvidence[];
  citations?: Array<{ chunk_id?: string; doc_id?: string; path?: string; score?: number }>;
  graph?: BackendGraph;
  verify_status?: string;
  verify_detail?: { status?: string; overlap?: number };
  fallback_reason?: string;
  coarse_sections?: BackendCoarseSection[];
}

export interface QAHistoryTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface BackendEvidence {
  chunk_id?: string;
  doc_id?: string;
  section_id?: string;
  path?: string;
  text?: string;
  snippet?: string;
  order?: number;
  score?: number;
  redundant_flag?: boolean;
  conflict_flag?: boolean;
  confidence?: number;
}

export interface BackendGraphNode {
  id: string;
  label?: string;
  type?: string;
  score?: number;
  doc_id?: string;
  section_id?: string;
  metadata?: Record<string, unknown>;
}

export interface BackendGraphEdge {
  id?: string;
  source: string;
  target: string;
}

export interface BackendGraph {
  nodes: BackendGraphNode[];
  edges: BackendGraphEdge[];
}

export interface BackendCoarseSection {
  section_id?: string;
  doc_id?: string;
  path?: string;
  score?: number;
  chunk_id?: string;
}

export interface FeedbackResponse {
  feedback: Record<string, unknown>;
}

export interface HealthResponse {
  status: string;
  version?: string;
  time?: string;
  uptime_seconds?: number;
}

export interface ReadyResponse {
  ready: boolean;
  errors?: string[];
  version?: string;
  index_status?: IndexMeta | null;
}

export interface LLMConfig {
  base_url: string;
  model_id: string;
  mode: string;
  enable_web_search?: boolean;
  enable_thinking?: boolean;
  updated_at?: string;
}

export interface LLMConfigResponse {
  config: LLMConfig;
}

export interface LLMTestResponse {
  status: string;
  mode?: string;
  latency_ms?: number;
  detail?: string;
  sample?: string;
}

export interface LLMModelsResponse {
  models: Array<Record<string, unknown>>;
}

export interface TaskInfo {
  task_id: string;
  status: string;
  created_at?: string;
  started_at?: string | null;
  finished_at?: string | null;
  attempts?: number;
  max_retries?: number;
  timeout_seconds?: number;
  error?: string | null;
  result?: unknown;
}

export interface TaskListResponse {
  tasks: Record<string, TaskInfo>;
}

export interface TaskResponse {
  task: TaskInfo;
}

export interface EvalDocumentInput {
  filename: string;
  content: string;
  title?: string;
  source?: string;
  meta?: Record<string, unknown>;
}

export interface EvalSampleInput {
  sample_id?: string;
  query: string;
  expected_evidence?: string[];
  top_k?: number;
  rerank_k?: number;
  max_evidence?: number;
}

export interface EvalRunRequest {
  documents: EvalDocumentInput[];
  samples: EvalSampleInput[];
  defaults?: Record<string, unknown>;
}

export interface EvalSampleReport {
  sample_id: string;
  query: string;
  top_k: number;
  rerank_k: number;
  recall: number;
  mrr: number;
  ndcg: number;
  evidence_coverage: number;
  latency_ms: number;
  expected_evidence_count: number;
  matched_evidence_count: number;
}

export interface EvalReportSummary {
  sample_count: number;
  avg_recall: number;
  avg_mrr: number;
  avg_ndcg: number;
  avg_evidence_coverage: number;
  avg_latency_ms: number;
  p95_latency_ms: number;
  warnings?: string[];
  index?: IndexMeta;
}

export interface EvalRunResponse {
  report_id: string;
  summary: EvalReportSummary;
}

export interface EvalReportResponse {
  summary?: EvalReportSummary;
  samples?: EvalSampleReport[];
}

export interface EvalReportListEntry {
  report_id: string;
  created_at?: string;
  sample_count?: number;
  avg_recall?: number;
  avg_mrr?: number;
  avg_ndcg?: number;
  avg_evidence_coverage?: number;
  avg_latency_ms?: number;
  p95_latency_ms?: number;
}

export interface EvalReportListResponse {
  reports: EvalReportListEntry[];
}

export interface AnswerGraphResponse {
  answer_id: string;
  graph: BackendGraph;
}

export interface AnswerEvidenceResponse {
  answer_id: string;
  evidence: BackendEvidence[];
}

export interface DocumentUpdateResponse {
  document: BackendDocument;
}

export const listDocuments = () => requestJson<DocumentListResponse>('/api/documents');

export const uploadDocument = (file: File, options?: { title?: string; source?: string; asyncProcess?: boolean }) => {
  const form = new FormData();
  form.append('file', file);
  if (options?.title) form.append('title', options.title);
  if (options?.source) form.append('source', options.source);
  form.append('async_process', String(Boolean(options?.asyncProcess)));
  return requestJson<UploadDocumentResponse>('/api/documents/upload', {
    method: 'POST',
    body: form,
  });
};

export const getDocumentDetail = (docId: string) =>
  requestJson<DocumentDetailResponse>(`/api/documents/${docId}`);

export const getDocumentTree = (docId: string) =>
  requestJson<DocumentTreeResponse>(`/api/documents/${docId}/tree`);

export const deleteDocument = (docId: string) =>
  requestJson<{ doc_id: string; deleted: boolean }>(`/api/documents/${docId}`, {
    method: 'DELETE',
  });

export const archiveDocument = (docId: string, archivePath?: string) =>
  requestJson<DocumentUpdateResponse>(`/api/documents/${docId}/archive`, {
    method: 'POST',
    body: archivePath !== undefined ? JSON.stringify({ archive_path: archivePath }) : undefined,
  });

export const restoreDocument = (docId: string) =>
  requestJson<DocumentUpdateResponse>(`/api/documents/${docId}/restore`, {
    method: 'POST',
  });

export const buildIndex = (asyncProcess = false) =>
  requestJson<IndexBuildResponse>('/api/index/build', {
    method: 'POST',
    body: JSON.stringify({ async_process: asyncProcess }),
  });

export const getIndexStatus = () => requestJson<IndexStatusResponse>('/api/index/status');

export const getIndexHistory = () => requestJson<IndexHistoryResponse>('/api/index/history');

export const queryQA = (payload: {
  query: string;
  top_k?: number;
  rerank_k?: number;
  max_evidence?: number;
  history?: QAHistoryTurn[];
}) =>
  requestJson<QAResponse>('/api/qa/query', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

export const submitFeedback = (payload: {
  node_id: string;
  score: number;
  comment?: string;
  doc_id?: string;
  uncertain?: boolean;
  conflict?: boolean;
  evidence_ids?: string[];
}) =>
  requestJson<FeedbackResponse>('/api/feedback', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

export const getHealth = () => requestJson<HealthResponse>('/health');

export const getReady = () => requestJson<ReadyResponse>('/ready');

export const getTasks = () => requestJson<TaskListResponse>('/api/tasks');

export const getTask = (taskId: string) =>
  requestJson<TaskResponse>(`/api/tasks/${taskId}`);

export const getLLMConfig = () => requestJson<LLMConfigResponse>('/api/llm/config');

export const updateLLMConfig = (payload: {
  base_url?: string;
  model_id?: string;
  mode?: string;
  enable_web_search?: boolean;
  enable_thinking?: boolean;
  api_key?: string;
}) =>
  requestJson<LLMConfigResponse>('/api/llm/config', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

export const testLLMConnection = () =>
  requestJson<LLMTestResponse>('/api/llm/test', { method: 'POST' });

export const getLLMModels = () => requestJson<LLMModelsResponse>('/api/llm/models');

export const runEvaluation = (payload: EvalRunRequest) =>
  requestJson<EvalRunResponse>('/api/eval/run', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

export const getEvaluationReport = (reportId: string) =>
  requestJson<EvalReportResponse>(`/api/eval/report/${reportId}`);

export const listEvaluationReports = () =>
  requestJson<EvalReportListResponse>('/api/eval/reports');

export const getAnswerGraph = (answerId: string) =>
  requestJson<AnswerGraphResponse>(`/api/answers/${answerId}/graph`);

export const getAnswerEvidence = (answerId: string) =>
  requestJson<AnswerEvidenceResponse>(`/api/answers/${answerId}/evidence`);

export const getModelWeights = () =>
  requestJson<{ weights: Record<string, Record<string, number>> }>('/api/qa/weights');

export const updateModelWeights = (payload: {
  retrieval?: Record<string, number>;
  evidence?: Record<string, number>;
}) =>
  requestJson<{ weights: Record<string, Record<string, number>> }>('/api/qa/weights', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
