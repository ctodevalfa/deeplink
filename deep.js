/**
 * sbpDeepLinks.js – главный файл для обратной совместимости
 * Теперь вся логика разделена по модулям в папке src/
 */

// Экспортируем все из нового модульного файла
export { generateDeepLinks, generateDesktopLink } from './src/core/deeplinks.js?v=20241225';
export { default } from './src/core/deeplinks.js?v=20241225';
  