export interface CompanyRow {
  company_name: string;
  website: string;
  status: 'auto' | 'needs_review';
  search_query: string;
}

export interface SearchConfig {
  extraKeywords: string;
  countryHint: string;
  searchTemplate: string;
}

export interface SearchResult {
  title: string;
  snippet: string;
  url: string;
}

export interface EnrichmentRequest {
  companies: string[];
  config: SearchConfig;
}

export interface EnrichmentResponse {
  company_name: string;
  website: string;
  status: 'auto' | 'needs_review';
  search_query: string;
}
