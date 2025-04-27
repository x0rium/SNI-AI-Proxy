const net = require('net');
const { server: sniProxyServer, PROXY_PORT, SOCKS_PROXY_OPTIONS, routingConfig } = require('./index'); // Импортируем наш сервер

// --- Вспомогательная функция для создания фейкового ClientHello с SNI ---
function createFakeClientHello(servername) {
  const sniBytes = Buffer.from(servername, 'utf8');
  const sniExtensionLength = 5 + sniBytes.length; // type (2) + length (2) + list_length (2) + type (1) + name_length (2) + name
  const extensionsLength = 2 + 2 + sniExtensionLength; // extension_type (2) + extension_length (2) + sni_data
  const handshakeLength = 38 + 2 + 1 + 2 + extensionsLength; // fixed_part + session_id_len(1) + cipher_suites_len(2) + comp_methods_len(1) + extensions_len(2) + extensions
  const recordLength = 5 + handshakeLength; // type(1) + version(2) + length(2) + handshake_data

  const buffer = Buffer.alloc(5 + recordLength); // outer_type(1) + outer_version(2) + outer_length(2) + record_data

  let offset = 0;
  // TLS Record Layer
  buffer[offset++] = 0x16; // Content Type: Handshake (22)
  buffer.writeUInt16BE(0x0301, offset); offset += 2; // Version: TLS 1.0 (for compatibility)
  buffer.writeUInt16BE(recordLength, offset); offset += 2; // Length

  // Handshake Protocol
  buffer[offset++] = 0x01; // Handshake Type: ClientHello (1)
  buffer.writeUIntBE(handshakeLength, offset, 3); offset += 3; // Length (3 bytes)
  buffer.writeUInt16BE(0x0303, offset); offset += 2; // Version: TLS 1.2
  // Random (32 bytes) - заполним нулями для простоты
  offset += 32;
  // Session ID (0 length)
  buffer[offset++] = 0x00;
  // Cipher Suites (2 bytes length, 1 suite: TLS_NULL_WITH_NULL_NULL 0x0000)
  buffer.writeUInt16BE(0x0002, offset); offset += 2;
  buffer.writeUInt16BE(0x0000, offset); offset += 2;
  // Compression Methods (1 byte length, 1 method: null 0x00)
  buffer[offset++] = 0x01;
  buffer[offset++] = 0x00;
  // Extensions Length
  buffer.writeUInt16BE(extensionsLength, offset); offset += 2;
  // SNI Extension
  buffer.writeUInt16BE(0x0000, offset); offset += 2; // Extension Type: server_name (0)
  buffer.writeUInt16BE(sniExtensionLength, offset); offset += 2; // Length
  buffer.writeUInt16BE(sniExtensionLength - 2, offset); offset += 2; // Server Name list length
  buffer[offset++] = 0x00; // Server Name Type: host_name (0)
  buffer.writeUInt16BE(sniBytes.length, offset); offset += 2; // Server Name length
  sniBytes.copy(buffer, offset); offset += sniBytes.length;

  return buffer;
}


// --- Переменные для мок-серверов и соединений ---
let mockSocksServer;
let mockBackendServer;
const MOCK_SOCKS_PORT = SOCKS_PROXY_OPTIONS.port + 1; // Используем другой порт для мока SOCKS
const MOCK_BACKEND_HOST = '127.0.0.1'; // Бэкенд будет локальным
const TEST_PROXY_PORT = PROXY_PORT + 10000; // Используем другой порт для SNI Proxy в тестах
// Определяем порт для мок-бэкенда динамически, чтобы избежать конфликтов
let MOCK_BACKEND_PORT = 0;


// --- Флаги для проверки соединений в тестах ---
let socksConnectionReceived = false;
let backendConnectionReceived = false;
let receivedDataOnBackend = '';
let receivedDataOnClient = '';

// --- Настройка перед всеми тестами ---
beforeAll((done) => {
  let serversReady = 0;
  const totalServersToStart = 3; // SNI Proxy + Mock SOCKS + Mock Backend

  const checkAllReady = () => {
    serversReady++;
    if (serversReady === totalServersToStart) {
      console.log('[Test] Все серверы готовы.');
      done(); // Сообщаем Jest, что асинхронная настройка завершена
    }
  };

  // 1. Запускаем мок Backend сервера
  mockBackendServer = net.createServer((socket) => {
    console.log('[Test Mock Backend] Получено соединение!');
    backendConnectionReceived = true;
    socket.on('data', (data) => {
      console.log(`[Test Mock Backend] Получены данные: ${data.toString()}`);
      receivedDataOnBackend += data.toString();
      // Эхо ответ
      socket.write(`backend-echo:${data.toString()}`);
    });
    socket.on('end', () => {
      console.log('[Test Mock Backend] Соединение закрыто клиентом.');
    });
    socket.on('error', (err) => {
        console.error('[Test Mock Backend] Ошибка сокета:', err.message);
    });
  });
  mockBackendServer.listen(0, MOCK_BACKEND_HOST, () => { // Слушаем на порту 0 для автовыбора
      MOCK_BACKEND_PORT = mockBackendServer.address().port;
      console.log(`[Test Mock Backend] Запущен на ${MOCK_BACKEND_HOST}:${MOCK_BACKEND_PORT}`);
      // !!! ВАЖНО: Обновляем routingConfig для теста, чтобы он указывал на наш мок-бэкенд !!!
      routingConfig['openrouter.ai'] = { host: MOCK_BACKEND_HOST, port: MOCK_BACKEND_PORT };
      console.log('[Test] routingConfig обновлен для использования мок-бэкенда.');
      checkAllReady();
  });
   mockBackendServer.on('error', (err) => {
      console.error('[Test Mock Backend] Ошибка сервера:', err);
      done(err); // Прерываем настройку если мок не запустился
  });


  // 2. Запускаем мок SOCKS сервера
  mockSocksServer = net.createServer((socket) => {
    console.log('[Test Mock SOCKS] Получено соединение!');
    socksConnectionReceived = true;
    // Упрощенная имитация SOCKS5 handshake и connect
    socket.once('data', (data) => {
      // Ожидаем: \x05\x01\x00 (предложение метода аутентификации)
      console.log('[Test Mock SOCKS] Получен запрос на аутентификацию.');
      socket.write(Buffer.from([0x05, 0x00])); // Отвечаем: \x05\x00 (выбран метод "без аутентификации")

      socket.once('data', (data) => {
        // Парсим SOCKS5 CONNECT запрос
        // +----+-----+-------+------+----------+----------+
        // |VER | CMD |  RSV  | ATYP | DST.ADDR | DST.PORT |
        // +----+-----+-------+------+----------+----------+
        // | 1  |  1  | X'00' |  1   | Variable |    2     |
        // +----+-----+-------+------+----------+----------+
        if (data.length < 7) { // Минимальная длина (IPv4)
            console.error('[Test Mock SOCKS] Запрос CONNECT слишком короткий.');
            socket.destroy();
            return;
        }
        const version = data[0];
        const command = data[1];
        const addressType = data[3];

        if (version !== 0x05 || command !== 0x01) {
            console.error('[Test Mock SOCKS] Неверная версия или команда SOCKS.');
            socket.destroy();
            return;
        }

        let requestedHost = '';
        let requestedPort = 0;
        let portOffset = -1;

        try {
            if (addressType === 0x01) { // IPv4
                if (data.length < 10) throw new Error('Недостаточно данных для IPv4 адреса и порта');
                requestedHost = `${data[4]}.${data[5]}.${data[6]}.${data[7]}`;
                portOffset = 8;
            } else if (addressType === 0x03) { // Domain Name
                const domainLength = data[4];
                if (data.length < 5 + domainLength + 2) throw new Error('Недостаточно данных для доменного имени и порта');
                requestedHost = data.slice(5, 5 + domainLength).toString('utf8');
                portOffset = 5 + domainLength;
            } else if (addressType === 0x04) { // IPv6
                 if (data.length < 22) throw new Error('Недостаточно данных для IPv6 адреса и порта');
                 // Упрощенно: не парсим IPv6 для этого теста, просто логируем
                 console.log('[Test Mock SOCKS] Получен IPv6 адрес (не парсим детально).');
                 requestedHost = '::1'; // Примерное значение
                 portOffset = 20;
            } else {
                throw new Error(`Неподдерживаемый тип адреса: ${addressType}`);
            }

            requestedPort = data.readUInt16BE(portOffset);
            console.log(`[Test Mock SOCKS] Получен запрос CONNECT к [${requestedHost}]:${requestedPort} (Тип адреса: ${addressType})`);

        } catch (e) {
             console.error(`[Test Mock SOCKS] Ошибка парсинга запроса CONNECT: ${e.message}`);
             socket.destroy();
             return;
        }


        if (requestedHost === MOCK_BACKEND_HOST && requestedPort === MOCK_BACKEND_PORT) {
          console.log('[Test Mock SOCKS] Запрос корректный. Имитируем успех и соединение с бэкендом.');
          // Отвечаем успехом SOCKS
          socket.write(Buffer.from([0x05, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]));

          // Имитируем соединение с бэкендом (в реальности тут был бы net.connect)
          // Для теста просто передаем данные напрямую
          const backendConnection = net.connect(MOCK_BACKEND_PORT, MOCK_BACKEND_HOST, () => {
              console.log('[Test Mock SOCKS] "Подключились" к мок-бэкенду.');
              // Связываем сокет от SNI-прокси и сокет к мок-бэкенду
              socket.pipe(backendConnection);
              backendConnection.pipe(socket);
          });
          backendConnection.on('error', (err) => {
              console.error('[Test Mock SOCKS] Ошибка при "подключении" к мок-бэкенду:', err.message);
              socket.destroy(); // Закрываем соединение от SNI-прокси при ошибке
          });
           socket.on('error', (err) => { // Обработка ошибок сокета от SNI-прокси
               console.error('[Test Mock SOCKS] Ошибка сокета от SNI-прокси:', err.message);
               if (backendConnection && !backendConnection.destroyed) backendConnection.destroy();
           });
           socket.on('close', () => {
                if (backendConnection && !backendConnection.destroyed) backendConnection.destroy();
           });


        } else {
          console.error(`[Test Mock SOCKS] Неверный запрос CONNECT: ожидался ${MOCK_BACKEND_HOST}:${MOCK_BACKEND_PORT}, получен ${requestedHost}:${requestedPort}`);
          socket.destroy(); // Закрываем соединение при неверном запросе
        }
      });
    });
     socket.on('error', (err) => {
        console.error('[Test Mock SOCKS] Ошибка сокета:', err.message);
    });
  });
  mockSocksServer.listen(MOCK_SOCKS_PORT, () => {
    console.log(`[Test Mock SOCKS] Запущен на порту ${MOCK_SOCKS_PORT}`);
    // !!! ВАЖНО: Обновляем SOCKS_PROXY_OPTIONS для теста !!!
    SOCKS_PROXY_OPTIONS.port = MOCK_SOCKS_PORT;
    SOCKS_PROXY_OPTIONS.host = '127.0.0.1'; // Указываем localhost для мока
    console.log('[Test] SOCKS_PROXY_OPTIONS обновлены для использования мок-SOCKS.');
    checkAllReady();
  });
   mockSocksServer.on('error', (err) => {
      console.error('[Test Mock SOCKS] Ошибка сервера:', err);
      done(err); // Прерываем настройку если мок не запустился
  });


  // 3. Запускаем наш SNI прокси сервер (после настройки моков) НА ТЕСТОВОМ ПОРТУ
  sniProxyServer.listen(TEST_PROXY_PORT, () => {
    console.log(`[Test] SNI Proxy запущен на тестовом порту ${TEST_PROXY_PORT}`);
    checkAllReady();
  });
  sniProxyServer.on('error', (err) => { // Обработка ошибок запуска для тестов
      console.error('[Test] Ошибка запуска SNI Proxy:', err);
      done(err); // Прерываем настройку если SNI Proxy не запустился
  });
});

// --- Очистка после всех тестов ---
afterAll((done) => {
  let closedCount = 0;
  const totalServers = 3; // SNI Proxy + Mock SOCKS + Mock Backend

  const checkDone = (serverName, err) => {
      if (err) console.error(`[Test] Ошибка остановки ${serverName}:`, err);
      else console.log(`[Test] ${serverName} остановлен.`);
      closedCount++;
      if (closedCount === totalServers) {
          console.log('[Test] Все серверы остановлены.');
          done();
      }
  };

  // Останавливаем наш SNI прокси сервер
  if (sniProxyServer && sniProxyServer.listening) {
      sniProxyServer.close((err) => checkDone('SNI Proxy', err));
  } else {
      checkDone('SNI Proxy (not listening)', null);
  }

  // Останавливаем мок SOCKS сервера
  if (mockSocksServer && mockSocksServer.listening) {
      mockSocksServer.close((err) => checkDone('Mock SOCKS', err));
  } else {
      checkDone('Mock SOCKS (not listening)', null);
  }

  // Останавливаем мок Backend сервера
  if (mockBackendServer && mockBackendServer.listening) {
      mockBackendServer.close((err) => checkDone('Mock Backend', err));
  } else {
      checkDone('Mock Backend (not listening)', null);
  }
});

// --- Сброс состояния перед каждым тестом ---
beforeEach(() => {
    socksConnectionReceived = false;
    backendConnectionReceived = false;
    receivedDataOnBackend = '';
    receivedDataOnClient = '';
});


// --- Тестовый сценарий ---
describe('SNI Proxy Integration Test', () => {
  // Увеличиваем таймаут для интеграционного теста
  jest.setTimeout(10000); // 10 секунд

  test('should proxy TCP connection with SNI hint via SOCKS and exchange data', (done) => {
    const targetSni = 'openrouter.ai';
    const testDataClient = 'hello from client';
    const expectedDataOnBackend = testDataClient; // Ожидаем получить именно эти данные
    const expectedDataOnClient = `backend-echo:${testDataClient}`; // Ожидаем эхо от мок-бэкенда

    const clientOptions = {
      host: '127.0.0.1', // Подключаемся к нашему локальному прокси
      port: TEST_PROXY_PORT, // Используем ТЕСТОВЫЙ порт
    };

    // 1. Подключаемся к SNI прокси через TCP
    const client = net.connect(clientOptions, () => {
      console.log('[Test Client] TCP соединение установлено.');

      // 2. Отправляем фейковый ClientHello с SNI
      const fakeHello = createFakeClientHello(targetSni);
      console.log(`[Test Client] Отправка фейкового ClientHello с SNI: ${targetSni} (размер: ${fakeHello.length})`);
      client.write(fakeHello);

      // 3. Отправляем тестовые данные (после небольшой паузы, чтобы прокси успел среагировать)
      setTimeout(() => {
          console.log(`[Test Client] Отправка данных: ${testDataClient}`);
          client.write(testDataClient);
      }, 100); // Небольшая задержка
    });

    client.on('data', (data) => {
      console.log(`[Test Client] Получены данные: ${data.toString()}`);
      receivedDataOnClient += data.toString();

      // 5. Проверяем полученные данные от бэкенда
      if (receivedDataOnClient.includes(expectedDataOnClient)) {
          console.log('[Test Client] Ожидаемые данные от бэкенда получены.');

          // Проверяем флаги соединений
          expect(socksConnectionReceived).toBe(true);
          expect(backendConnectionReceived).toBe(true);
          // Проверяем данные на бэкенде (должны содержать наши тестовые данные, т.к. фейковый ClientHello не должен дойти)
          expect(receivedDataOnBackend).toContain(expectedDataOnBackend);
          expect(receivedDataOnBackend).not.toContain('ClientHello'); // Убедимся, что ClientHello не просочился
          // Проверяем данные на клиенте
          expect(receivedDataOnClient).toContain(expectedDataOnClient);

          client.end(); // Завершаем соединение
          done(); // Завершаем тест успешно
      }
    });

    client.on('error', (err) => {
      console.error('[Test Client] Ошибка TCP клиента:', err);
      done(err); // Провалить тест при ошибке клиента
    });

    client.on('end', () => {
      console.log('[Test Client] Соединение закрыто (END).');
    });

     client.on('close', (hadError) => {
         console.log(`[Test Client] Соединение закрыто (CLOSE). Была ошибка: ${hadError}`);
         clearTimeout(timeout); // Очищаем таймаут при закрытии
     });

     // Дополнительная проверка через таймаут, если что-то пошло не так
     const timeout = setTimeout(() => {
         done(new Error('Тест не завершился вовремя. Проверьте логи мок-серверов.'));
         client.destroy();
     }, 8000); // 8 секунд

  });

  test('should close connection for unknown SNI', (done) => {
    const targetSni = 'unknown.domain.com'; // SNI, которого нет в конфиге

    const clientOptions = {
      host: '127.0.0.1',
      port: TEST_PROXY_PORT,
    };

    const client = net.connect(clientOptions, () => {
      console.log('[Test Client Unknown SNI] TCP соединение установлено.');
      const fakeHello = createFakeClientHello(targetSni);
      console.log(`[Test Client Unknown SNI] Отправка фейкового ClientHello с SNI: ${targetSni}`);
      client.write(fakeHello);
    });

    client.on('data', (data) => {
      // Не должны получать данные в этом сценарии
      done(new Error('Получены неожиданные данные при неизвестном SNI'));
    });

    client.on('error', (err) => {
      // Ошибки могут быть, но нас интересует закрытие
      console.log(`[Test Client Unknown SNI] Ошибка клиента (ожидаемо?): ${err.message}`);
    });

    client.on('close', (hadError) => {
      console.log(`[Test Client Unknown SNI] Соединение закрыто. Была ошибка: ${hadError}`);
      // Убедимся, что соединение с SOCKS и бэкендом не устанавливалось
      expect(socksConnectionReceived).toBe(false);
      expect(backendConnectionReceived).toBe(false);
      done(); // Тест пройден, если соединение закрылось
    });

    // Таймаут на случай, если соединение не закроется
    const timeout = setTimeout(() => {
        done(new Error('Тест Unknown SNI не завершился вовремя (соединение не закрылось).'));
        client.destroy();
    }, 3000); // 3 секунды

    client.on('close', () => clearTimeout(timeout));
  });

  test('should close connection for non-ClientHello initial data (no SNI)', (done) => {
    const clientOptions = {
      host: '127.0.0.1',
      port: TEST_PROXY_PORT,
    };

    const client = net.connect(clientOptions, () => {
      console.log('[Test Client No SNI] TCP соединение установлено.');
      const nonHelloData = Buffer.from('this is not a client hello');
      console.log(`[Test Client No SNI] Отправка данных, не являющихся ClientHello.`);
      client.write(nonHelloData);
    });

     client.on('data', (data) => {
      // Не должны получать данные
      done(new Error('Получены неожиданные данные при отсутствии SNI'));
    });

    client.on('error', (err) => {
       console.log(`[Test Client No SNI] Ошибка клиента (ожидаемо?): ${err.message}`);
    });

    client.on('close', (hadError) => {
      console.log(`[Test Client No SNI] Соединение закрыто. Была ошибка: ${hadError}`);
      expect(socksConnectionReceived).toBe(false);
      expect(backendConnectionReceived).toBe(false);
      done(); // Тест пройден
    });

     // Таймаут
    const timeout = setTimeout(() => {
        done(new Error('Тест No SNI не завершился вовремя (соединение не закрылось).'));
        client.destroy();
    }, 3000); // 3 секунды

    client.on('close', () => clearTimeout(timeout));
  });


  // TODO: Добавить тесты для ошибок SOCKS и т.д.
});