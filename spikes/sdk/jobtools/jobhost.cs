// Spike 5 tier-B emulation: creates a KILL_ON_JOB_CLOSE job (no breakaway flags), starts the target
// suspended inside it, DUPLICATES the only job handle INTO the target, resumes it and exits.
// Result: the only open handle to the job lives in the target's handle table, exactly as if the
// daemon had called CreateJobObject + AssignProcessToJobObject(GetCurrentProcess()) itself (LLD 6.4 tier B).
// Prints "PID <pid>" of the target. Build: csc /out:jobhost.exe jobhost.cs
using System;
using System.Runtime.InteropServices;
using System.Text;

class JobHost {
  [StructLayout(LayoutKind.Sequential)] struct STARTUPINFO { public int cb; public string lpReserved, lpDesktop, lpTitle; public int x, y, xs, ys, xc, yc, fill, flags; public short show, res2; public IntPtr res2p, hIn, hOut, hErr; }
  [StructLayout(LayoutKind.Sequential)] struct PROCESS_INFORMATION { public IntPtr hProcess, hThread; public int pid, tid; }
  [StructLayout(LayoutKind.Sequential)] struct BASIC { public long a, b; public uint LimitFlags; public UIntPtr c, d; public uint e; public UIntPtr f; public uint g, h; }
  [StructLayout(LayoutKind.Sequential)] struct IOC { public ulong a, b, c, d, e, f; }
  [StructLayout(LayoutKind.Sequential)] struct EXT { public BASIC Basic; public IOC Io; public UIntPtr p, j, pm, peak; }
  [DllImport("kernel32.dll", CharSet = CharSet.Unicode)] static extern IntPtr CreateJobObjectW(IntPtr a, string n);
  [DllImport("kernel32.dll")] static extern bool SetInformationJobObject(IntPtr j, int c, ref EXT i, int l);
  [DllImport("kernel32.dll")] static extern bool AssignProcessToJobObject(IntPtr j, IntPtr p);
  [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)] static extern bool CreateProcessW(string app, StringBuilder cmd, IntPtr pa, IntPtr ta, bool inh, uint fl, IntPtr env, string cwd, ref STARTUPINFO si, out PROCESS_INFORMATION pi);
  [DllImport("kernel32.dll")] static extern uint ResumeThread(IntPtr t);
  [DllImport("kernel32.dll")] static extern bool DuplicateHandle(IntPtr sp, IntPtr sh, IntPtr tp, out IntPtr th, uint acc, bool inh, uint opt);
  [DllImport("kernel32.dll")] static extern IntPtr GetCurrentProcess();
  [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr h);

  static int Main(string[] args) {
    IntPtr job = CreateJobObjectW(IntPtr.Zero, null);
    EXT info = new EXT(); info.Basic.LimitFlags = 0x2000; // KILL_ON_JOB_CLOSE only
    if (!SetInformationJobObject(job, 9, ref info, Marshal.SizeOf(typeof(EXT)))) return 3;
    STARTUPINFO si = new STARTUPINFO(); si.cb = Marshal.SizeOf(typeof(STARTUPINFO));
    PROCESS_INFORMATION pi;
    var cmd = new StringBuilder(string.Join(" ", args));
    if (!CreateProcessW(null, cmd, IntPtr.Zero, IntPtr.Zero, false, 0x4 /*SUSPENDED*/, IntPtr.Zero, null, ref si, out pi)) return 4;
    if (!AssignProcessToJobObject(job, pi.hProcess)) return 5;
    IntPtr dup; if (!DuplicateHandle(GetCurrentProcess(), job, pi.hProcess, out dup, 0, false, 2 /*SAME_ACCESS*/)) return 6;
    CloseHandle(job);            // our copy: gone, so only the target holds the job
    ResumeThread(pi.hThread);
    Console.WriteLine("PID " + pi.pid);
    return 0;
  }
}
