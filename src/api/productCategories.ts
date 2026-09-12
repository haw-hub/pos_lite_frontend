import apiClient from './client';

export interface ProductCategory {
  id: number;
  name: string;
  systemCategory: boolean;
}

export const productCategoriesApi = {
  list: async (): Promise<ProductCategory[]> => (await apiClient.get('/product-categories')).data,
  create: async (name: string): Promise<ProductCategory> => (await apiClient.post('/product-categories', { name })).data,
  update: async (id: number, name: string): Promise<ProductCategory> => (await apiClient.put(`/product-categories/${id}`, { name })).data,
  remove: async (id: number): Promise<void> => { await apiClient.delete(`/product-categories/${id}`); },
};
