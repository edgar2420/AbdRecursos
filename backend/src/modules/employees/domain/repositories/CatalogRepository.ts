import { Paginated, PageQuery } from '../../../../shared/domain/pagination';

export interface CatalogItem {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  employeeCount?: number;
}

/** Catalogos de apoyo: departamentos y cargos. */
export interface CatalogRepository {
  listDepartments(query: PageQuery & { isActive?: boolean }): Promise<Paginated<CatalogItem>>;
  createDepartment(data: { name: string; description?: string | null }): Promise<CatalogItem>;
  updateDepartment(id: string, data: Partial<CatalogItem>): Promise<CatalogItem>;
  listPositions(query: PageQuery & { isActive?: boolean }): Promise<Paginated<CatalogItem>>;
  createPosition(data: { name: string; description?: string | null }): Promise<CatalogItem>;
  updatePosition(id: string, data: Partial<CatalogItem>): Promise<CatalogItem>;
  findDepartmentByName(name: string): Promise<CatalogItem | null>;
  findPositionByName(name: string): Promise<CatalogItem | null>;
}
