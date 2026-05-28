// netlify/functions/name-validator.js
// Librería compartida para validar nombres en He Knows · She Knows
// Reglas: mínimo 2 letras, solo letras/acentos/espacios, sin números/emojis,
// sin apodos infantiles, cursis o sugerentes.

// Lista negra de palabras prohibidas (en minúsculas, sin acentos para comparar)
// Si el nombre completo o cualquier palabra coincide exactamente, se rechaza.
const PALABRAS_PROHIBIDAS = new Set([
  // Apodos cursis / diminutivos infantiles
  'chocolate', 'bombon', 'bombón', 'princesa', 'princess', 'baby', 'bb', 'bebe', 'bebé',
  'muneca', 'muñeca', 'munequita', 'muñequita', 'barbie', 'queen', 'reina', 'diva',
  'kitty', 'gatita', 'conejita', 'mami', 'mamita', 'mamacita', 'flaca', 'flaquita',
  'gordis', 'gordita', 'linda', 'lindita', 'bella', 'bellita',
  // Insinuantes / inapropiados
  'sexy', 'hot', 'hottie', 'kinky', 'naughty', 'slut', 'daddy', 'mommy',
  'sugar', 'honey', 'sweetheart', 'sweetie', 'cutie',
  // Genéricos / inventados / de prueba
  'anon', 'anonima', 'anonimo', 'anónima', 'anónimo', 'usuario', 'user', 'admin',
  'advisor', 'test', 'prueba', 'pruebas', 'name', 'nombre', 'demo', 'example',
  // Variaciones internet / dreamy
  'xoxo', 'dreamgirl', 'dreamy', 'fantasy', 'dream', 'angel', 'angelita', 'angelito',
  // Otros
  'love', 'amor', 'amorcito', 'corazon', 'corazón', 'cielo', 'cielito', 'vida', 'vidita'
]);

/**
 * Valida un nombre y devuelve { valido: bool, error: string|null, nombreLimpio: string }
 * @param {string} rawName - El nombre tal como lo envió el usuario
 */
function validarNombre(rawName) {
  if (typeof rawName !== 'string') {
    return { valido: false, error: 'El nombre es obligatorio.', nombreLimpio: '' };
  }

  // 1. Limpiar espacios extra (al inicio, fin, y dobles espacios)
  const nombreLimpio = rawName.trim().replace(/\s+/g, ' ');

  // 2. ¿Está vacío?
  if (!nombreLimpio) {
    return { valido: false, error: 'El nombre es obligatorio.', nombreLimpio: '' };
  }

  // 3. ¿Muy corto?
  if (nombreLimpio.length < 2) {
    return { valido: false, error: 'El nombre debe tener al menos 2 letras.', nombreLimpio };
  }

  // 4. ¿Muy largo?
  if (nombreLimpio.length > 40) {
    return { valido: false, error: 'El nombre es demasiado largo (máximo 40 caracteres).', nombreLimpio };
  }

  // 5. Solo letras, acentos, espacios, apóstrofes y guiones
  //    Permite: a-z, A-Z, áéíóúüñÁÉÍÓÚÜÑ, espacio, ', -
  //    Bloquea: números, emojis, @, #, $, _, etc.
  const regexValida = /^[a-zA-ZáéíóúüñÁÉÍÓÚÜÑ\s'\-]+$/;
  if (!regexValida.test(nombreLimpio)) {
    return {
      valido: false,
      error: 'El nombre solo puede contener letras, espacios, apóstrofes (\') y guiones (-). Sin números, emojis ni caracteres especiales.',
      nombreLimpio
    };
  }

  // 6. Debe tener al menos 2 letras reales (no solo guiones/apóstrofes/espacios)
  const soloLetras = nombreLimpio.replace(/[\s'\-]/g, '');
  if (soloLetras.length < 2) {
    return { valido: false, error: 'El nombre debe tener al menos 2 letras.', nombreLimpio };
  }

  // 7. Quitar acentos para comparar contra lista negra
  const sinAcentos = nombreLimpio
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  // 8. ¿El nombre COMPLETO está en la lista negra?
  if (PALABRAS_PROHIBIDAS.has(sinAcentos)) {
    return {
      valido: false,
      error: 'Por favor usa tu nombre real. Los apodos no están permitidos para advisors.',
      nombreLimpio
    };
  }

  // 9. ¿Alguna palabra individual está prohibida?
  //    (ejemplo: "Maria Chocolate" tiene "chocolate" prohibido)
  const palabras = sinAcentos.split(/[\s'\-]+/).filter(p => p.length > 0);
  for (const palabra of palabras) {
    if (PALABRAS_PROHIBIDAS.has(palabra)) {
      return {
        valido: false,
        error: `La palabra "${palabra}" no está permitida en el nombre. Usa tu nombre real.`,
        nombreLimpio
      };
    }
  }

  // ✅ Todo OK
  return { valido: true, error: null, nombreLimpio };
}

module.exports = { validarNombre };
