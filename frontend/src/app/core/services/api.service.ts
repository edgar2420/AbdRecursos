import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Envelope, Paginated } from '../models/api.models';

export type QueryParams = Record<string, string | number | boolean | undefined | null>;

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  readonly baseUrl = environment.apiUrl;

  private toParams(query?: QueryParams): HttpParams {
    let params = new HttpParams();
    if (!query) return params;
    Object.entries(query).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') return;
      params = params.set(key, String(value));
    });
    return params;
  }

  list<T>(path: string, query?: QueryParams): Observable<Paginated<T>> {
    return this.http.get<Paginated<T>>(`${this.baseUrl}${path}`, { params: this.toParams(query) });
  }

  get<T>(path: string, query?: QueryParams): Observable<Envelope<T>> {
    return this.http.get<Envelope<T>>(`${this.baseUrl}${path}`, { params: this.toParams(query) });
  }

  post<T>(path: string, body?: unknown): Observable<Envelope<T>> {
    return this.http.post<Envelope<T>>(`${this.baseUrl}${path}`, body ?? {});
  }

  patch<T>(path: string, body: unknown): Observable<Envelope<T>> {
    return this.http.patch<Envelope<T>>(`${this.baseUrl}${path}`, body);
  }

  delete<T>(path: string, body?: unknown): Observable<T> {
    return this.http.request<T>('delete', `${this.baseUrl}${path}`, { body: body ?? {} });
  }

  download(path: string, query?: QueryParams): Observable<HttpResponseBlob> {
    return this.http.get(`${this.baseUrl}${path}`, {
      params: this.toParams(query),
      responseType: 'blob',
      observe: 'response',
    }) as unknown as Observable<HttpResponseBlob>;
  }

  upload<T>(path: string, form: FormData): Observable<Envelope<T>> {
    return this.http.post<Envelope<T>>(`${this.baseUrl}${path}`, form);
  }
}

export interface HttpResponseBlob {
  body: Blob | null;
  headers: { get(name: string): string | null };
}

export function saveBlob(response: HttpResponseBlob, fallbackName: string): void {
  const disposition = response.headers.get('content-disposition') ?? '';
  const match = /filename="?([^"]+)"?/.exec(disposition);
  const url = URL.createObjectURL(response.body as Blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = match ? match[1] : fallbackName;
  link.click();
  URL.revokeObjectURL(url);
}

export function previewBlob(response: HttpResponseBlob, ventana: Window | null): void {
  const url = URL.createObjectURL(response.body as Blob);
  if (ventana) {
    ventana.location.href = url;
  } else {
    window.open(url, '_blank');
  }
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
