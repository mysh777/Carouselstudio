import { toast } from './toast';

type Resolvable<T> = PromiseLike<{ data: T | null; error: { message: string } | null }>;

export async function dbCall<T>(
  promise: Resolvable<T>,
  errorMsg: string
): Promise<T | null> {
  const { data, error } = await promise;
  if (error) {
    toast.error(`${errorMsg}: ${error.message}`);
    return null;
  }
  return data;
}
