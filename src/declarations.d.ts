declare module 'bestzip' {
  export type BestZipOptions = {
    source: string;
    destination: string;
    cwd: string;
  };

  export function bestzip(options: BestZipOptions): Promise<void>;
}
