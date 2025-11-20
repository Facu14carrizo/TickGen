import jsQR from 'jsqr';

export class QRScanner {
  private video: HTMLVideoElement | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private canvasContext: CanvasRenderingContext2D | null = null;
  private stream: MediaStream | null = null;
  private scanning: boolean = false;

  async startScanning(
    videoElement: HTMLVideoElement,
    onScanSuccess: (code: string) => void,
    onError: (error: string) => void
  ): Promise<void> {
    try {
      const permissionStatus = await this.checkCameraPermission();
      if (permissionStatus === 'denied') {
        throw new Error(
          'El permiso de cámara está bloqueado. Ve a los ajustes del navegador y permite el acceso a la cámara para este sitio.'
        );
      }

      if (!window.isSecureContext) {
        throw new Error('La cámara sólo se puede usar en conexiones seguras (HTTPS o localhost).');
      }

      this.video = videoElement;
      this.canvas = document.createElement('canvas');
      this.canvasContext = this.canvas.getContext('2d');

      this.stream = await this.requestCameraStream(permissionStatus === 'prompt');

      this.video.srcObject = this.stream;
      this.video.setAttribute('playsinline', 'true');
      await this.video.play();

      this.scanning = true;
      this.scan(onScanSuccess, onError);
    } catch (error: any) {
      const message =
        error?.message ||
        'No se pudo acceder a la cámara. Por favor, verifica los permisos y vuelve a intentarlo.';
      onError(message);
      console.error('Camera access error:', error);
    }
  }

  private async requestCameraStream(shouldWarmUp: boolean): Promise<MediaStream> {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('La API de la cámara no está disponible en este dispositivo.');
    }

    const constraintAttempts: MediaStreamConstraints[] = [];

    if (shouldWarmUp) {
      // Algunos navegadores requieren una solicitud previa para enumerar dispositivos
      try {
        await navigator.mediaDevices.getUserMedia({ video: true });
      } catch {
        // Ignorar, sólo intentamos desbloquear enumerateDevices
      }
    }

    const preferredDeviceConstraint = await this.getPreferredDeviceConstraint();
    if (preferredDeviceConstraint) {
      constraintAttempts.push(preferredDeviceConstraint);
    }

    constraintAttempts.push(
      { video: { facingMode: { exact: 'environment' as const } } },
      { video: { facingMode: { ideal: 'environment' as const } } },
      { video: { facingMode: 'environment' } },
      { video: true }
    );

    let lastError: unknown = null;

    for (const constraints of constraintAttempts) {
      try {
        return await navigator.mediaDevices.getUserMedia(constraints);
      } catch (error) {
        lastError = error;
        console.warn('No se pudo obtener la cámara con los constraints:', constraints, error);
      }
    }

    throw lastError ?? new Error('No se pudo acceder a la cámara.');
  }

  private async checkCameraPermission(): Promise<PermissionState | 'unsupported'> {
    if (!navigator.permissions?.query) {
      return 'unsupported';
    }

    try {
      const status = await navigator.permissions.query({ name: 'camera' as PermissionName });
      return status.state;
    } catch {
      return 'unsupported';
    }
  }

  private async getPreferredDeviceConstraint(): Promise<MediaStreamConstraints | null> {
    if (!navigator.mediaDevices?.enumerateDevices) {
      return null;
    }

    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoInputs = devices.filter((device) => device.kind === 'videoinput');
      if (!videoInputs.length) return null;

      const backCamera =
        videoInputs.find((device) => /back|rear|environment/i.test(device.label)) || videoInputs[0];

      return {
        video: {
          deviceId: backCamera.deviceId,
        },
      };
    } catch (error) {
      console.warn('No se pudieron enumerar dispositivos de vídeo:', error);
      return null;
    }
  }

  private scan(onScanSuccess: (code: string) => void, onError: (error: string) => void): void {
    if (!this.scanning || !this.video || !this.canvas || !this.canvasContext) {
      return;
    }

    if (this.video.readyState === this.video.HAVE_ENOUGH_DATA) {
      this.canvas.height = this.video.videoHeight;
      this.canvas.width = this.video.videoWidth;

      this.canvasContext.drawImage(
        this.video,
        0,
        0,
        this.canvas.width,
        this.canvas.height
      );

      const imageData = this.canvasContext.getImageData(
        0,
        0,
        this.canvas.width,
        this.canvas.height
      );

      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: 'dontInvert',
      });

      if (code) {
        this.scanning = false;
        onScanSuccess(code.data);
        this.stopScanning();
        return;
      }
    }

    requestAnimationFrame(() => this.scan(onScanSuccess, onError));
  }

  stopScanning(): void {
    this.scanning = false;

    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }

    if (this.video) {
      this.video.srcObject = null;
    }
  }
}
