export interface PageQuery {
  page: number;
  limit: number;
  search?: string;
  sort?: string;
  order?: 'asc' | 'desc';
}

export interface PageMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface Paginated<T> {
  data: T[];
  meta: PageMeta;
}

export const MAX_PAGE_SIZE = 100;
export const DEFAULT_PAGE_SIZE = 10;

export function buildMeta(total: number, page: number, limit: number): PageMeta {
  return { total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) };
}

export function paginate<T>(data: T[], total: number, page: number, limit: number): Paginated<T> {
  return { data, meta: buildMeta(total, page, limit) };
}
