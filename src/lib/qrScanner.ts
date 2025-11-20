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
    this.video = videoElement;
    this.canvas = document.createElement('canvas');
    this.canvasContext = this.canvas.getContext('2d');

    try {
      this.stream = await this.requestCameraStream();

      this.video.srcObject = this.stream;
      this.video.setAttribute('playsinline', 'true');
      await this.video.play();

      this.scanning = true;
      this.scan(onScanSuccess, onError);
    } catch (error) {
      onError('No se pudo acceder a la cámara. Por favor, verifica los permisos.');
      console.error('Camera access error:', error);
    }
  }

  private async requestCameraStream(): Promise<MediaStream> {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('La API de la cámara no está disponible en este dispositivo.');
    }

    const constraintAttempts: MediaStreamConstraints[] = [
      { video: { facingMode: { exact: 'environment' as const } } },
      { video: { facingMode: { ideal: 'environment' as const } } },
      { video: { facingMode: 'environment' } },
      { video: true },
    ];

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
