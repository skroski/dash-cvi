declare namespace Deno {
  export interface Env {
    get(key: string): string | undefined;
  }
  export const env: Env;
  export function serve(handler: (req: Request) => Promise<Response> | Response): void;
}

declare module "https://*" {
  const content: any;
  export default content;
  export const connect: any;
  export const createClient: any;
}
