# SNI AI Proxy

## Описание

Простой SNI-прокси для маршрутизации TLS-соединений через SOCKS5 на основе имени сервера, указанного в ClientHello.

## English

### Use Cases

This SNI proxy can be useful in various scenarios, particularly those involving AI services and development workflows:

*   **AI Endpoint Routing:** Route requests to specific AI model endpoints based on the requested domain name. For example, direct traffic for `model-a.ai.internal` through one SOCKS5 proxy and traffic for `model-b.ai.internal` through another, or bypass the proxy entirely for certain domains.
*   **Geo-restriction Bypass:** Access AI services or APIs that are geographically restricted by routing traffic through a SOCKS5 proxy located in an allowed region.
*   **Development &amp; Testing Isolation:** Isolate traffic during AI application development and testing by directing it through a dedicated SOCKS5 proxy. This allows for easier monitoring, debugging, or simulation of specific network conditions.
*   **Version Access Control:** Manage access to different deployment stages of AI services (e.g., staging, production) by routing connections based on the SNI hostname provided in the TLS handshake.

### Disclaimer

**Important:** This SNI proxy is designed primarily for development, testing, or specific low-traffic use cases where simplicity is prioritized. It is **not engineered for and not recommended for** high-traffic production environments. Its simple design lacks advanced features crucial for production deployments, such as load balancing, high availability, advanced security measures, and comprehensive performance optimizations. Use in production settings is at your own risk.

---

## Русский (Russian)

### Примеры использования

Этот SNI-прокси может быть полезен в различных сценариях, особенно связанных с AI-сервисами и процессами разработки:

*   **Маршрутизация к эндпоинтам AI:** Маршрутизация запросов к определенным эндпоинтам AI-моделей на основе запрошенного доменного имени. Например, направление трафика для `model-a.ai.internal` через один SOCKS5-прокси, а трафика для `model-b.ai.internal` через другой, или обход прокси для определенных доменов.
*   **Обход геоблокировок:** Доступ к AI-сервисам или API, ограниченным географически, путем маршрутизации трафика через SOCKS5-прокси, расположенный в разрешенном регионе.
*   **Изоляция при разработке и тестировании:** Изоляция трафика во время разработки и тестирования AI-приложений путем его направления через выделенный SOCKS5-прокси. Это упрощает мониторинг, отладку или симуляцию специфических сетевых условий.
*   **Управление доступом к версиям:** Управление доступом к различным версиям развертывания AI-сервисов (например, staging, production) путем маршрутизации соединений на основе имени хоста SNI, указанного в TLS-рукопожатии.

### Ограничения использования

**Важно:** Этот SNI-прокси разработан в первую очередь для разработки, тестирования или специфических сценариев с низкой нагрузкой, где важна простота. Он **не спроектирован и не рекомендуется** для использования в высоконагруженных продакшн-средах. Его простая архитектура не включает продвинутые функции, критически важные для продакшн-развертываний, такие как балансировка нагрузки, высокая доступность, расширенные меры безопасности и комплексная оптимизация производительности. Использование в продакшн-средах осуществляется на ваш страх и риск.

---

## 简体中文 (Simplified Chinese)

### 用例

此 SNI 代理在各种场景中都可能有用，尤其是在涉及 AI 服务和开发工作流的场景中：

*   **AI 端点路由：** 根据请求的域名将请求路由到特定的 AI 模型端点。例如，将 `model-a.ai.internal` 的流量通过一个 SOCKS5 代理定向，将 `model-b.ai.internal` 的流量通过另一个代理定向，或者对某些域完全绕过代理。
*   **绕过地理限制：** 通过位于允许区域的 SOCKS5 代理路由流量，访问受地理限制的 AI 服务或 API。
*   **开发与测试隔离：** 在 AI 应用程序开发和测试期间，通过将流量定向到专用的 SOCKS5 代理来隔离流量。这有助于简化监控、调试或模拟特定的网络条件。
*   **版本访问控制：** 通过基于 TLS 握手中提供的 SNI 主机名路由连接，管理对 AI 服务不同部署阶段（例如，预发布、生产）的访问。

### 免责声明

**重要提示：** 此 SNI 代理主要设计用于开发、测试或优先考虑简单性的特定低流量用例。它**并非为高流量生产环境设计，也不推荐**用于此类环境。其简单的设计缺乏生产部署所必需的高级功能，例如负载均衡、高可用性、高级安全措施和全面的性能优化。在生产环境中使用需自行承担风险。

---
## Important Notes

For the SNI proxy to successfully intercept traffic intended for the domains specified in your `routing.rules`, it's crucial that the client application resolves these domain names to the IP address of the machine where the SNI proxy is running. Without proper DNS resolution pointing to the proxy, the client will connect directly to the original server, bypassing the proxy.

There are two primary ways to achieve this:

1.  **Edit the `hosts` file:** You can manually add entries to your operating system's `hosts` file. This file maps hostnames to IP addresses locally.
    *   On Linux and macOS: `/etc/hosts`
    *   On Windows: `C:\Windows\System32\drivers\etc\hosts`

    Add lines in the following format for each domain you want to proxy:
    ```
    <proxy-IP-address> <domain.to.proxy>
    ```
    For example:
    ```
    192.168.1.100 secure.example.com
    192.168.1.100 api.example.org
    ```
    Replace `192.168.1.100` with the actual IP address of your SNI proxy machine and `secure.example.com` / `api.example.org` with the domains defined in your rules.

2.  **Configure a DNS Server:** For more scalable or centralized management, configure a local or corporate DNS server to resolve the target domains to the SNI proxy's IP address for the clients that should use the proxy.

Choose the method that best suits your environment and needs.

---

## Важные замечания

Чтобы SNI-прокси мог успешно перехватывать трафик, предназначенный для доменов, указанных в ваших `routing.rules`, крайне важно, чтобы клиентское приложение разрешало (резолвило) эти доменные имена в IP-адрес машины, на которой запущен SNI-прокси. Без правильной настройки DNS, указывающей на прокси, клиент будет подключаться напрямую к исходному серверу, минуя прокси.

Есть два основных способа добиться этого:

1.  **Отредактировать файл `hosts`:** Вы можете вручную добавить записи в файл `hosts` вашей операционной системы. Этот файл локально сопоставляет имена хостов с IP-адресами.
    *   В Linux и macOS: `/etc/hosts`
    *   В Windows: `C:\Windows\System32\drivers\etc\hosts`

    Добавьте строки в следующем формате для каждого домена, который вы хотите проксировать:
    ```
    <IP-адрес-прокси> <проксируемый.домен>
    ```
    Например:
    ```
    192.168.1.100 secure.example.com
    192.168.1.100 api.example.org
    ```
    Замените `192.168.1.100` на фактический IP-адрес вашей машины с SNI-прокси, а `secure.example.com` / `api.example.org` — на домены, определенные в ваших правилах.

2.  **Настроить DNS-сервер:** Для более масштабируемого или централизованного управления настройте локальный или корпоративный DNS-сервер так, чтобы он разрешал целевые домены в IP-адрес SNI-прокси для тех клиентов, которые должны использовать прокси.

Выберите метод, который наилучшим образом соответствует вашей среде и потребностям.

---

## 重要提示

为了让 SNI 代理能够成功拦截发往您在 `routing.rules` 中指定的域名的流量，客户端应用程序必须将这些域名解析（resolve）到运行 SNI 代理的机器的 IP 地址，这一点至关重要。如果没有正确的 DNS 解析指向代理，客户端将直接连接到原始服务器，从而绕过代理。

有两种主要方法可以实现这一点：

1.  **编辑 `hosts` 文件：** 您可以手动将条目添加到操作系统的 `hosts` 文件中。该文件在本地将主机名映射到 IP 地址。
    *   在 Linux 和 macOS 上：`/etc/hosts`
    *   在 Windows 上：`C:\Windows\System32\drivers\etc\hosts`

    为您要代理的每个域添加以下格式的行：
    ```
    <代理IP地址> <要代理的域名>
    ```
    例如：
    ```
    192.168.1.100 secure.example.com
    192.168.1.100 api.example.org
    ```
    请将 `192.168.1.100` 替换为您的 SNI 代理机器的实际 IP 地址，并将 `secure.example.com` / `api.example.org` 替换为您规则中定义的域名。

2.  **配置 DNS 服务器：** 对于更具可扩展性或集中化的管理，请配置本地或企业 DNS 服务器，以便为应使用代理的客户端将目标域名解析为 SNI 代理的 IP 地址。

请选择最适合您的环境和需求的方法。

---
## Требования

*   **Node.js**: Необходимая среда выполнения.
*   **pnpm**: Менеджер пакетов для установки зависимостей.
*   **Docker** (Опционально): Для сборки и запуска приложения в контейнере.

## Конфигурация

Основная конфигурация приложения находится в файле `config.yaml`.

Ключевые секции конфигурации:

*   `proxy_port`: Порт, на котором прокси будет принимать входящие TLS-соединения (например, 443).
*   `socks_proxy`: Настройки для подключения к вышестоящему SOCKS5 прокси.
    *   `host`: Адрес SOCKS5 прокси.
    *   `port`: Порт SOCKS5 прокси.
    *   `username` (Опционально): Имя пользователя для аутентификации.
    *   `password` (Опционально): Пароль для аутентификации.
*   `routing`: Правила маршрутизации на основе SNI. Определяет, какие домены должны направляться через SOCKS5 прокси, а какие - напрямую.
    *   `default`: Действие по умолчанию (`proxy` или `direct`).
    *   `rules`: Список правил для конкретных доменов или паттернов.
        *   `domain`: Домен или паттерн (например, `*.example.com`).
        *   `action`: Действие (`proxy` или `direct`).
*   `logging`: Настройки логирования с использованием `winston`.
    *   `level`: Уровень логирования (например, `info`, `debug`).
    *   `log_dir`: Директория для хранения файлов логов (по умолчанию `logs`).
    *   `max_size`: Максимальный размер файла лога.
    *   `max_files`: Максимальное количество хранимых файлов логов.

**Пример структуры `config.yaml`:**

```yaml
proxy_port: 443

socks_proxy:
  host: 127.0.0.1
  port: 1080
  # username: user
  # password: password

routing:
  default: direct # По умолчанию все идет напрямую
  rules:
    - domain: "*.internal.corp"
      action: proxy # Внутренние домены через прокси
    - domain: "secure.example.com"
      action: proxy # Конкретный домен через прокси

logging:
  level: info
  log_dir: logs
  max_size: 5242880 # 5MB
  max_files: 5
```

## Установка

Для установки зависимостей выполните команду:

```bash
pnpm install
```

## Запуск

### Локально

Для запуска прокси-сервера локально используйте:

```bash
node index.js
```

Сервер запустится на порту, указанном в `config.yaml` (`proxy_port`).

### С использованием Docker

Вы можете собрать Docker-образ и запустить приложение в контейнере.

1.  **Сборка образа:**

    ```bash
    docker build -t sni-ai-proxy:latest .
    ```

2.  **Запуск контейнера:**

    ```bash
    docker run -d -p 443:443 --name sni-proxy-container sni-ai-proxy:latest
    ```

    Эта команда запустит контейнер в фоновом режиме (`-d`), пробросит порт 443 хоста на порт 443 контейнера (`-p 443:443`) и присвоит контейнеру имя `sni-proxy-container`. Убедитесь, что порт 443 на хосте свободен.

## Логирование

Приложение использует библиотеку `winston` для логирования. Логи записываются в файлы в директории `logs` (или в директорию, указанную в `config.yaml` в секции `logging.log_dir`). Настройки ротации логов (уровень, максимальный размер файла, количество файлов) также задаются в секции `logging` файла `config.yaml`.