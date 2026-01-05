import { SearchResultItem, SearchStats } from '../interfaces/search-result.interface';

export class SearchResponseDto {
  success: boolean;
  message: string;
  data: {
    results: Record<string, SearchResultItem[]>;
    total: number;
    page: number;
    limit: number;
    searchQuery: string;
    stats?: SearchStats;
  };
}
