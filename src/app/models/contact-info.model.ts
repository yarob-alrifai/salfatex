export interface ContactInfo {
  phone: string;
  mobile: string;
  email: string;
  address: string;
  whatsappUrl: string;
  telegramUrl: string;
  whatsappQrUrl: string;
}

export const EMPTY_CONTACT_INFO: ContactInfo = {
  phone: '',
  mobile: '',
  email: '',
  address: '',
  whatsappUrl: '',
  telegramUrl: '',
  whatsappQrUrl: '',
};
