import QRCode from 'qrcode';
import html2canvas from 'html2canvas';

export type TicketOrientation = 'landscape' | 'portrait';
export type TicketQRPosition = 'start' | 'end';

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
  eventDate: string,
  qrCodeDataUrl: string,
  backgroundImage?: string,
  orientation: TicketOrientation = 'landscape',
  qrPosition: TicketQRPosition = 'end'
): HTMLElement => {
  const isPortrait = orientation === 'portrait';
  const isQrAtStart = qrPosition === 'start';
  const container = document.createElement('div');
  container.style.width = isPortrait ? '420px' : '600px';
  container.style.height = isPortrait ? '720px' : '320px';
  container.style.position = 'relative';
  container.style.background = backgroundImage
    ? `url(${backgroundImage}) center/cover`
    : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
  container.style.borderRadius = '24px';
  container.style.padding = isPortrait ? '28px' : '30px';
  container.style.color = 'white';
  container.style.fontFamily = 'Poppins, Arial, sans-serif';
  container.style.boxShadow = '0 20px 45px rgba(15,23,42,0.4)';
  container.style.overflow = 'hidden';

  const overlay = document.createElement('div');
  overlay.style.position = 'absolute';
  overlay.style.top = '0';
  overlay.style.left = '0';
  overlay.style.right = '0';
  overlay.style.bottom = '0';
  overlay.style.background = backgroundImage ? 'rgba(0, 0, 0, 0.55)' : 'rgba(0,0,0,0)';
  overlay.style.borderRadius = '24px';
  container.appendChild(overlay);

  const content = document.createElement('div');
  content.style.position = 'relative';
  content.style.zIndex = '1';
  content.style.display = 'flex';
  content.style.flexDirection = isPortrait ? 'column' : 'row';
  content.style.justifyContent = isPortrait ? 'flex-start' : 'space-between';
  content.style.alignItems = isPortrait ? 'stretch' : 'center';
  content.style.height = '100%';
  content.style.gap = isPortrait ? '24px' : '16px';

  const leftSection = document.createElement('div');
  leftSection.style.flex = isPortrait ? '0 0 auto' : '1';
  leftSection.style.display = 'flex';
  leftSection.style.flexDirection = 'column';
  leftSection.style.justifyContent = 'space-between';
  leftSection.style.height = isPortrait ? 'auto' : '100%';
  leftSection.style.textAlign = isPortrait ? 'center' : 'left';
  leftSection.style.alignItems = isPortrait ? 'center' : 'flex-start';
  leftSection.style.gap = '12px';

  const titleEl = document.createElement('h1');
  titleEl.textContent = title;
  titleEl.style.fontSize = isPortrait ? '34px' : '32px';
  titleEl.style.fontWeight = '800';
  titleEl.style.margin = '0';
  titleEl.style.letterSpacing = '1px';
  titleEl.style.textShadow = '0 6px 16px rgba(0,0,0,0.45)';

  const subtitleEl = document.createElement('p');
  subtitleEl.textContent = subtitle;
  subtitleEl.style.fontSize = '18px';
  subtitleEl.style.margin = '0';
  subtitleEl.style.opacity = '0.9';
  subtitleEl.style.maxWidth = '90%';

  const ticketNumberEl = document.createElement('div');
  ticketNumberEl.textContent = `Entrada #${ticketNumber}`;
  ticketNumberEl.style.fontSize = '22px';
  ticketNumberEl.style.fontWeight = '700';
  ticketNumberEl.style.display = 'inline-flex';
  ticketNumberEl.style.alignItems = 'center';
  ticketNumberEl.style.gap = '8px';
  ticketNumberEl.style.padding = '10px 18px';
  ticketNumberEl.style.borderRadius = '999px';
  ticketNumberEl.style.background = 'rgba(255,255,255,0.15)';
  ticketNumberEl.style.border = '1px solid rgba(255,255,255,0.2)';
  ticketNumberEl.style.boxShadow = '0 10px 25px rgba(0,0,0,0.25)';

  const dateEl = document.createElement('div');
  dateEl.textContent = eventDate;
  dateEl.style.fontSize = '18px';
  dateEl.style.fontWeight = '600';
  dateEl.style.display = 'inline-flex';
  dateEl.style.alignItems = 'center';
  dateEl.style.gap = '8px';
  dateEl.style.padding = '8px 16px';
  dateEl.style.borderRadius = '16px';
  dateEl.style.background = 'rgba(0,0,0,0.35)';
  dateEl.style.border = '1px solid rgba(255,255,255,0.2)';

  leftSection.appendChild(titleEl);
  leftSection.appendChild(subtitleEl);
  leftSection.appendChild(dateEl);
  leftSection.appendChild(ticketNumberEl);

  const rightSection = document.createElement('div');
  rightSection.style.display = 'flex';
  rightSection.style.alignItems = 'center';
  rightSection.style.justifyContent = 'center';
  rightSection.style.padding = isPortrait
    ? isQrAtStart
      ? '0 0 12px 0'
      : '12px 0 0 0'
    : isQrAtStart
    ? '20px 30px 20px 0'
    : '20px 0 20px 30px';
  rightSection.style.flex = isPortrait ? '1' : '0 0 auto';
  rightSection.style.alignSelf = isPortrait ? 'stretch' : 'center';

  const qrContainer = document.createElement('div');
  qrContainer.style.background = 'white';
  qrContainer.style.padding = isPortrait ? '20px' : '15px';
  qrContainer.style.borderRadius = '18px';
  qrContainer.style.boxShadow = '0 20px 35px rgba(15,23,42,0.45)';
  qrContainer.style.margin = isPortrait ? (isQrAtStart ? '0 auto auto' : 'auto auto 0') : '0';

  const qrImg = document.createElement('img');
  qrImg.src = qrCodeDataUrl;
  qrImg.style.width = isPortrait ? '220px' : '170px';
  qrImg.style.height = qrImg.style.width;
  qrImg.style.display = 'block';

  qrContainer.appendChild(qrImg);
  rightSection.appendChild(qrContainer);

  if (qrPosition === 'start') {
    content.appendChild(rightSection);
    content.appendChild(leftSection);
  } else {
    content.appendChild(leftSection);
    content.appendChild(rightSection);
  }
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
