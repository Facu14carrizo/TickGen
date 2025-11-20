import QRCode from 'qrcode';
import html2canvas from 'html2canvas';

export const generateUniqueCode = (): string => {
  return `TICKET-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
};

export const generateQRCode = async (text: string): Promise<string> => {
  try {
    return await QRCode.toDataURL(text, {
      width: 200,
      margin: 1,
      color: {
        dark: '#000000',
        light: '#FFFFFF',
      },
    });
  } catch (error) {
    console.error('Error generating QR code:', error);
    throw error;
  }
};

export const createTicketElement = (
  title: string,
  subtitle: string,
  ticketNumber: number,
  qrCodeDataUrl: string,
  backgroundImage?: string
): HTMLElement => {
  const container = document.createElement('div');
  container.style.width = '600px';
  container.style.height = '300px';
  container.style.position = 'relative';
  container.style.background = backgroundImage
    ? `url(${backgroundImage}) center/cover`
    : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
  container.style.borderRadius = '20px';
  container.style.padding = '30px';
  container.style.color = 'white';
  container.style.fontFamily = 'Arial, sans-serif';
  container.style.boxShadow = '0 10px 30px rgba(0,0,0,0.3)';

  if (backgroundImage) {
    const overlay = document.createElement('div');
    overlay.style.position = 'absolute';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.right = '0';
    overlay.style.bottom = '0';
    overlay.style.background = 'rgba(0, 0, 0, 0.5)';
    overlay.style.borderRadius = '20px';
    container.appendChild(overlay);
  }

  const content = document.createElement('div');
  content.style.position = 'relative';
  content.style.zIndex = '1';
  content.style.display = 'flex';
  content.style.justifyContent = 'space-between';
  content.style.height = '100%';

  const leftSection = document.createElement('div');
  leftSection.style.flex = '1';
  leftSection.style.display = 'flex';
  leftSection.style.flexDirection = 'column';
  leftSection.style.justifyContent = 'space-between';

  const titleEl = document.createElement('h1');
  titleEl.textContent = title;
  titleEl.style.fontSize = '32px';
  titleEl.style.fontWeight = 'bold';
  titleEl.style.margin = '0';
  titleEl.style.textShadow = '2px 2px 4px rgba(0,0,0,0.5)';

  const subtitleEl = document.createElement('p');
  subtitleEl.textContent = subtitle;
  subtitleEl.style.fontSize = '18px';
  subtitleEl.style.margin = '10px 0';
  subtitleEl.style.textShadow = '1px 1px 2px rgba(0,0,0,0.5)';

  const ticketNumberEl = document.createElement('div');
  ticketNumberEl.textContent = `Entrada #${ticketNumber}`;
  ticketNumberEl.style.fontSize = '24px';
  ticketNumberEl.style.fontWeight = 'bold';
  ticketNumberEl.style.textShadow = '1px 1px 2px rgba(0,0,0,0.5)';

  leftSection.appendChild(titleEl);
  leftSection.appendChild(subtitleEl);
  leftSection.appendChild(ticketNumberEl);

  const rightSection = document.createElement('div');
  rightSection.style.display = 'flex';
  rightSection.style.alignItems = 'center';
  rightSection.style.justifyContent = 'center';
  rightSection.style.padding = '20px';

  const qrContainer = document.createElement('div');
  qrContainer.style.background = 'white';
  qrContainer.style.padding = '15px';
  qrContainer.style.borderRadius = '10px';
  qrContainer.style.boxShadow = '0 5px 15px rgba(0,0,0,0.3)';

  const qrImg = document.createElement('img');
  qrImg.src = qrCodeDataUrl;
  qrImg.style.width = '160px';
  qrImg.style.height = '160px';
  qrImg.style.display = 'block';

  qrContainer.appendChild(qrImg);
  rightSection.appendChild(qrContainer);

  content.appendChild(leftSection);
  content.appendChild(rightSection);
  container.appendChild(content);

  return container;
};

export const downloadTicketAsImage = async (
  element: HTMLElement,
  filename: string,
  eventName: string
): Promise<void> => {
  try {
    const canvas = await html2canvas(element, {
      scale: 2,
      backgroundColor: null,
    });

    const blob = await new Promise<Blob>((resolve) => {
      canvas.toBlob((blob) => resolve(blob!), 'image/png');
    });

    const cleanEventName = eventName.replace(/[^a-zA-Z0-9-_]/g, '-');
    const suggestedName = `entradas-${cleanEventName}/${filename}`;

    if ('showSaveFilePicker' in window) {
      try {
        const handle = await (window as any).showSaveFilePicker({
          suggestedName: filename,
          types: [{
            description: 'PNG Image',
            accept: { 'image/png': ['.png'] },
          }],
        });
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
        return;
      } catch (err: any) {
        if (err.name === 'AbortError') {
          throw new Error('Descarga cancelada');
        }
      }
    }

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = filename;
    link.href = url;
    link.click();

    setTimeout(() => URL.revokeObjectURL(url), 100);
  } catch (error) {
    console.error('Error downloading ticket:', error);
    throw error;
  }
};
