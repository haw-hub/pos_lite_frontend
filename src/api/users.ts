import apiClient from './client';

export type EmployeeRole = 'MANAGER' | 'CASHIER';

export interface ShopUser {
  id: number;
  username: string;
  fullName: string;
  email?: string;
  phone?: string;
  role: 'ADMIN' | EmployeeRole;
  active: boolean;
}

export interface EmployeeRequest {
  username: string;
  password: string;
  fullName: string;
  role: EmployeeRole;
  email?: string;
  phone?: string;
}

export const usersApi = {
  getAll: async (): Promise<ShopUser[]> => (await apiClient.get('/users')).data,
  create: async (request: EmployeeRequest): Promise<ShopUser> =>
    (await apiClient.post('/users', request)).data,
  setActive: async (id: number, active: boolean): Promise<ShopUser> =>
    (await apiClient.put(`/users/${id}/active`, null, { params: { value: active } })).data,
};
