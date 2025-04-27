# План Внедрения Системы Логирования

**Задача:** Заменить текущее логирование через `console.log`/`console.error` на более надежную систему с использованием библиотеки `winston`, записью в файлы в формате JSON, ротацией по размеру и конфигурацией через `config.yaml`.

**Требования:**
*   **Библиотека:** `winston` + `winston-daily-rotate-file`
*   **Уровни:** `debug`, `info`, `warn`, `error`
*   **Формат:** JSON
*   **Ротация:** По достижении размера 20MB (`max_size: '20m'`), хранить логи 14 дней (`max_files: '14d'`), сжимать старые (`zipped_archive: true`).
*   **Расположение:** Папка `logs/`
*   **Именование:** `app-%DATE%.log` с паттерном `YYYY-MM-DD`.
*   **Конфигурация:** В файле `config.yaml` в секции `logging`.
*   **Консоль:** Дублировать логи в консоль (`log_to_console: true`).

**План Действий:**

1.  **Установка Зависимостей:**
    *   Добавить `winston` и `winston-daily-rotate-file` в секцию `dependencies` файла `package.json`.
    *   Выполнить команду `pnpm install` (или `npm install`) для установки новых пакетов.

2.  **Обновление `config.yaml`:**
    *   Добавить новую секцию `logging` в `config.yaml`:
        ```yaml
        # ... (существующая конфигурация) ...

        logging:
          log_dir: 'logs'          # Директория для лог-файлов
          filename: 'app-%DATE%.log' # Шаблон имени файла (%DATE% будет заменен)
          date_pattern: 'YYYY-MM-DD' # Формат даты для ротации и имени файла
          max_size: '20m'          # Максимальный размер файла перед ротацией (20MB)
          max_files: '14d'         # Хранить логи за последние 14 дней
          level: 'debug'           # Уровень логирования (debug, info, warn, error)
          zipped_archive: true     # Сжимать старые лог-файлы в gzip
          log_to_console: true     # Дублировать логи в консоль (true/false)
        ```

3.  **Создание Модуля Логгера (`logger.js`):**
    *   Создать новый файл `logger.js` в корне проекта.
    *   Реализовать в нем логику инициализации и конфигурации логгера `winston`:
        *   Импортировать `winston`, `winston.transports`, `winston.format`, `winstonDailyRotateFile`, `path`, `fs`.
        *   Создать функцию `setupLogger(logConfig)`, которая принимает конфигурацию логирования.
        *   Внутри функции:
            *   Проверить и создать директорию `logConfig.log_dir`, если она не существует (`fs.mkdirSync(..., { recursive: true })`).
            *   Настроить формат логов: JSON с временной меткой (`winston.format.combine(winston.format.timestamp(), winston.format.json())`).
            *   Создать транспорт `DailyRotateFile`:
                *   `filename`: `path.join(logConfig.log_dir, logConfig.filename)`
                *   `datePattern`: `logConfig.date_pattern`
                *   `zippedArchive`: `logConfig.zipped_archive`
                *   `maxSize`: `logConfig.max_size`
                *   `maxFiles`: `logConfig.max_files`
                *   `level`: `logConfig.level`
                *   `format`: Настроенный JSON формат.
            *   Создать транспорт `Console` (если `logConfig.log_to_console` равно `true`):
                *   `level`: `logConfig.level`
                *   `format`: Использовать более читаемый формат для консоли, например, `winston.format.combine(winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), winston.format.colorize(), winston.format.printf(info => \`\${info.timestamp} \${info.level}: \${info.message} \${ JSON.stringify(Object.assign({}, info, { level: undefined, message: undefined, timestamp: undefined, service: undefined }), null, 2) || '' }\`))`.
            *   Создать экземпляр логгера `winston.createLogger` с настроенными транспортами и уровнем.
        *   Экспортировать функцию `setupLogger`.

4.  **Интеграция Логгера в `index.js`:**
    *   Импортировать функцию `setupLogger` из `./logger.js`.
    *   После загрузки конфигурации из `config.yaml` (в блоке `try...catch`), вызвать `setupLogger`, передав ей `config.logging`.
    *   Сохранить возвращенный экземпляр логгера в переменную (например, `const logger = setupLogger(config.logging);`).
    *   Заменить все вызовы `console.log`, `console.info`, `console.warn`, `console.error` на соответствующие методы логгера: `logger.info`, `logger.info`, `logger.warn`, `logger.error`. Использовать `logger.debug` для отладочных сообщений.
    *   **Важно:** Передавать данные в логгер как объекты для корректной JSON-сериализации. Например: `logger.error('Описание ошибки', { error: { message: err.message, stack: err.stack, code: err.code }, client: clientSocket.remoteAddress });`.

5.  **Обновление `.gitignore` (Рекомендуется):**
    *   Добавить строку `logs/` в файл `.gitignore`.

**Визуализация Плана (Mermaid):**

```mermaid
graph TD
    subgraph "Этап 1: Подготовка"
        A[Установить winston, winston-daily-rotate-file] --> B[Обновить package.json];
        B --> C[Запустить npm/pnpm install];
        D[Добавить секцию 'logging' в config.yaml];
    end

    subgraph "Этап 2: Создание Логгера"
        E[Создать logger.js] --> F[Импорты (winston, path, fs)];
        F --> G[Функция setupLogger(logConfig)];
        G --> H[Создать директорию логов];
        H --> I[Настроить формат JSON для файла];
        I --> J[Настроить транспорт DailyRotateFile];
        J --> K[Настроить формат для консоли];
        K --> L[Настроить транспорт Console (опционально)];
        L --> M[Создать winston.createLogger];
        M --> N[Экспортировать setupLogger];
    end

    subgraph "Этап 3: Интеграция"
        O[index.js: Импорт setupLogger] --> P[index.js: Загрузка config.yaml];
        P --> Q[index.js: Вызов logger = setupLogger(config.logging)];
        Q --> R[index.js: Замена console.* на logger.*];
    end

    subgraph "Этап 4: Завершение"
        S[Добавить logs/ в .gitignore];
        T[Тестирование: запуск, проверка файлов, ротации];
    end

    C --> E;
    D --> P;
    N --> O;
    R --> T;
    S --> T;