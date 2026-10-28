// node-gyp's win_delay_load_hook.cc without its _MSC_VER guard, so MinGW links it too.
// Resolves node.exe imports against the running lofi.exe.
#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#include <delayimp.h>
#include <string.h>

static FARPROC WINAPI load_exe_hook(unsigned int event, DelayLoadInfo *info) {
  if (event != dliNotePreLoadLibrary) return NULL;
  if (_stricmp(info->szDll, "node.exe") != 0) return NULL;
  return (FARPROC)GetModuleHandle(NULL);
}

decltype(__pfnDliNotifyHook2) __pfnDliNotifyHook2 = load_exe_hook;
