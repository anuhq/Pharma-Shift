import { useContext } from 'react';
import { AuthContext } from './authStore';

export function useAuth() {
  return useContext(AuthContext);
}