import {
  JOB_INFO_EXTENDED_LIMIT,
  JOB_INFO_FLAGS_OFFSET,
  JOB_INFO_SIZE,
  JOB_LIMIT_KILL_ON_CLOSE,
} from "./constants.ts";

type NativeFn = (...args: unknown[]) => unknown;
interface KoffiLib {
  func(signature: string): NativeFn;
}
interface KoffiModule {
  load(name: string): KoffiLib;
}

function isKoffi(value: unknown): value is KoffiModule {
  return (
    typeof value === "object" && value !== null && typeof (value as KoffiModule).load === "function"
  );
}

/** Loads the `koffi` package; rejects when it is missing or its native part will not load. */
export async function loadKoffi(): Promise<unknown> {
  const name = "koffi";
  const mod = (await import(name)) as { default?: unknown };
  return mod.default ?? mod;
}

/**
 * Tier B (LLD 6.4): the daemon puts itself in a kill-on-close job object and never closes the
 * handle, so Windows ends every descendant when the daemon dies, however it dies.
 */
export async function enableSelfJob(load: () => Promise<unknown> = loadKoffi): Promise<void> {
  const koffi = await load();
  if (!isKoffi(koffi)) throw new Error("koffi has no load()");
  const k32 = koffi.load("kernel32.dll");
  const create = k32.func("void* __stdcall CreateJobObjectW(void* attributes, str16 name)");
  const setInfo = k32.func(
    "int __stdcall SetInformationJobObject(void* job, int infoClass, void* info, uint32 size)",
  );
  const assign = k32.func("int __stdcall AssignProcessToJobObject(void* job, void* process)");
  const current = k32.func("void* __stdcall GetCurrentProcess()");
  const job = create(null, null);
  if (job === null || job === undefined) throw new Error("CreateJobObjectW failed");
  const info = Buffer.alloc(JOB_INFO_SIZE);
  info.writeUInt32LE(JOB_LIMIT_KILL_ON_CLOSE, JOB_INFO_FLAGS_OFFSET);
  if (setInfo(job, JOB_INFO_EXTENDED_LIMIT, info, JOB_INFO_SIZE) === 0) {
    throw new Error("SetInformationJobObject failed");
  }
  if (assign(job, current()) === 0) throw new Error("AssignProcessToJobObject failed");
}
