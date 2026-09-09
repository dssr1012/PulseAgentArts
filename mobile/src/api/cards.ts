// ============================================================
// PulseExpends - Cards API
// ============================================================

import apiClient from './client';
import type { CreditCard, CardType, StatementPreview, Currency } from '../types';

export interface CreateCardRequest {
  bank_name: string;
  card_type: CardType;
  last_4_digits: string;
}

/**
 * Register a new credit card
 */
export async function createCard(data: CreateCardRequest): Promise<CreditCard> {
  const response = await apiClient.post<CreditCard>('/cards', data);
  return response.data;
}

/**
 * List credit cards for the user's circle
 */
export async function listCards(): Promise<CreditCard[]> {
  const response = await apiClient.get<CreditCard[]>('/cards');
  return response.data;
}

/**
 * Delete a credit card
 */
export async function deleteCard(cardId: string): Promise<void> {
  await apiClient.delete(`/cards/${cardId}`);
}

/**
 * Upload a statement file for parsing
 */
export async function uploadStatement(
  cardId: string,
  fileUri: string,
  fileType: 'application/pdf' | 'text/plain',
  onProgress?: (progress: number) => void
): Promise<StatementPreview> {
  const formData = new FormData();
  const fileName = fileUri.split('/').pop() || 'statement';

  formData.append('file', {
    uri: fileUri,
    type: fileType,
    name: fileName,
  } as any);

  const response = await apiClient.post<StatementPreview>(
    `/cards/${cardId}/statements`,
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          const progress = progressEvent.loaded / progressEvent.total;
          onProgress(progress);
        }
      },
    }
  );
  return response.data;
}

/**
 * Confirm a parsed statement
 */
export async function confirmStatement(
  previewId: string,
  items?: StatementPreview['items']
): Promise<{ created_expense_ids: string[] }> {
  const response = await apiClient.post<{ created_expense_ids: string[] }>(
    `/statements/${previewId}/confirm`,
    items ? { items } : undefined
  );
  return response.data;
}