// MinGW only forward-declares IAudioMeterInformation; define it like the Windows SDK does.
#pragma once
#include_next <endpointvolume.h>

MIDL_INTERFACE("c02216f6-8c67-4b5b-9d00-d008e73e0064")
IAudioMeterInformation : public IUnknown {
public:
  virtual HRESULT STDMETHODCALLTYPE GetPeakValue(float *pfPeak) = 0;
  virtual HRESULT STDMETHODCALLTYPE GetMeteringChannelCount(UINT *pnChannelCount) = 0;
  virtual HRESULT STDMETHODCALLTYPE GetChannelsPeakValues(UINT32 u32ChannelCount, float *afPeakValues) = 0;
  virtual HRESULT STDMETHODCALLTYPE QueryHardwareSupport(DWORD *pdwHardwareSupportMask) = 0;
};
__CRT_UUID_DECL(IAudioMeterInformation, 0xc02216f6, 0x8c67, 0x4b5b, 0x9d, 0x00, 0xd0, 0x08, 0xe7, 0x3e, 0x00, 0x64)
