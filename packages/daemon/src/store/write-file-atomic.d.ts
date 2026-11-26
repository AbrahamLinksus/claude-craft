declare module "write-file-atomic" {
  interface WriteFileAtomicOptions {
    mode?: number;
    encoding?: BufferEncoding;
    fsync?: boolean;
  }
  function writeFileAtomic(
    filename: string,
    data: string | Uint8Array,
    options?: WriteFileAtomicOptions,
  ): Promise<void>;
  export default writeFileAtomic;
}
