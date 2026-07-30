import { useMutation } from '@tanstack/react-query';
import { login } from './login';
import { signup } from './signup';

export function useLogin() {
  return useMutation({ mutationFn: login });
}

export function useSignup() {
  return useMutation({ mutationFn: signup });
}
