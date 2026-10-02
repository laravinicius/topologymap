import QRCode from 'qrcode';
import { publicDeskUrl } from '@topologia-new/domain';

export async function deskQr(origin: string, token: string) {
  const url = publicDeskUrl(origin, token);
  const image = await QRCode.toDataURL(url, { errorCorrectionLevel: 'M', margin: 4, width: 600, color: { dark: '#000000ff', light: '#ffffffff' } });
  return { url, image };
}
