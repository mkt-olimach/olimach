const WHATSAPP_NUMBER = "5522996150138";

export function whatsappLink(message: string): string {
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}

export function courseWhatsappMessage(courseName: string): string {
  return `Olá! Gostaria de saber mais sobre o curso ${courseName}.`;
}
