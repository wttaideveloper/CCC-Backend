export interface SearchResultItem {
  id: string;
  module: string;
  title: string;
  description?: string;
  highlightedFields?: string[];
  metadata?: Record<string, any>;
  createdAt?: Date;
  relevanceScore?: number;
  matchedFields?: string[];
}

export interface ModuleSearchResults {
  module: string;
  results: SearchResultItem[];
  total: number;
}

export interface SearchStats {
  totalResults: number;
  searchTime: number;
  moduleBreakdown: {
    [key: string]: number;
  };
}
