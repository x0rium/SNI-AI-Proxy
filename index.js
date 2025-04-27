const fs = require('fs');
const yaml = require('js-yaml');
const net = require('net');
const tls = require('tls');
const { SocksClient } = require('socks'); // <--- Импортируем клиент SOCKS
const sni = require('sni'); // Импортируем пакет sni
const { setupLogger } = require('./logger'); // <-- Импортируем настройщик логгера

// --- ЗАГРУЗКА КОНФИГУРАЦИИ ---
let config;
let logger; // <-- Объявляем переменную для логгера
try {
  const configFile = fs.readFileSync('config.yaml', 'utf8');
  config = yaml.load(configFile);
  // Добавляем проверку наличия секции logging
  if (!config || !config.socks_proxy || !config.routing || typeof config.proxy_port !== 'number' || !config.logging) {
      throw new Error("Неполная или некорректная структура конфигурационного файла config.yaml (отсутствуют socks_proxy, routing, proxy_port или logging)");
  }
  // --- ИНИЦИАЛИЗАЦИЯ ЛОГГЕРА ---
  logger = setupLogger(config.logging); // <-- Инициализируем логгер
  logger.info('Конфигурация успешно загружена из config.yaml');
} catch (e) {
  // Логгер еще не инициализирован, используем console.error
  console.error(`[${new Date().toISOString()}] КРИТИЧЕСКАЯ ОШИБКА: Ошибка загрузки, парсинга config.yaml или инициализации логгера:`, e.message);
  if (e.stack) console.error(e.stack);
  process.exit(1); // Выход, если конфигурация не загружена или логгер не создан
}
// --------------------------

// Конфигурация загружается из config.yaml

const server = net.createServer(clientSocket => {
  const clientIp = clientSocket.remoteAddress;
  const clientPort = clientSocket.remotePort;
  const connectionId = `${clientIp}:${clientPort}-${Date.now()}`; // Уникальный ID для связи логов одного соединения
  logger.info(`Клиент подключился`, { connectionId, clientIp, clientPort });

  let backendSocket = null;
  let targetInfo = null;
  let servername = null; // Выносим для использования в логах ошибок

  // Делаем колбэк асинхронным, чтобы использовать await для SOCKS
  clientSocket.once('data', async (initialChunk) => { // <--- Добавили async
    // servername объявлен выше

    try {
        // @ts-ignore - Оставляем на всякий случай
        servername = sni(initialChunk); // Используем пакет sni
        logger.debug('Попытка извлечения SNI', { connectionId, clientIp, packetSize: initialChunk.length });
        if (servername) {
             logger.debug(`Извлечен SNI: ${servername}`, { connectionId, clientIp, servername });
        } else {
             // Пакет sni вернул null или пустую строку (SNI не найден)
             logger.warn(`Пакет от клиента не содержит SNI. Закрытие соединения.`, { connectionId, clientIp, packetSize: initialChunk.length });
             clientSocket.destroy();
             return;
        }
    } catch (e) {
        // Пакет sni может выбросить исключение, если пакет не ClientHello
        logger.error(`Ошибка при извлечении SNI пакетом 'sni'. Возможно, это не TLS ClientHello.`, {
            connectionId,
            clientIp,
            packetSize: initialChunk.length,
            error: { message: e.message, stack: e.stack }
        });
        clientSocket.destroy();
        return;
    }

    // servername точно не null здесь
    servername = servername.toLowerCase();
    logger.info(`SNI получен: ${servername}`, { connectionId, clientIp, servername });

    targetInfo = config.routing[servername];

    if (!targetInfo) {
      logger.warn(`Нет конфигурации маршрутизации для SNI "${servername}". Закрытие соединения.`, { connectionId, clientIp, servername });
      clientSocket.destroy();
      return;
    }

    logger.info(`Маршрутизация ${servername} -> ${targetInfo.host}:${targetInfo.port}`, {
        connectionId,
        clientIp,
        servername,
        targetHost: targetInfo.host,
        targetPort: targetInfo.port,
        socksHost: config.socks_proxy.host,
        socksPort: config.socks_proxy.port
    });

    clientSocket.pause(); // Ставим на паузу, пока устанавливаем соединение
    logger.debug('Клиентский сокет поставлен на паузу перед подключением к SOCKS', { connectionId, clientIp });

    try {
      logger.debug(`Попытка подключения к SOCKS прокси`, {
          connectionId,
          clientIp,
          servername,
          targetHost: targetInfo.host,
          targetPort: targetInfo.port,
          socksHost: config.socks_proxy.host,
          socksPort: config.socks_proxy.port
      });

      // --- ИЗМЕНЕНИЕ ЗДЕСЬ: Используем SocksClient ---
      const socksInfo = await SocksClient.createConnection({
        proxy: {
          host: config.socks_proxy.host,
          port: config.socks_proxy.port,
          type: config.socks_proxy.type,
          userId: config.socks_proxy.userId, // Будет undefined если не задано
          password: config.socks_proxy.password // Будет undefined если не задано
        },
        command: 'connect', // Команда TCP connect для SOCKS
        destination: {
          host: targetInfo.host, // Конечный хост (из SNI)
          port: targetInfo.port  // Конечный порт (из SNI)
        }
      });
      // -----------------------------------------------

      backendSocket = socksInfo.socket; // Получаем сокет, установленный через SOCKS
      logger.info(`Успешно подключились к бэкенду через SOCKS`, {
          connectionId,
          clientIp,
          servername,
          targetHost: targetInfo.host,
          targetPort: targetInfo.port,
          socksHost: config.socks_proxy.host,
          socksPort: config.socks_proxy.port
      });

      // --- Дальнейшая логика остается почти такой же ---

      // Отправляем исходный пакет ClientHello на бэкенд, он необходим!
      logger.debug(`Отправляем initialChunk (${initialChunk.length} байт) бэкенду`, { connectionId, clientIp, servername, targetHost: targetInfo.host, targetPort: targetInfo.port });
      backendSocket.write(initialChunk);

      // Ждем первый ответ от бэкенда (ServerHello и т.д.)
      backendSocket.once('data', (firstBackendChunk) => {
        logger.debug(`Получен первый пакет от бэкенда (${firstBackendChunk.length} байт), пересылаем клиенту`, { connectionId, clientIp, servername, targetHost: targetInfo.host, targetPort: targetInfo.port });
        // Отправляем первый пакет от бэкенда клиенту
        if (!clientSocket.destroyed) { // Проверка перед записью
             clientSocket.write(firstBackendChunk);
        } else {
             logger.warn(`Клиентский сокет уже закрыт, не можем отправить первый пакет от бэкенда`, { connectionId, clientIp, servername, targetHost: targetInfo.host, targetPort: targetInfo.port });
             if (backendSocket && !backendSocket.destroyed) backendSocket.destroy();
             return;
        }

        // Теперь, когда начальный обмен произошел, настраиваем "проброс"
        logger.debug(`Настраиваем pipe для дальнейшей передачи данных`, { connectionId, clientIp, servername, targetHost: targetInfo.host, targetPort: targetInfo.port });
        // Проверяем сокеты перед пайпом
        if (!clientSocket.destroyed && !backendSocket.destroyed) {
            clientSocket.pipe(backendSocket);
            backendSocket.pipe(clientSocket);
            logger.debug(`Pipe настроен успешно`, { connectionId, clientIp, servername, targetHost: targetInfo.host, targetPort: targetInfo.port });
        } else {
             logger.warn(`Не можем настроить pipe, один из сокетов закрыт`, { connectionId, clientIp, servername, targetHost: targetInfo.host, targetPort: targetInfo.port, clientDestroyed: clientSocket.destroyed, backendDestroyed: backendSocket.destroyed });
             if (!clientSocket.destroyed) clientSocket.destroy();
             if (backendSocket && !backendSocket.destroyed) backendSocket.destroy();
             return;
        }

        // Возобновляем чтение из клиентского сокета ПОСЛЕ отправки первого ответа бэкенда
        if (!clientSocket.destroyed) {
            logger.debug(`Возобновляем клиентский сокет`, { connectionId, clientIp });
            clientSocket.resume();
        } else {
             logger.warn(`Клиентский сокет закрыт, не можем возобновить`, { connectionId, clientIp });
        }
      });

      // НЕ возобновляем клиентский сокет здесь, ждем первого ответа от бэкенда

      // --- Обработчики событий для backendSocket (сокета, полученного от SOCKS) ---
      backendSocket.on('error', (err) => {
        logger.error(`Ошибка сокета бэкенда (через SOCKS)`, {
            connectionId,
            clientIp,
            servername,
            targetHost: targetInfo?.host,
            targetPort: targetInfo?.port,
            error: { message: err.message, stack: err.stack, code: err.code }
        });
        if (clientSocket && !clientSocket.destroyed) clientSocket.destroy();
        if (backendSocket && !backendSocket.destroyed) backendSocket.destroy();
      });

      backendSocket.on('end', () => {
        logger.info(`Бэкенд (через SOCKS) закрыл соединение (END)`, { connectionId, clientIp, servername, targetHost: targetInfo?.host, targetPort: targetInfo?.port });
        // Клиентский сокет закроется автоматически через pipe
      });

      backendSocket.on('close', (hadError) => {
        logger.info(`Соединение с бэкендом (через SOCKS) закрыто (CLOSE)`, { connectionId, clientIp, servername, targetHost: targetInfo?.host, targetPort: targetInfo?.port, hadError });
        if (clientSocket && !clientSocket.destroyed) {
           clientSocket.destroy(); // Убедимся, что клиент тоже закрыт
        }
      });
      // -------------------------------------------------------------------------

      // Возобновляем чтение из клиентского сокета - УБРАНО, т.к. делается после получения первого ответа

    } catch (err) {
      // Ошибка при подключении через SOCKS прокси
      logger.error(`Ошибка подключения через SOCKS`, {
          connectionId,
          clientIp,
          servername, // servername здесь определен
          targetHost: targetInfo?.host, // targetInfo может быть не определен, если ошибка до его присвоения, но в данном блоке он должен быть
          targetPort: targetInfo?.port,
          socksHost: config.socks_proxy.host,
          socksPort: config.socks_proxy.port,
          error: { message: err.message, stack: err.stack, code: err.code } // Добавляем stack и code
      });
      if (clientSocket && !clientSocket.destroyed) clientSocket.destroy(); // Закрываем клиентское соединение
    }
  });

  // --- Обработка ошибок и закрытия для КЛИЕНТСКОГО сокета ---
  clientSocket.on('error', (err) => {
    logger.error(`Ошибка клиентского сокета`, {
        connectionId,
        clientIp,
        clientPort,
        servername, // Может быть null, если ошибка до извлечения SNI
        error: { message: err.message, stack: err.stack, code: err.code }
    });
    if (backendSocket && !backendSocket.destroyed) {
      backendSocket.destroy();
    }
     if (clientSocket && !clientSocket.destroyed) {
         clientSocket.destroy();
     }
  });

  clientSocket.on('end', () => {
    logger.info(`Клиент закрыл соединение (END)`, { connectionId, clientIp, clientPort, servername });
    // Бэкенд сокет закроется автоматически через pipe
  });

  clientSocket.on('close', (hadError) => {
    logger.info(`Соединение с клиентом закрыто (CLOSE)`, { connectionId, clientIp, clientPort, servername, hadError });
    if (backendSocket && !backendSocket.destroyed) {
      backendSocket.destroy(); // Убедимся, что бэкенд тоже закрыт
    }
  });
});

server.on('error', (err) => {
  // Используем специальный метод логгера
  logger.logServerError(err, config.proxy_port);
});

// Запускаем сервер только если файл запущен напрямую
if (require.main === module) {
  server.listen({
    host: '0.0.0.0',
    port: config.proxy_port,
    exclusive: true, // Оставляем exclusive для предотвращения запуска нескольких экземпляров на одном порту
  }, () => { // Убираем второй аргумент port из listen callback, он не нужен
    // Используем специальный метод логгера
    logger.logAppStart(config.proxy_port, config.socks_proxy.host, config.socks_proxy.port, config.routing);
  });
}

// Экспортируем для тестов (логгер не экспортируем, он инициализируется при запуске)
module.exports = {
  server, // Экспортируем сам сервер
  config  // Экспортируем весь объект конфигурации
};