import apiClient from './client';

export interface PurchaseRequest {
  productId: number;
  supplierName?: string;
  supplierPhone?: string;
  quantity: number;
  unitCost: number;
  purchaseDate?: string;
  note?: string;
}

export interface PurchaseResponse {
  id: number;
  quantity: number;
  unitCost: number;
  totalCost: number;
  note?: string;
  createdAt: string;
  product?: {
    id: number;
    name: string;
  };
  supplier?: {
    id: number;
    name: string;
    phone?: string;
  };
}

export const purchasesApi = {
  list: async (): Promise<PurchaseResponse[]> => {
    const response = await apiClient.get('/purchases');
    return response.data;
  },

  stockIn: async (request: PurchaseRequest): Promise<PurchaseResponse> => {
    const response = await apiClient.post('/purchases', request);
    return response.data;
  },
};

export default purchasesApi;
