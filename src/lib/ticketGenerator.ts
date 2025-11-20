import QRCode from 'qrcode';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

export type TicketOrientation = 'landscape' | 'portrait';
export type TicketQRPosition = 'start' | 'end';
export type TicketQRSize = 'small' | 'medium' | 'large';

export interface TicketDesignOptions {
  backgroundColor?: string;
  textColor?: string;
  accentColor?: string;
  qrSize?: TicketQRSize;
  logoImage?: string;
  titleFontSize?: number;
  subtitleFontSize?: number;
  overlayOpacity?: number;
  showTicketNumber?: boolean;
  qrBorderStyle?: 'none' | 'rounded' | 'square';
}

export const generateUniqueCode = (): string => {
  return `TICKET-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
};

export const generateQRCode = async (text: string, size: TicketQRSize = 'medium'): Promise<string> => {
  try {
    const sizes = {
      small: 150,
      medium: 200,
      large: 280,
    };
    return await QRCode.toDataURL(text, {
      width: sizes[size],
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
  qrPosition: TicketQRPosition = 'end',
  designOptions: TicketDesignOptions = {}
): HTMLElement => {
  const {
    backgroundColor = '#667eea',
    textColor = '#ffffff',
    accentColor = '#ffffff',
    qrSize = 'medium',
    logoImage,
    titleFontSize,
    subtitleFontSize,
    overlayOpacity = backgroundImage ? 0.55 : 0,
    showTicketNumber = true,
    qrBorderStyle = 'rounded',
  } = designOptions;

  const isPortrait = orientation === 'portrait';
  const isQrAtStart = qrPosition === 'start';
  const container = document.createElement('div');
  container.style.width = isPortrait ? '420px' : '600px';
  container.style.height = isPortrait ? '720px' : '320px';
  container.style.position = 'relative';
  container.style.background = backgroundImage
    ? `url(${backgroundImage}) center/cover`
    : `linear-gradient(135deg, ${backgroundColor} 0%, ${accentColor} 100%)`;
  container.style.borderRadius = '24px';
  container.style.padding = isPortrait ? '28px' : '30px';
  container.style.color = textColor;
  container.style.fontFamily = 'Poppins, Arial, sans-serif';
  container.style.boxShadow = '0 20px 45px rgba(15,23,42,0.4)';
  container.style.overflow = 'hidden';

  const overlay = document.createElement('div');
  overlay.style.position = 'absolute';
  overlay.style.top = '0';
  overlay.style.left = '0';
  overlay.style.right = '0';
  overlay.style.bottom = '0';
  overlay.style.background = `rgba(0, 0, 0, ${overlayOpacity})`;
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
  titleEl.style.fontSize = titleFontSize 
    ? `${titleFontSize}px` 
    : isPortrait ? '34px' : '32px';
  titleEl.style.fontWeight = '800';
  titleEl.style.margin = '0';
  titleEl.style.letterSpacing = '1px';
  titleEl.style.textShadow = '0 6px 16px rgba(0,0,0,0.45)';
  titleEl.style.color = textColor;

  const subtitleEl = document.createElement('p');
  subtitleEl.textContent = subtitle;
  subtitleEl.style.fontSize = subtitleFontSize 
    ? `${subtitleFontSize}px` 
    : '18px';
  subtitleEl.style.margin = '0';
  subtitleEl.style.opacity = '0.9';
  subtitleEl.style.maxWidth = '90%';
  subtitleEl.style.color = textColor;

  if (logoImage) {
    const logoEl = document.createElement('img');
    logoEl.src = logoImage;
    logoEl.style.maxWidth = isPortrait ? '120px' : '100px';
    logoEl.style.maxHeight = isPortrait ? '120px' : '100px';
    logoEl.style.objectFit = 'contain';
    logoEl.style.marginBottom = '12px';
    logoEl.style.filter = 'drop-shadow(0 4px 8px rgba(0,0,0,0.3))';
    leftSection.insertBefore(logoEl, titleEl);
  }

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
  dateEl.style.color = textColor;

  leftSection.appendChild(titleEl);
  leftSection.appendChild(subtitleEl);
  leftSection.appendChild(dateEl);

  if (showTicketNumber) {
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
    ticketNumberEl.style.color = textColor;
    leftSection.appendChild(ticketNumberEl);
  }

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

  const qrSizes = {
    small: { portrait: '160px', landscape: '130px' },
    medium: { portrait: '220px', landscape: '170px' },
    large: { portrait: '280px', landscape: '220px' },
  };
  const qrWidth = qrSizes[qrSize][isPortrait ? 'portrait' : 'landscape'];

  const qrContainer = document.createElement('div');
  qrContainer.style.background = 'white';
  qrContainer.style.padding = isPortrait ? '20px' : '15px';
  qrContainer.style.borderRadius = qrBorderStyle === 'square' ? '0' : qrBorderStyle === 'rounded' ? '18px' : '0';
  qrContainer.style.boxShadow = '0 20px 35px rgba(15,23,42,0.45)';
  qrContainer.style.margin = isPortrait ? (isQrAtStart ? '0 auto auto' : 'auto auto 0') : '0';

  const qrImg = document.createElement('img');
  qrImg.src = qrCodeDataUrl;
  qrImg.style.width = qrWidth;
  qrImg.style.height = qrWidth;
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
    // Convertir el elemento HTML a canvas
    const canvas = await html2canvas(element, {
      scale: 2,
      backgroundColor: null,
      logging: false,
    });

    // Obtener las dimensiones del canvas
    const imgWidth = canvas.width;
    const imgHeight = canvas.height;
    
    // Convertir a milímetros para jsPDF (1px ≈ 0.264583mm a 96 DPI)
    const mmWidth = imgWidth * 0.264583;
    const mmHeight = imgHeight * 0.264583;
    
    // Convertir canvas a imagen
    const imgData = canvas.toDataURL('image/png');
    
    // Crear PDF (orientación según el tamaño)
    const isLandscape = imgWidth > imgHeight;
    const pdf = new jsPDF({
      orientation: isLandscape ? 'landscape' : 'portrait',
      unit: 'mm',
      format: [mmWidth, mmHeight]
    });
    
    // Agregar la imagen al PDF (ajustar a las dimensiones del PDF)
    pdf.addImage(imgData, 'PNG', 0, 0, mmWidth, mmHeight, undefined, 'FAST');
    
    // Cambiar la extensión del nombre de archivo de .png a .pdf
    const pdfFilename = filename.replace(/\.png$/i, '.pdf');
    
    // Descargar el PDF
    pdf.save(pdfFilename);
  } catch (error) {
    console.error('Error downloading ticket as PDF:', error);
    throw error;
  }
};
