import React, { useEffect, useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Camera, Mic } from 'lucide-react';

interface DeviceSelectorProps {
  onDeviceChange: (videoDeviceId: string, audioDeviceId: string) => void;
}

export const DeviceSelector: React.FC<DeviceSelectorProps> = ({ onDeviceChange }) => {
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedVideoDevice, setSelectedVideoDevice] = useState<string>('');
  const [selectedAudioDevice, setSelectedAudioDevice] = useState<string>('');

  useEffect(() => {
    // Load saved preferences from localStorage
    const savedVideoDevice = localStorage.getItem('preferred_cam_deviceId');
    const savedAudioDevice = localStorage.getItem('preferred_mic_deviceId');

    if (savedVideoDevice) setSelectedVideoDevice(savedVideoDevice);
    if (savedAudioDevice) setSelectedAudioDevice(savedAudioDevice);

    // Enumerate devices
    enumerateDevices();

    // Listen for device changes
    navigator.mediaDevices.addEventListener('devicechange', enumerateDevices);

    return () => {
      navigator.mediaDevices.removeEventListener('devicechange', enumerateDevices);
    };
  }, []);

  const enumerateDevices = async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      
      const videoInputs = devices.filter(device => device.kind === 'videoinput');
      const audioInputs = devices.filter(device => device.kind === 'audioinput');

      setVideoDevices(videoInputs);
      setAudioDevices(audioInputs);

      // Set default devices if not already selected
      if (!selectedVideoDevice && videoInputs.length > 0) {
        setSelectedVideoDevice(videoInputs[0].deviceId);
      }
      if (!selectedAudioDevice && audioInputs.length > 0) {
        setSelectedAudioDevice(audioInputs[0].deviceId);
      }
    } catch (error) {
      console.error('Error enumerating devices:', error);
    }
  };

  const handleVideoDeviceChange = (deviceId: string) => {
    setSelectedVideoDevice(deviceId);
    localStorage.setItem('preferred_cam_deviceId', deviceId);
    onDeviceChange(deviceId, selectedAudioDevice);
  };

  const handleAudioDeviceChange = (deviceId: string) => {
    setSelectedAudioDevice(deviceId);
    localStorage.setItem('preferred_mic_deviceId', deviceId);
    onDeviceChange(selectedVideoDevice, deviceId);
  };

  return (
    <div className="space-y-4">
      {/* Camera Selection */}
      <div className="space-y-2">
        <Label className="text-sm flex items-center gap-2">
          <Camera className="w-4 h-4" />
          Camera
        </Label>
        <Select value={selectedVideoDevice} onValueChange={handleVideoDeviceChange}>
          <SelectTrigger>
            <SelectValue placeholder="Select camera" />
          </SelectTrigger>
          <SelectContent>
            {videoDevices.map(device => (
              <SelectItem key={device.deviceId} value={device.deviceId}>
                {device.label || `Camera ${videoDevices.indexOf(device) + 1}`}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Microphone Selection */}
      <div className="space-y-2">
        <Label className="text-sm flex items-center gap-2">
          <Mic className="w-4 h-4" />
          Microphone
        </Label>
        <Select value={selectedAudioDevice} onValueChange={handleAudioDeviceChange}>
          <SelectTrigger>
            <SelectValue placeholder="Select microphone" />
          </SelectTrigger>
          <SelectContent>
            {audioDevices.map(device => (
              <SelectItem key={device.deviceId} value={device.deviceId}>
                {device.label || `Microphone ${audioDevices.indexOf(device) + 1}`}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
};
