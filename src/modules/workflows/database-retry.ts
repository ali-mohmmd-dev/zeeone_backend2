export async function withPrismaRetry<T>(operation: () => Promise<T>, retries = 2, delayMs = 400): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await operation();
    } catch (error) {
      const code = (error as { code?: string }).code;
      if (attempt >= retries || !['P1001', 'P1002', 'P1017'].includes(code || '')) throw error;
      await new Promise(resolve => setTimeout(resolve, delayMs * (attempt + 1)));
    }
  }
}
