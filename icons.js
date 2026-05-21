// He Knows She Knows — Iconos SVG propios
// Paleta: terra #C47A5A | gold #C9A96E | night #1A1410 | blush #E8C4B0 | muted #9A8880
// Uso: HKSK.icons.relaciones  → string SVG
// Para insertar: element.innerHTML = HKSK.icons.relaciones

const HKSK = {
  icons: {

    relaciones: `<svg xmlns="http://www.w3.org/2000/svg" width="44" height="44" viewBox="0 0 44 44" fill="none" aria-label="Relaciones">
  <path d="M22 38C22 38 6 28 6 16.5C6 11.5 9.5 8 14 8C17.2 8 20 10 22 12.5C24 10 26.8 8 30 8C34.5 8 38 11.5 38 16.5C38 28 22 38 22 38Z" fill="#C47A5A" stroke="#C47A5A" stroke-width="1.5" stroke-linejoin="round"/>
</svg>`,

    ghosting: `<svg xmlns="http://www.w3.org/2000/svg" width="44" height="44" viewBox="0 0 44 44" fill="none" aria-label="Ghosting">
  <ellipse cx="22" cy="20" rx="10" ry="13" fill="#9A8880" stroke="#9A8880" stroke-width="1"/>
  <circle cx="18.5" cy="17" r="1.5" fill="#1A1410"/>
  <circle cx="25.5" cy="17" r="1.5" fill="#1A1410"/>
  <path d="M18.5 22.5C18.5 22.5 19.5 21.5 22 21.5C24.5 21.5 25.5 22.5 25.5 22.5" stroke="#1A1410" stroke-width="1.2" stroke-linecap="round" fill="none"/>
  <path d="M22 33L20 38L22 36L24 38Z" fill="#9A8880"/>
  <ellipse cx="12" cy="19" rx="3" ry="4" fill="#9A8880"/>
  <ellipse cx="32" cy="19" rx="3" ry="4" fill="#9A8880"/>
  <path d="M19 24.5L17 27" stroke="#9A8880" stroke-width="1" stroke-linecap="round" fill="none"/>
  <path d="M25 24.5L27 27" stroke="#9A8880" stroke-width="1" stroke-linecap="round" fill="none"/>
  <path d="M16 13C15 10 17 7 22 7C27 7 29 10 28 13" stroke="#9A8880" stroke-width="1.2" fill="none" stroke-linecap="round"/>
  <path d="M18 28C18 28 19.5 29 22 29C24.5 29 26 28 26 28" stroke="#C47A5A" stroke-width="1.2" fill="none" stroke-linecap="round"/>
  <path d="M20 30L19 32L22 31L25 32L24 30" fill="#C47A5A" opacity="0.7"/>
</svg>`,

    sexoOpuesto: `<svg xmlns="http://www.w3.org/2000/svg" width="44" height="44" viewBox="0 0 44 44" fill="none" aria-label="Cómo piensa el sexo opuesto">
  <circle cx="14" cy="16" r="6" fill="#C47A5A" opacity="0.85"/>
  <circle cx="30" cy="16" r="6" fill="#C9A96E" opacity="0.85"/>
  <rect x="10" y="22" width="8" height="11" rx="4" fill="#C47A5A" opacity="0.85"/>
  <rect x="26" y="22" width="8" height="11" rx="4" fill="#C9A96E" opacity="0.85"/>
  <path d="M18 28H26" stroke="#1A1410" stroke-width="1" stroke-linecap="round" fill="none" opacity="0.4"/>
</svg>`,

    confianza: `<svg xmlns="http://www.w3.org/2000/svg" width="44" height="44" viewBox="0 0 44 44" fill="none" aria-label="Confianza">
  <circle cx="20" cy="18" r="7" fill="#C47A5A" opacity="0.9"/>
  <rect x="16" y="25" width="8" height="12" rx="4" fill="#C47A5A" opacity="0.9"/>
  <path d="M14 26L10 30M26 26L30 30" stroke="#C47A5A" stroke-width="2" stroke-linecap="round" fill="none" opacity="0.8"/>
  <path d="M20 32L20 38" stroke="#C47A5A" stroke-width="2" stroke-linecap="round" fill="none" opacity="0.6"/>
  <polygon points="34,6 36,11 41,11 37,14 38.5,19 34,16 29.5,19 31,14 27,11 32,11" fill="#C9A96E"/>
</svg>`,

    styling: `<svg xmlns="http://www.w3.org/2000/svg" width="44" height="44" viewBox="0 0 44 44" fill="none" aria-label="Styling">
  <circle cx="16" cy="14" r="5.5" fill="#C47A5A" opacity="0.9"/>
  <path d="M10.5 24C10.5 20.5 13 19 16 19C19 19 21.5 20.5 21.5 24V36H10.5V24Z" fill="#C47A5A" opacity="0.9"/>
  <circle cx="29" cy="14" r="5.5" fill="#C9A96E" opacity="0.9"/>
  <path d="M23.5 24C23.5 20.5 26 19 29 19C32 19 34.5 20.5 34.5 24V36H23.5V24Z" fill="#C9A96E" opacity="0.9"/>
</svg>`,

    texting: `<svg xmlns="http://www.w3.org/2000/svg" width="44" height="44" viewBox="0 0 44 44" fill="none" aria-label="Texting">
  <rect x="6" y="10" width="28" height="20" rx="6" fill="#C47A5A" opacity="0.9"/>
  <path d="M6 28L2 36L14 30" fill="#C47A5A" opacity="0.9"/>
  <circle cx="14" cy="20" r="2" fill="#F7F3EE"/>
  <circle cx="20" cy="20" r="2" fill="#F7F3EE"/>
  <circle cx="26" cy="20" r="2" fill="#F7F3EE"/>
  <rect x="28" y="18" width="14" height="12" rx="4" fill="#C9A96E" opacity="0.85"/>
  <path d="M42 28L44 34L34 30" fill="#C9A96E" opacity="0.85"/>
  <circle cx="33" cy="24" r="1.3" fill="#F7F3EE"/>
  <circle cx="37" cy="24" r="1.3" fill="#F7F3EE"/>
</svg>`,

    citas: `<svg xmlns="http://www.w3.org/2000/svg" width="44" height="44" viewBox="0 0 44 44" fill="none" aria-label="Citas">
  <rect x="6" y="10" width="32" height="28" rx="4" fill="none" stroke="#C47A5A" stroke-width="2"/>
  <rect x="6" y="10" width="32" height="8" rx="4" fill="#C47A5A"/>
  <rect x="6" y="14" width="32" height="4" fill="#C47A5A"/>
  <line x1="14" y1="6" x2="14" y2="14" stroke="#C47A5A" stroke-width="2.5" stroke-linecap="round"/>
  <line x1="30" y1="6" x2="30" y2="14" stroke="#C47A5A" stroke-width="2.5" stroke-linecap="round"/>
  <line x1="14" y1="26" x2="30" y2="26" stroke="#E8C4B0" stroke-width="1" stroke-linecap="round"/>
  <line x1="14" y1="31" x2="26" y2="31" stroke="#E8C4B0" stroke-width="1" stroke-linecap="round"/>
  <path d="M28 30C28 30 27 28.5 28.5 28C30 27.5 31 29 30 30.5C29 32 27 32 27 32L26.5 34" stroke="#C9A96E" stroke-width="1.2" stroke-linecap="round" fill="none"/>
</svg>`,

    desahogo: `<svg xmlns="http://www.w3.org/2000/svg" width="44" height="44" viewBox="0 0 44 44" fill="none" aria-label="Desahogo">
  <circle cx="20" cy="14" r="6" fill="#C47A5A" opacity="0.9"/>
  <path d="M14 28C14 23.5 16.5 22 20 22C23.5 22 26 23.5 26 28V38H14V28Z" fill="#C47A5A" opacity="0.9"/>
  <path d="M26 26C28 24 32 24 34 26" stroke="#C9A96E" stroke-width="1.8" stroke-linecap="round" fill="none"/>
  <path d="M27 29C29 27.5 33 27.5 35 29" stroke="#C9A96E" stroke-width="1.5" stroke-linecap="round" fill="none" opacity="0.7"/>
  <path d="M28 32C30 31 32 31 34 32" stroke="#C9A96E" stroke-width="1.2" stroke-linecap="round" fill="none" opacity="0.5"/>
</svg>`,

  },

  // Helper: insertar icono en un elemento por su ID
  // Uso: HKSK.setIcon('mi-div', 'ghosting', 56)
  setIcon(elementId, iconName, size = 44) {
    const el = document.getElementById(elementId);
    if (!el || !this.icons[iconName]) return;
    el.innerHTML = this.icons[iconName].replace(/width="44"/g, `width="${size}"`).replace(/height="44"/g, `height="${size}"`);
  },

  // Helper: obtener todos los nombres de iconos disponibles
  list() {
    return Object.keys(this.icons);
  }
};

// Exportar para uso como módulo o global
if (typeof module !== 'undefined') module.exports = HKSK;
else window.HKSK = HKSK;
