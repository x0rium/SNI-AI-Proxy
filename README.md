# SNI AI Proxy: Smart TLS Routing via SOCKS5

A simple yet flexible proxy server that routes TLS connections based on the Server Name Indication (SNI) in the ClientHello. Allows directing traffic through a specified SOCKS5 proxy or directly to the target server. Particularly useful for AI services and development/testing scenarios.

[English](#english) | [Русский](#русский) | [简体中文](#简体中文)
---

## English

### 🚀 Why Use It? (Use Cases)

This SNI proxy can be useful in various scenarios:

*   **🎯 AI Endpoint Routing:** Route requests to different AI model endpoints or versions (`model-a.ai.internal`, `model-b.ai.internal`) through different SOCKS5 proxies or directly, based solely on the domain name.
*   **🌍 Geo-restriction Bypass:** Access AI services or APIs that are geographically restricted by routing traffic through a SOCKS5 proxy located in an allowed region.
*   **🧪 Development & Testing Isolation:** Isolate traffic during AI application development and testing by directing it through a dedicated SOCKS5 proxy. This simplifies monitoring, debugging, or simulating specific network conditions.
*   **🚦 Version Access Control:** Manage access to different deployment stages (e.g., staging, production) of your AI services by routing connections based on the SNI hostname.

---

### ⚠️ Important: Usage Limitations

> This SNI proxy is primarily designed **for development, testing, or specific low-traffic use cases** where simplicity and routing flexibility are prioritized.
>
> **It is NOT engineered for and NOT recommended for high-traffic production environments.**
>
> Its simple architecture lacks features crucial for production, such as load balancing, high availability, advanced security measures, and comprehensive performance optimizations. Use in production settings at your own risk.

---

### 🛠️ Getting Started

#### Requirements

*   **Node.js**: JavaScript runtime environment.
*   **pnpm**: Package manager (you can use npm or yarn, but commands here use pnpm).
*   **Docker** (Optional): For running in a container.

#### Installation

1.  Clone the repository (if you haven't already).
2.  Install dependencies:
    ```bash
    pnpm install
    ```

#### Configuration (`config.yaml`)

The main configuration file is `config.yaml`. Key parameters:

*   `proxy_port`: The port on which the proxy will listen for incoming TLS connections (e.g., `443`).
*   `socks_proxy`: Settings for your upstream SOCKS5 proxy (used if `action: proxy`).
    *   `host`: SOCKS5 server address.
    *   `port`: SOCKS5 server port.
    *   `username` (optional): Authentication username.
    *   `password` (optional): Authentication password.
*   `routing`: SNI-based routing rules.
    *   `default`: Default action for domains not listed in `rules` (`proxy` - via SOCKS5, `direct` - connect directly).
    *   `rules`: List of rules:
        *   `domain`: Exact domain (`secure.example.com`) or wildcard pattern (`*.internal.corp`).
        *   `action`: Action for this domain/pattern (`proxy` or `direct`).
*   `logging`: Logging settings.
    *   `level`: Log detail level (`info`, `debug`, etc.).
    *   `log_dir`: Directory for log files (default `logs`).
    *   `max_size`: Maximum size of a single log file (e.g., `5m` for 5MB).
    *   `max_files`: Maximum number of log files to keep (rotation).

**Example `config.yaml`:**

```yaml
proxy_port: 443 # Listen on the standard HTTPS port

socks_proxy:
  host: 127.0.0.1
  port: 1080
  # username: user # Uncomment if authentication is needed
  # password: password

routing:
  default: direct # By default, all requests go directly
  rules:
    # Domains that should go through the SOCKS5 proxy
    - domain: "*.internal.corp"
      action: proxy
    - domain: "restricted-ai-service.com"
      action: proxy
    # Domains that should go directly (even if default=proxy)
    - domain: "public-api.com"
      action: direct

logging:
  level: info # Logging level: info, debug, warn, error
  log_dir: logs # Log file directory
  max_size: 5m # Max log file size: 5 megabytes
  max_files: 5 # Keep the last 5 log files
```

#### ❗ Critically Important: DNS Setup

For the proxy to intercept traffic intended for the domains in `routing.rules`, **client applications must resolve these domain names to the IP address of the machine running the SNI AI Proxy**, not the original server's IP.

Without this, the client will connect directly, bypassing the proxy.

**How to achieve this:**

1.  **Locally (for testing): `hosts` file**
    *   Find the `hosts` file on your system:
        *   Linux/macOS: `/etc/hosts`
        *   Windows: `C:\Windows\System32\drivers\etc\hosts` (requires administrator privileges to edit)
    *   Add lines in the format `<proxy-IP-address> <domain.from.rules>` for each domain to be proxied:
        ```
        # Example if the proxy is running on 192.168.1.100
        192.168.1.100 secure.example.com
        192.168.1.100 api.example.org
        192.168.1.100 model-a.ai.internal
        ```
    *   Replace `192.168.1.100` with the actual IP address of your proxy machine.

2.  **Centrally: Configure a DNS Server**
    *   If multiple clients need to use the proxy, configure your local or corporate DNS server to resolve the target domain names to the proxy's IP address for those clients.

**Choose the method that best suits your environment.**

#### Running

##### Locally

```bash
node index.js
```
The server will start listening on the `proxy_port` defined in `config.yaml`. Logs will be written to the `log_dir`.

##### Via Docker

1.  **Build the Docker image:**
    ```bash
    docker build -t sni-ai-proxy:latest .
    ```

2.  **Run the container:**
    ```bash
    # Example: run in background, map host port 443 to container port 443
    docker run -d \
      -p 443:443 \
      -v $(pwd)/config.yaml:/app/config.yaml \ # Mount config from host (recommended)
      -v $(pwd)/logs:/app/logs \              # Mount logs directory from host (optional)
      --name sni-proxy-instance \
      sni-ai-proxy:latest
    ```
    *   Ensure port `443` (or your `proxy_port`) is free on the host.
    *   `-v $(pwd)/config.yaml:/app/config.yaml`: Allows changing the config without rebuilding the image. Assumes `config.yaml` is in the current host directory.
    *   `-v $(pwd)/logs:/app/logs`: Persists logs on the host machine.

---

### 📄 Logging

The application uses the `winston` library for logging. All settings (level, file path, rotation) are configured in the `logging` section of `config.yaml`. Check the log files in the specified directory for debugging and monitoring.

---

## Русский

### 🚀 Зачем это нужно? (Примеры использования)

Этот SNI-прокси может пригодиться в самых разных ситуациях:

*   **🎯 Маршрутизация к эндпоинтам AI:** Направляйте запросы к разным моделям или версиям AI-сервисов (`model-a.ai.internal`, `model-b.ai.internal`) через разные SOCKS5-прокси или напрямую, просто на основе доменного имени.
*   **🌍 Обход геоблокировок:** Получайте доступ к AI-сервисам или API, доступ к которым ограничен по географическому признаку, пропуская трафик через SOCKS5-прокси в нужной стране.
*   **🧪 Изоляция при разработке и тестировании:** Отлаживайте взаимодействие с внешними сервисами, направляя трафик вашего AI-приложения через выделенный SOCKS5-прокси. Это упрощает мониторинг, отладку и симуляцию сетевых условий.
*   **🚦 Управление доступом к версиям:** Контролируйте доступ к разным окружениям (staging, production) ваших AI-сервисов, маршрутизируя трафик на основе SNI-имени хоста.

---

### ⚠️ Важно: Ограничения использования

> Этот SNI-прокси создан в первую очередь **для разработки, тестирования и специфических задач с невысокой нагрузкой**, где важна простота настройки и гибкость маршрутизации.
>
> **Он НЕ предназначен и НЕ рекомендуется для использования в высоконагруженных production-средах.**
>
> В его простой архитектуре отсутствуют критически важные для production функции: балансировка нагрузки, высокая доступность (high availability), продвинутые механизмы безопасности и оптимизация производительности. Используйте в production на свой страх и риск.

---

### 🛠️ Начало работы

#### Требования

*   **Node.js**: Среда выполнения JavaScript.
*   **pnpm**: Менеджер пакетов (можно использовать npm или yarn, но команды в README приведены для pnpm).
*   **Docker** (Опционально): Для запуска в контейнере.

#### Установка

1.  Клонируйте репозиторий (если еще не сделали).
2.  Установите зависимости:
    ```bash
    pnpm install
    ```

#### Конфигурация (`config.yaml`)

Основной файл настроек – `config.yaml`. Вот ключевые параметры:

*   `proxy_port`: Порт, на котором прокси будет слушать входящие TLS-соединения (например, `443`).
*   `socks_proxy`: Настройки вашего SOCKS5-прокси, через который будет идти трафик (если `action: proxy`).
    *   `host`: Адрес SOCKS5-сервера.
    *   `port`: Порт SOCKS5-сервера.
    *   `username` (опционально): Логин для аутентификации.
    *   `password` (опционально): Пароль для аутентификации.
*   `routing`: Правила маршрутизации на основе SNI.
    *   `default`: Действие по умолчанию для доменов, не попавших в `rules` (`proxy` - через SOCKS5, `direct` - напрямую).
    *   `rules`: Список правил:
        *   `domain`: Точный домен (`secure.example.com`) или шаблон (`*.internal.corp`).
        *   `action`: Действие для этого домена/шаблона (`proxy` или `direct`).
*   `logging`: Настройки логирования.
    *   `level`: Уровень детализации логов (`info`, `debug` и т.д.).
    *   `log_dir`: Папка для файлов логов (по умолчанию `logs`).
    *   `max_size`: Максимальный размер одного файла лога (например, `5m` для 5MB).
    *   `max_files`: Максимальное количество хранимых файлов логов (ротация).

**Пример `config.yaml`:**

```yaml
proxy_port: 443 # Слушаем на стандартном HTTPS порту

socks_proxy:
  host: 127.0.0.1
  port: 1080
  # username: user # Раскомментируйте, если нужна аутентификация
  # password: password

routing:
  default: direct # По умолчанию все запросы идут напрямую
  rules:
    # Домены, которые должны идти через SOCKS5 прокси
    - domain: "*.internal.corp"
      action: proxy
    - domain: "restricted-ai-service.com"
      action: proxy
    # Домены, которые должны идти напрямую (даже если default=proxy)
    - domain: "public-api.com"
      action: direct

logging:
  level: info # Уровень логирования: info, debug, warn, error
  log_dir: logs # Папка для логов
  max_size: 5m # Макс. размер файла лога: 5 мегабайт
  max_files: 5 # Хранить последние 5 файлов логов
```

#### ❗ Критически важно: Настройка DNS

Чтобы прокси мог перехватывать трафик для доменов из `routing.rules`, **клиентские приложения должны обращаться не к реальному IP адресу этих доменов, а к IP-адресу машины, где запущен SNI AI Proxy**.

Без этого клиент будет подключаться напрямую, и прокси не сможет обработать соединение.

**Как это сделать:**

1.  **Локально (для тестов): Файл `hosts`**
    *   Найдите файл `hosts` на вашем компьютере:
        *   Linux/macOS: `/etc/hosts`
        *   Windows: `C:\Windows\System32\drivers\etc\hosts` (требуются права администратора для редактирования)
    *   Добавьте строки вида `<IP-адрес-прокси> <домен.из.правил>` для каждого домена, который должен идти через прокси:
        ```
        # Пример, если прокси запущен на 192.168.1.100
        192.168.1.100 secure.example.com
        192.168.1.100 api.example.org
        192.168.1.100 model-a.ai.internal
        ```
    *   Замените `192.168.1.100` на реальный IP вашей машины с прокси.

2.  **Централизованно: Настройка DNS-сервера**
    *   Если вам нужно, чтобы несколько клиентов использовали прокси, настройте ваш локальный или корпоративный DNS-сервер так, чтобы он возвращал IP-адрес прокси для нужных доменных имен.

**Выберите способ, который подходит для вашей инфраструктуры.**

#### Запуск

##### Локально

```bash
node index.js
```
Сервер запустится и начнет слушать порт, указанный в `proxy_port` (`config.yaml`). Логи будут писаться в директорию, указанную в `log_dir`.

##### Через Docker

1.  **Соберите Docker-образ:**
    ```bash
    docker build -t sni-ai-proxy:latest .
    ```

2.  **Запустите контейнер:**
    ```bash
    # Пример: запускаем в фоне, пробрасываем порт 443 хоста на 443 контейнера
    docker run -d \
      -p 443:443 \
      -v $(pwd)/config.yaml:/app/config.yaml \ # Монтируем конфиг с хоста (рекомендуется)
      -v $(pwd)/logs:/app/logs \              # Монтируем папку логов с хоста (опционально)
      --name sni-proxy-instance \
      sni-ai-proxy:latest
    ```
    *   Убедитесь, что порт `443` (или тот, что в `proxy_port`) на хосте свободен.
    *   `-v $(pwd)/config.yaml:/app/config.yaml`: Позволяет изменять конфигурацию без пересборки образа. Убедитесь, что `config.yaml` лежит в текущей директории на хосте.
    *   `-v $(pwd)/logs:/app/logs`: Позволяет сохранять логи на хост-машине.

---

#### 📄 Логирование

Приложение использует библиотеку `winston` для логирования. Все настройки (уровень, путь к файлам, ротация) задаются в секции `logging` файла `config.yaml`. Просматривайте файлы логов в указанной директории для отладки и мониторинга работы прокси.

---

## 简体中文

### 🚀 为何使用？ (使用场景)

此 SNI 代理可在多种场景中发挥作用：

*   **🎯 AI 端点路由：** 根据域名将请求路由到不同的 AI 模型端点或版本 (`model-a.ai.internal`, `model-b.ai.internal`)，可以选择通过不同的 SOCKS5 代理或直接连接。
*   **🌍 绕过地理限制：** 通过位于允许区域的 SOCKS5 代理路由流量，访问受地理位置限制的 AI 服务或 API。
*   **🧪 开发与测试隔离：** 在 AI 应用开发和测试期间，通过将流量定向到专用的 SOCKS5 代理来隔离流量。这简化了监控、调试或模拟特定网络条件。
*   **🚦 版本访问控制：** 通过基于 SNI 主机名路由连接，管理对 AI 服务不同部署阶段（例如，预发布 staging、生产 production）的访问。

---

### ⚠️ 重要提示：使用限制

> 此 SNI 代理主要设计用于**开发、测试或优先考虑简单性和路由灵活性的特定低流量用例**。
>
> **它并非为高流量生产环境设计，也不推荐用于此类环境。**
>
> 其简单的架构缺乏生产环境所必需的关键功能，例如负载均衡、高可用性、高级安全措施和全面的性能优化。在生产环境中使用需自行承担风险。

---

### 🛠️ 开始使用

#### 环境要求

*   **Node.js**: JavaScript 运行时环境。
*   **pnpm**: 包管理器 (您也可以使用 npm 或 yarn, 但本文档中的命令使用 pnpm)。
*   **Docker** (可选): 用于在容器中运行。

#### 安装

1.  克隆代码库 (如果尚未克隆)。
2.  安装依赖：
    ```bash
    pnpm install
    ```

#### 配置 (`config.yaml`)

主配置文件是 `config.yaml`。关键参数：

*   `proxy_port`: 代理监听传入 TLS 连接的端口 (例如 `443`)。
*   `socks_proxy`: 上游 SOCKS5 代理的设置 (当 `action: proxy` 时使用)。
    *   `host`: SOCKS5 服务器地址。
    *   `port`: SOCKS5 服务器端口。
    *   `username` (可选): 认证用户名。
    *   `password` (可选): 认证密码。
*   `routing`: 基于 SNI 的路由规则。
    *   `default`: 对于未在 `rules` 中列出的域名的默认操作 (`proxy` - 通过 SOCKS5, `direct` - 直接连接)。
    *   `rules`: 规则列表：
        *   `domain`: 精确域名 (`secure.example.com`) 或通配符模式 (`*.internal.corp`)。
        *   `action`: 针对此域名/模式的操作 (`proxy` 或 `direct`)。
*   `logging`: 日志记录设置。
    *   `level`: 日志详细级别 (`info`, `debug` 等)。
    *   `log_dir`: 日志文件目录 (默认为 `logs`)。
    *   `max_size`: 单个日志文件的最大大小 (例如 `5m` 代表 5MB)。
    *   `max_files`: 保留的最大日志文件数量 (轮换)。

**`config.yaml` 示例:**

```yaml
proxy_port: 443 # 监听标准的 HTTPS 端口

socks_proxy:
  host: 127.0.0.1
  port: 1080
  # username: user # 如果需要认证，请取消注释
  # password: password

routing:
  default: direct # 默认所有请求直接连接
  rules:
    # 需要通过 SOCKS5 代理的域名
    - domain: "*.internal.corp"
      action: proxy
    - domain: "restricted-ai-service.com"
      action: proxy
    # 需要直接连接的域名 (即使 default=proxy)
    - domain: "public-api.com"
      action: direct

logging:
  level: info # 日志级别: info, debug, warn, error
  log_dir: logs # 日志文件目录
  max_size: 5m # 最大日志文件大小: 5 MB
  max_files: 5 # 保留最近 5 个日志文件
```

#### ❗ 至关重要：DNS 设置

为了让代理能够拦截发往 `routing.rules` 中指定域名的流量，**客户端应用程序必须将这些域名解析 (resolve) 到运行 SNI AI Proxy 的机器的 IP 地址**，而不是原始服务器的 IP 地址。

否则，客户端将直接连接，从而绕过代理。

**如何实现：**

1.  **本地 (用于测试)：`hosts` 文件**
    *   找到您系统上的 `hosts` 文件：
        *   Linux/macOS: `/etc/hosts`
        *   Windows: `C:\Windows\System32\drivers\etc\hosts` (编辑需要管理员权限)
    *   为每个需要代理的域名添加格式为 `<代理IP地址> <规则中的域名>` 的行：
        ```
        # 示例：如果代理运行在 192.168.1.100
        192.168.1.100 secure.example.com
        192.168.1.100 api.example.org
        192.168.1.100 model-a.ai.internal
        ```
    *   将 `192.168.1.100` 替换为您代理机器的实际 IP 地址。

2.  **集中式：配置 DNS 服务器**
    *   如果多个客户端需要使用代理，请配置您的本地或企业 DNS 服务器，为这些客户端将目标域名解析到代理的 IP 地址。

**请选择最适合您环境的方法。**

#### 运行

##### 本地运行

```bash
node index.js
```
服务器将启动并在 `config.yaml` 中定义的 `proxy_port` 上监听。日志将写入 `log_dir` 目录。

##### 通过 Docker 运行

1.  **构建 Docker 镜像：**
    ```bash
    docker build -t sni-ai-proxy:latest .
    ```

2.  **运行容器：**
    ```bash
    # 示例：后台运行，将宿主机的 443 端口映射到容器的 443 端口
    docker run -d \
      -p 443:443 \
      -v $(pwd)/config.yaml:/app/config.yaml \ # 从宿主机挂载配置文件 (推荐)
      -v $(pwd)/logs:/app/logs \              # 从宿主机挂载日志目录 (可选)
      --name sni-proxy-instance \
      sni-ai-proxy:latest
    ```
    *   确保宿主机上的端口 `443` (或您的 `proxy_port`) 未被占用。
    *   `-v $(pwd)/config.yaml:/app/config.yaml`: 允许在不重新构建镜像的情况下更改配置。假设 `config.yaml` 位于宿主机的当前目录。
    *   `-v $(pwd)/logs:/app/logs`: 将日志持久化到宿主机。

---

### 📄 日志记录

该应用程序使用 `winston` 库进行日志记录。所有设置（级别、文件路径、轮换）都在 `config.yaml` 的 `logging` 部分进行配置。检查指定目录中的日志文件以进行调试和监控。