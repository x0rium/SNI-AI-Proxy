const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const path = require('path');
const fs = require('fs');

/**
 * Настраивает и возвращает экземпляр логгера Winston.
 * @param {object} logConfig - Объект конфигурации логирования из config.yaml.
 * @param {string} logConfig.log_dir - Директория для лог-файлов.
 * @param {string} logConfig.filename - Шаблон имени файла.
 * @param {string} logConfig.date_pattern - Формат даты для ротации.
 * @param {string} logConfig.max_size - Максимальный размер файла.
 * @param {string} logConfig.max_files - Максимальное количество дней хранения логов.
 * @param {string} logConfig.level - Уровень логирования.
 * @param {boolean} logConfig.zipped_archive - Сжимать ли старые логи.
 * @param {boolean} logConfig.log_to_console - Дублировать ли логи в консоль.
 * @returns {winston.Logger} - Настроенный экземпляр логгера.
 */
function setupLogger(logConfig) {
  const logDir = logConfig.log_dir || 'logs'; // По умолчанию 'logs'

  // Создаем директорию для логов, если она не существует
  if (!fs.existsSync(logDir)) {
    try {
      fs.mkdirSync(logDir, { recursive: true });
    } catch (error) {
      console.error(`[${new Date().toISOString()}] Не удалось создать директорию для логов ${logDir}:`, error);
      // В случае ошибки создания директории, логирование в файл будет невозможно,
      // но можно продолжить с логированием в консоль, если оно включено.
    }
  }

  // Формат для файла (JSON)
  const fileFormat = winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }), // Включаем стек трейс ошибок
    winston.format.splat(), // Позволяет использовать форматирование в стиле printf (%s, %d)
    winston.format.json()
  );

  // Формат для консоли (более читаемый)
  const consoleFormat = winston.format.combine(
    winston.format.colorize(),
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.printf(info => {
      // Удаляем стандартные поля, чтобы не дублировать их в JSON-части
      const { timestamp, level, message, stack, ...meta } = info;
      const metaString = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
      // Если есть stack, выводим его отдельно для лучшей читаемости
      const stackString = stack ? `\n${stack}` : '';
      return `${timestamp} ${level}: ${message} ${metaString}${stackString}`;
    })
  );

  const transports = [];

  // Транспорт для записи в файл с ротацией
  try {
    transports.push(new DailyRotateFile({
      filename: path.join(logDir, logConfig.filename || 'app-%DATE%.log'),
      datePattern: logConfig.date_pattern || 'YYYY-MM-DD',
      zippedArchive: logConfig.zipped_archive !== undefined ? logConfig.zipped_archive : true,
      maxSize: logConfig.max_size || '20m',
      maxFiles: logConfig.max_files || '14d',
      level: logConfig.level || 'info', // По умолчанию 'info'
      format: fileFormat,
      handleExceptions: true, // Логировать необработанные исключения
      handleRejections: true, // Логировать необработанные промисы
    }));
  } catch (error) {
      console.error(`[${new Date().toISOString()}] Не удалось создать транспорт DailyRotateFile:`, error);
  }


  // Транспорт для вывода в консоль
  if (logConfig.log_to_console !== false) { // По умолчанию true
    transports.push(new winston.transports.Console({
      level: logConfig.level || 'info',
      format: consoleFormat,
      handleExceptions: true,
      handleRejections: true,
    }));
  }

  // Создаем логгер
  const logger = winston.createLogger({
    level: logConfig.level || 'info', // Устанавливаем общий уровень
    transports: transports,
    exitOnError: false, // Не завершать процесс при ошибке логирования
  });

  // Добавляем метод для удобного логирования старта приложения
  logger.logAppStart = (port, socksHost, socksPort, routing) => {
      logger.info(`SNI Прокси запущен и слушает порт ${port}`);
      logger.info(`Исходящие соединения будут идти через SOCKS: ${socksHost}:${socksPort}`);
      logger.info('Конфигурация маршрутизации:', { routing });
  };

  // Добавляем метод для удобного логирования ошибки старта сервера
  logger.logServerError = (error, port) => {
      logger.error('Ошибка TCP сервера прокси', { error: { message: error.message, code: error.code, stack: error.stack } });
      if (error.code === 'EADDRINUSE') {
          logger.error(`Порт ${port} уже занят.`);
      }
      if (error.code === 'EACCES') {
          logger.error(`Нет прав для прослушивания порта ${port}. Попробуйте запустить с sudo или с правами администратора.`);
      }
  };


  logger.info('Логгер Winston успешно инициализирован.', { config: logConfig });

  return logger;
}

module.exports = { setupLogger };