#include <napi.h>

#define NOT_IMPLEMENTED .0f

#if defined(_WIN32) || defined(_WIN64) || defined(__WINDOWS__)
#include <Windows.h>
#include <objbase.h>
#include <mmdeviceapi.h>
#include <endpointvolume.h>

// holds volume peak information
// treble and bass not available
IAudioMeterInformation *pMeter = NULL;

#elif defined(__APPLE__) && defined(__MACH__)
#define IPC_IMPLEMENTATION
#include "macos/ipc.h"
ipc_sharedmemory mem;

#elif defined(__linux__)
#include <pulse/error.h>
#include <pulse/simple.h>

#include <algorithm>
#include <atomic>
#include <chrono>
#include <cmath>
#include <cstdio>
#include <cstdlib>
#include <mutex>
#include <thread>

// Peaks and samples of whatever the default output device plays, read from its monitor source
// through PulseAudio (or PipeWire's PulseAudio server). Capturing keeps the output device awake,
// so it only runs while the visualizations keep polling.
#define CAPTURE_IDLE_TIMEOUT_MS 1000
#define CAPTURE_RETRY_DELAY_MS 2000
#define CAPTURE_SAMPLE_RATE 48000
#define CAPTURE_FRAMES 256
// latest samples kept for the visualizations' spectrum analysis, ~85ms
#define CAPTURE_HISTORY_FRAMES 4096

// highest peak since the last time the volume was polled
std::atomic<float> peakValue(.0f);
std::atomic<bool> isCapturing(false);
std::atomic<bool> isStopping(false);
std::atomic<int64_t> lastPolledMs(0);
std::thread captureThread;

// ring buffer of the latest samples, the next one is written at historyEnd
std::mutex historyMutex;
float history[CAPTURE_HISTORY_FRAMES] = {};
size_t historyEnd = 0;
// tells the visualizations how many of the samples are new since they last looked
uint64_t capturedCount = 0;

int64_t NowMs() {
  return std::chrono::duration_cast<std::chrono::milliseconds>(
    std::chrono::steady_clock::now().time_since_epoch()).count();
}

bool ShouldCapture() {
  return !isStopping && NowMs() - lastPolledMs < CAPTURE_IDLE_TIMEOUT_MS;
}

void Capture() {
  const pa_sample_spec spec = { PA_SAMPLE_FLOAT32NE, CAPTURE_SAMPLE_RATE, 1 };
  pa_buffer_attr attr;
  attr.maxlength = (uint32_t) -1;
  attr.tlength = (uint32_t) -1;
  attr.prebuf = (uint32_t) -1;
  attr.minreq = (uint32_t) -1;
  // small fragments keep the latency around 5ms
  attr.fragsize = sizeof(float) * CAPTURE_FRAMES;

  int error = 0;
  bool isFailed = false;
  pa_simple *stream = pa_simple_new(NULL, "Lofi", PA_STREAM_RECORD, "@DEFAULT_MONITOR@", "Visualization",
                                    &spec, NULL, &attr, &error);

  if (!stream) {
    fprintf(stderr, "lofi: could not capture audio for visualizations: %s\n", pa_strerror(error));
    isFailed = true;
  } else {
    float samples[CAPTURE_FRAMES];
    while (ShouldCapture()) {
      if (pa_simple_read(stream, samples, sizeof(samples), &error) < 0) {
        fprintf(stderr, "lofi: audio capture for visualizations failed: %s\n", pa_strerror(error));
        isFailed = true;
        break;
      }

      float peak = .0f;
      for (float sample : samples) {
        peak = std::max(peak, std::fabs(sample));
      }

      float current = peakValue;
      while (peak > current && !peakValue.compare_exchange_weak(current, peak)) {
      }

      std::lock_guard<std::mutex> lock(historyMutex);
      for (float sample : samples) {
        history[historyEnd] = sample;
        historyEnd = (historyEnd + 1) % CAPTURE_HISTORY_FRAMES;
      }
      capturedCount += CAPTURE_FRAMES;
    }
    pa_simple_free(stream);
  }

  // the volume is polled every frame, back off instead of reconnecting right away
  for (int waitedMs = 0; isFailed && !isStopping && waitedMs < CAPTURE_RETRY_DELAY_MS; waitedMs += 100) {
    std::this_thread::sleep_for(std::chrono::milliseconds(100));
  }

  peakValue = .0f;
  {
    // the next capture shouldn't start with this one's last sounds
    std::lock_guard<std::mutex> lock(historyMutex);
    std::fill(history, history + CAPTURE_HISTORY_FRAMES, .0f);
  }
  isCapturing = false;
}

// Called on every poll, starts capturing if it isn't already
void KeepCapturing() {
  lastPolledMs = NowMs();
  if (!isCapturing.exchange(true)) {
    // the previous capture (if any) already ended, joining it is immediate
    if (captureThread.joinable()) {
      captureThread.join();
    }
    captureThread = std::thread(Capture);
  }
}

void StopCapture() {
  isStopping = true;
  if (captureThread.joinable()) {
    captureThread.join();
  }
  isStopping = false;
}
#endif

Napi::Number NativeVolume(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
	float peak = NOT_IMPLEMENTED;
#if defined(_WIN32) || defined(_WIN64) || defined(__WINDOWS__)
  // without an output device to meter there's only silence
  if (pMeter) {
    pMeter->GetPeakValue(&peak);
  }
#elif defined(__APPLE__) && defined(__MACH__)
  memcpy(&peak,mem.data,sizeof(float));
#elif defined(__linux__)
  KeepCapturing();
  peak = peakValue.exchange(.0f);
#else
  // fallback returns NOT_IMPLEMENTED
#endif

	return Napi::Number::New(env, peak);
}

// Fills the given Float32Array with the latest samples, oldest first (silence before the capture started), and
// returns how many samples were captured so far. Only Linux captures samples, elsewhere it writes none and returns 0,
// only the volume's peaks are available there.
Napi::Number NativeWaveform(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() < 1 || !info[0].IsTypedArray() ||
      info[0].As<Napi::TypedArray>().TypedArrayType() != napi_float32_array) {
    Napi::TypeError::New(env, "waveform expects a Float32Array").ThrowAsJavaScriptException();
    return Napi::Number::New(env, 0);
  }

  uint64_t captured = 0;
#if defined(__linux__)
  Napi::Float32Array target = info[0].As<Napi::Float32Array>();
  KeepCapturing();
  size_t count = std::min(target.ElementLength(), (size_t) CAPTURE_HISTORY_FRAMES);

  std::lock_guard<std::mutex> lock(historyMutex);
  size_t start = (historyEnd + CAPTURE_HISTORY_FRAMES - count) % CAPTURE_HISTORY_FRAMES;
  for (size_t i = 0; i < count; i++) {
    target[i] = history[(start + i) % CAPTURE_HISTORY_FRAMES];
  }
  captured = capturedCount;
#endif

  return Napi::Number::New(env, (double) captured);
}

Napi::Object Init(Napi::Env env, Napi::Object exports) {
#if defined(_WIN32) || defined(_WIN64) || defined(__WINDOWS__)
	CoInitialize(NULL);
	IMMDeviceEnumerator *pEnum = NULL;
	IMMDevice *pDevice = NULL;

	// Any of these can fail, e.g. without an output device: the meter then stays null and the volume reads silence
	HRESULT hr;
	hr = CoCreateInstance(__uuidof(MMDeviceEnumerator),
		NULL,
		CLSCTX_INPROC_SERVER,
		__uuidof(IMMDeviceEnumerator),
		(void**)&pEnum);

	if (SUCCEEDED(hr) && pEnum) {
		hr = pEnum->GetDefaultAudioEndpoint(eRender, eConsole, &pDevice);
	}

	if (SUCCEEDED(hr) && pDevice) {
		hr = pDevice->Activate(__uuidof(IAudioMeterInformation),
			CLSCTX_ALL,
			NULL,
			(void**)&pMeter);
		if (FAILED(hr)) {
			pMeter = NULL;
		}
	}
#elif defined(__APPLE__) && defined(__MACH__)
	ipc_mem_init(&mem, (char*)"lofi-volume-capture", 1024);
	if (ipc_mem_open_existing(&mem)) {
			ipc_mem_create(&mem);
			memset(mem.data, 0, mem.size);
	}
#elif defined(__linux__)
  // a still running capture thread would abort the process when it exits, whether the environment
  // is torn down or the process exits without tearing it down
  env.AddCleanupHook(StopCapture);
  std::atexit(StopCapture);
#endif

  exports.Set(Napi::String::New(env, "volume"),
              Napi::Function::New(env, NativeVolume));
  exports.Set(Napi::String::New(env, "waveform"),
              Napi::Function::New(env, NativeWaveform));
  return exports;
}

NODE_API_MODULE(volume, Init)
