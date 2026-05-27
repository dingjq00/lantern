# 本地三系统测试环境启动手册

> 核验日期：2026-05-27  
> 用途：为 Lantern 启动 EAM、EDHR、MES 真实查询所依赖的本地/测试后端服务。本文记录的是已经通过基础 API 验证的启动组合，不记录用户名、密码或 OAuth 密钥。

## 服务清单

| 系统 | 对应工程 | Lantern 访问地址 | 说明 |
| --- | --- | --- | --- |
| EAM 设备资产管理 | `/Users/dingjq/IdeaProjects/eamNewGe/backend` | `http://localhost:48080` | Spring Boot / Maven；使用 `local` profile |
| EDHR 医疗器械检测 | `/Users/dingjq/IdeaProjects/momExecution` | `https://localhost:8443` | Jmix / Gradle；对应本地库 `db_edhr_lac` |
| MES 生产执行系统 | `/Users/dingjq/IdeaProjects/2023-kltn/02.Source/qzCPGMOM` | `https://localhost:443` | Jmix / Gradle；使用工程中已配置的数据源 |

不要将 `/Users/dingjq/IdeaProjects/edhr` 作为当前 Lantern 的 EDHR 后端启动。该工程实体结构与现有 `db_edhr_lac` 测试库不对应，业务实体查询会失败。

## 端口约定

三系统同时运行时使用以下端口，避免两个 Jmix 工程的默认端口冲突：

| 端口 | 服务 |
| --- | --- |
| `48080` | EAM API |
| `8443` | EDHR HTTPS API |
| `18081` | EDHR HTTP 辅助端口 |
| `443` | MES HTTPS API |
| `8080` | MES HTTP 辅助端口 |

启动前可检查端口占用：

```bash
lsof -nP -iTCP:48080 -iTCP:8443 -iTCP:18081 -iTCP:443 -iTCP:8080 -sTCP:LISTEN
```

## Lantern 配置

在 `/Users/dingjq/projects/lantern/.env.local` 中配置数据源连接参数。密钥只放在本地环境文件，不写入本文或提交到仓库。

```bash
EAM_API_BASE_URL=http://localhost:48080
EAM_TENANT_ID=1
EAM_USERNAME=...
EAM_PASSWORD=...

EDHR_BASE_URL=https://localhost:8443
EDHR_CLIENT_ID=...
EDHR_CLIENT_SECRET=...

MES_BASE_URL=https://localhost:443
MES_CLIENT_ID=...
MES_CLIENT_SECRET=...
```

EDHR 与 MES 使用本地 HTTPS 证书。Lantern 的 Jmix client 已处理开发环境中的自签证书访问；手工用 `curl` 验证时需添加 `-k`。

## 启动顺序

推荐依次启动 EAM、MES、EDHR，再启动 Lantern。MES 保持默认的 `443` / `8080`，EDHR 显式改到 `8443` / `18081`。

### 1. 启动 EAM

前置条件：`local` 配置使用的 PostgreSQL 与 Redis 可访问。当前工程的本地配置将 EAM API 暴露在 `48080`。

在独立终端中运行：

```bash
cd /Users/dingjq/IdeaProjects/eamNewGe/backend
mvn spring-boot:run -pl yudao-server \
  -Dspring-boot.run.profiles=local \
  -Dmaven.test.skip=true
```

看到 `Started YudaoServerApplication` 后，检查监听：

```bash
lsof -nP -iTCP:48080 -sTCP:LISTEN
```

### 2. 启动 MES

前置条件：工程配置的数据源网络可达。该工程的 HTTPS 端口为 `443`，HTTP 辅助端口为 `8080`。

在独立终端中运行：

```bash
cd /Users/dingjq/IdeaProjects/2023-kltn/02.Source/qzCPGMOM
/bin/sh ./gradlew --no-daemon bootRun
```

看到 `Started QzCPGMOMApplication` 后，检查监听：

```bash
lsof -nP -iTCP:443 -iTCP:8080 -sTCP:LISTEN
```

### 3. 启动 EDHR

EDHR 的正确工程为 `momExecution`，默认使用本地 MySQL 数据库 `db_edhr_lac`。因为 MES 已使用 `443` 与 `8080`，启动 EDHR 时必须覆盖这两个端口。

该工程的 `build.gradle` 引用了旧的 Jmix public repository。如本机访问该仓库超时，先创建一次临时 Gradle 初始化脚本 `/private/tmp/lantern-jmix-global-repo.init.gradle`：

```groovy
import org.gradle.api.artifacts.repositories.MavenArtifactRepository

allprojects {
    repositories.withType(MavenArtifactRepository).configureEach { repository ->
        def repositoryUrl = repository.url.toString()
        if (repositoryUrl == 'https://nexus.jmix.io/repository/public') {
            repository.setUrl(repositoryUrl.replace(
                'https://nexus.jmix.io',
                'https://global.repo.jmix.io'
            ))
        }
    }
}
```

在独立终端中运行已验证的启动命令：

```bash
cd /Users/dingjq/IdeaProjects/momExecution
./gradlew --no-daemon \
  --init-script /private/tmp/lantern-jmix-global-repo.init.gradle \
  -Dorg.gradle.internal.http.connectionTimeout=120000 \
  -Dorg.gradle.internal.http.socketTimeout=120000 \
  bootRun --args="--server.port=8443 --http.port=18081"
```

看到应用启动后，检查监听：

```bash
lsof -nP -iTCP:8443 -iTCP:18081 -sTCP:LISTEN
```

如果旧 Jmix repository 当前可正常访问，也可不加 `--init-script` 与两个 HTTP timeout 参数；端口覆盖参数仍必须保留。

### 4. 启动 Lantern

确认 `.env.local` 已指向上述三个服务后，在独立终端中运行：

```bash
cd /Users/dingjq/projects/lantern
npm run dev
```

访问 `http://localhost:3000` 使用主界面。

## 启动后验证

### 监听端口

```bash
lsof -nP -iTCP:48080 -iTCP:8443 -iTCP:443 -sTCP:LISTEN
```

应同时出现 EAM `48080`、EDHR `8443` 与 MES `443` 的监听进程。

### EAM API

以下命令从 Lantern 的本地环境配置读取凭据，只验证登录及一条设备查询：

```bash
cd /Users/dingjq/projects/lantern
source .env.local

curl -s -o /private/tmp/eam-login.json \
  -H "tenant-id: $EAM_TENANT_ID" \
  -H "Content-Type: application/json" \
  -X POST "$EAM_API_BASE_URL/admin-api/system/auth/login" \
  -d "{\"username\":\"$EAM_USERNAME\",\"password\":\"$EAM_PASSWORD\"}"

EAM_TOKEN=$(jq -r '.data.accessToken // empty' /private/tmp/eam-login.json)
curl -s -H "tenant-id: $EAM_TENANT_ID" \
  -H "Authorization: Bearer $EAM_TOKEN" \
  "$EAM_API_BASE_URL/admin-api/eam/equipment/page?pageNo=1&pageSize=1" \
  | jq '{code,msg}'
```

期望返回 `code: 0`。

### EDHR API

```bash
cd /Users/dingjq/projects/lantern
source .env.local

EDHR_TOKEN=$(curl -sk -u "$EDHR_CLIENT_ID:$EDHR_CLIENT_SECRET" \
  -X POST "$EDHR_BASE_URL/oauth2/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data "grant_type=client_credentials" \
  | jq -r '.access_token // empty')

for entity in Product Order_ OrderItem OrderException; do
  curl -sk -o /dev/null -w "$entity HTTP=%{http_code}\n" \
    -H "Authorization: Bearer $EDHR_TOKEN" \
    "$EDHR_BASE_URL/rest/entities/$entity?limit=1&returnCount=true"
done
```

期望四类实体均返回 `HTTP=200`。

### MES API

```bash
cd /Users/dingjq/projects/lantern
source .env.local

MES_TOKEN=$(curl -sk -u "$MES_CLIENT_ID:$MES_CLIENT_SECRET" \
  -X POST "$MES_BASE_URL/oauth2/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data "grant_type=client_credentials" \
  | jq -r '.access_token // empty')

curl -sk -o /dev/null -w "ProductionOrder HTTP=%{http_code}\n" \
  -H "Authorization: Bearer $MES_TOKEN" \
  "$MES_BASE_URL/rest/entities/ProductionOrder?limit=1&returnCount=true"
```

期望返回 `ProductionOrder HTTP=200`。

## 停止服务

如果服务运行在当前终端，使用 `Ctrl+C` 停止。若终端已经丢失，可先按端口定位进程，再停止相应 Java 进程：

```bash
lsof -nP -iTCP:48080 -iTCP:8443 -iTCP:443 -sTCP:LISTEN
kill <PID>
```

停止前应确认 PID 对应的工程，避免误停其他本地服务。

## 常见问题

| 现象 | 排查方向 |
| --- | --- |
| EDHR 查询时报字段不存在 | 核对是否误启动了 `/Users/dingjq/IdeaProjects/edhr`；当前应使用 `momExecution` 与 `db_edhr_lac` |
| EDHR 或 MES 提示端口占用 | 确保 MES 使用 `443` / `8080`，EDHR 启动命令带 `--server.port=8443 --http.port=18081` |
| EDHR Gradle 下载依赖超时 | 使用本文提供的临时 Gradle init script，将旧 Jmix public repository 定向到 global repository |
| EDHR/MES 返回 `401` | 核对 `.env.local` 中对应 OAuth client 配置是否与当前工程运行配置一致 |
| EAM 无法启动或查询失败 | 核对 PostgreSQL、Redis，以及 `local` profile 所需的本地依赖是否运行 |
| MES 启动后查询失败 | 核对工程配置的数据源网络是否可达，以及 Lantern 中 MES OAuth 配置是否匹配 |
