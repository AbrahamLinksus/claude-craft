const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("shellBridge", {
  name: "electron " + process.versions.electron,
  pipeRoundTrip: (line) => ipcRenderer.invoke("pipe-round-trip", line),
  report: (obj) => ipcRenderer.invoke("report", obj),
});
