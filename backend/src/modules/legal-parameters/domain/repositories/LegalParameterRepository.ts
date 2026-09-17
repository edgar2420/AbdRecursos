import { Paginated, PageQuery } from '../../../../shared/domain/pagination';
import { LegalParameter, NewLegalParameter } from '../entities/LegalParameter';

export interface LegalParameterRepository {
  findEffective(at: Date): Promise<LegalParameter[]>;
  findByKey(key: string): Promise<LegalParameter[]>;
  findById(id: string): Promise<LegalParameter | null>;
  list(query: PageQuery & { key?: string }): Promise<Paginated<LegalParameter>>;
  create(data: NewLegalParameter): Promise<LegalParameter>;
  update(id: string, data: Partial<NewLegalParameter>): Promise<LegalParameter>;
  closeValidity(key: string, until: Date): Promise<void>;
}
